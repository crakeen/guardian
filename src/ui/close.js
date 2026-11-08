// Cerrar una operación abierta: resultado en R, dinero real (si es cuenta) y preguntas honestas.
import { h, field, seg, num, rStr } from './dom.js';
import { moneyFields, readMoney } from './money.js';
import { isMoney, accountOf } from '../accounts.js';

const FLAGS = [
  ['stopMoved', 'Moví el stop en contra (R6)', true],
  ['added', 'Añadí a la posición (R7)', true],
  ['fear', 'Cerré antes del objetivo por miedo, sin motivo del plan', false],
  ['timeExit', 'Salida por tiempo según el plan (vela en contra / London Lunch)', false],
];

export function renderClose(ctx, t) {
  const f = (ctx.ui.close ||= { id: t.id, kind: '', flags: {} });
  if (f.id !== t.id) { ctx.ui.close = null; return renderClose(ctx, t); }
  const forward = !isMoney(ctx.state, accountOf(t));
  f.money ||= { commission: t.lots ? String(-(t.lots * ctx.state.config.commissionPerLot)).replace('.', ',') : '' };
  const rOf = () => (f.kind === 'tp' ? t.ratioPlan || 2 : f.kind === 'sl' ? -1 : f.kind === 'be' ? 0 : num(f.r));
  const r = rOf();
  const save = () => {
    if (r === null) { alert('Indica el resultado en R.'); return; }
    const m = forward ? null : readMoney(f.money);
    if (!forward && !m) { alert('Escribe el beneficio que marca MT5.'); return; }
    const pnl = forward ? r * t.riskUSD : m.pnl;
    ctx.commit((s) => {
      const tr = s.trades.find((x) => x.id === t.id);
      Object.assign(tr, {
        ...(m || {}), status: 'closed', r, pnl, closedAt: new Date().toISOString(), note: f.note || tr.note || '',
        flags: { ...f.flags, ruleBroken: !!(f.flags.stopMoved || f.flags.added) },
      });
      ctx.ui.close = null;
    });
  };
  return h('div', { class: 'close' },
    h('p', {}, h('b', {}, '¿Cómo ha terminado?')),
    seg(f.kind, { tp: `Objetivo ${rStr(t.ratioPlan || 2)}`, sl: 'Stop −1R', be: 'Break even', manual: 'Otro' }, (v) => { f.kind = v; ctx.render(); }),
    f.kind === 'manual' ? field('Resultado en R', h('input', { inputmode: 'decimal', value: f.r || '', placeholder: 'ej. 0,6 o −0,4', oninput: (e) => { f.r = e.target.value; } })) : null,
    !forward && f.kind ? moneyFields(f.money, { gross: r !== null ? String((r * t.riskUSD).toFixed(2)).replace('.', ',') : '' }) : null,
    f.kind ? h('ul', { class: 'steps' }, FLAGS.map(([k, l, broken]) => h('li', {}, h('label', { class: broken ? 'danger' : '' },
      h('input', { type: 'checkbox', checked: !!f.flags[k], onchange: (e) => { f.flags[k] = e.target.checked; } }), l)))) : null,
    f.kind ? field('Nota (qué ha pasado y por qué)', h('textarea', { rows: 2, value: f.note || '', oninput: (e) => { f.note = e.target.value; } })) : null,
    f.kind ? h('p', { class: 'muted' }, 'Si marcas R6 o R7 se registra como regla rota: 24 h sin operar. Ser honesto aquí es lo que hace que las métricas valgan algo.') : null,
    f.kind ? h('button', { class: 'primary', onclick: save }, 'Cerrar operación') : null);
}
