// Entrada: checklist + lotaje. O todo en verde o no hay operación.
import { h, card, field, select, seg, check, num, usd } from './dom.js';
import { evaluate, MANUAL } from '../rules/gate.js';
import { INSTRUMENTS, ZONES } from '../config.js';
import { madrid } from '../time.js';
import { uid } from '../store.js';

const windowName = (w) => (w ? (w.id === 'principal' ? 'Londres 9:00' : 'Londres 10:00') : 'Fuera de ventana');

function formOf(ctx) {
  const plan = ctx.state.days[madrid(ctx.now()).date]?.plan;
  const f = (ctx.ui.entry ||= { asset: plan?.asset || 'EURUSD', dir: plan?.dir || 'buy', zone: plan?.zone || 'optima', q: {}, reason: '' });
  return f;
}

const parsed = (f) => ({ ...f, entry: num(f.entry), stop: num(f.stop), tp: num(f.tp) });

function results(ctx, f) {
  const ev = evaluate(parsed(f), { state: ctx.state, now: ctx.now(), events: ctx.events() });
  const sz = ev.sizing;
  const register = (outOfPlan) => ctx.commit((s) => {
    const p = parsed(f);
    s.trades.push({
      id: uid(), accountId: s.config.activeAccount, date: madrid(ctx.now()).date, openedAt: new Date().toISOString(), status: 'open',
      asset: p.asset, dir: p.dir, entry: p.entry, stop: p.stop, tp: p.tp, zone: p.zone,
      lots: sz.lots, riskUSD: ev.risk.usd, ratioPlan: ev.ratio ? Math.round(ev.ratio * 100) / 100 : null,
      window: windowName(ev.window), checklistOk: !outOfPlan, outOfPlan,
      failed: ev.items.filter((i) => !i.ok).map((i) => i.label), reason: p.reason, source: 'app',
    });
    ctx.ui.entry = null;
    ctx.go('hoy');
  });
  return h('div', {},
    card('Resultado',
      h('ul', { class: 'checks' }, ev.items.map((i) => check(i.ok, i.label, i.detail))),
      ev.ok ? h('div', { class: 'verdict go' }, h('b', {}, 'APROBADA'), h('p', {}, `${sz.lots.toLocaleString('es-ES', { minimumFractionDigits: 2 })} lotes · riesgo ${usd(ev.risk.usd)} · si salta el stop pierdes ${usd(sz.lossAtStop)}`))
        : h('div', { class: 'verdict stop' }, h('b', {}, 'NO HAY OPERACIÓN'), h('p', {}, 'Un setup inválido con menos lotes sigue siendo inválido. Cierra la plataforma.')),
      ev.ok ? h('button', { class: 'primary', onclick: () => register(false) }, 'He entrado: registrar operación') : null,
      !ev.ok ? h('button', { class: 'ghost', onclick: () => {
        if (confirm('Vas a registrar una operación FUERA DE PLAN. Cuenta como regla rota: 24 h sin operar a partir de ahora. ¿Has entrado de verdad?')) register(true);
      } }, 'He entrado igualmente (registrar fuera de plan)') : null));
}

export function renderEntry(ctx) {
  const st = ctx.state;
  const open = st.trades.find((t) => t.status === 'open');
  const header = h('header', { class: 'top' }, h('h1', {}, 'Entrada'), h('p', {}, 'Checklist del Protocolo Diciembre y lotaje desde el stop.'));
  if (open) return [header, card('Ya tienes una posición abierta', h('p', {}, 'Una a la vez (R8) y nada de añadir (R7). Ciérrala desde Hoy.'), h('button', { onclick: () => ctx.go('hoy') }, 'Ir a Hoy'))];

  const f = formOf(ctx);
  const out = h('div', {});
  const refresh = () => out.replaceChildren(results(ctx, f));
  const input = (key, ph) => h('input', { inputmode: 'decimal', value: f[key] || '', placeholder: ph, oninput: (e) => { f[key] = e.target.value; refresh(); } });
  const dg = INSTRUMENTS[f.asset].digits;
  refresh();
  return [
    header,
    card('La operación',
      field('Activo', select(f.asset, Object.fromEntries(Object.keys(INSTRUMENTS).map((k) => [k, k])), (v) => { f.asset = v; ctx.render(); })),
      field('Dirección', seg(f.dir, { buy: 'Comprar', sell: 'Vender' }, (v) => { f.dir = v; ctx.render(); })),
      h('div', { class: 'three' },
        field('Entrada', input('entry', dg === 5 ? '1.10000' : '2669.00')),
        field('Stop', input('stop', '')),
        field('Objetivo', input('tp', ''))),
      field('¿Dónde está el precio en el rango?', select(f.zone, Object.fromEntries(Object.entries(ZONES).map(([k, z]) => [k, `${z.label} · máx ${String(z.maxR).replace('.', ',')}R`])), (v) => { f.zone = v; refresh(); }))),
    card('Checklist (responde con lo que ves, no con lo que quieres ver)',
      h('ul', { class: 'qs' }, MANUAL.map((q) => h('li', {},
        h('span', {}, q.label),
        seg(f.q[q.id] === true ? 'si' : f.q[q.id] === false ? 'no' : '', { si: 'Sí', no: 'No' }, (v) => { f.q[q.id] = v === 'si'; ctx.render(); })))),
      field('¿Por qué entras? Punto por punto', h('textarea', { rows: 3, value: f.reason, placeholder: 'R a la izquierda en…, barrida de…, cierre de M15…', oninput: (e) => { f.reason = e.target.value; refresh(); } }))),
    out,
    h('button', { class: 'ghost', onclick: () => { ctx.ui.entry = null; ctx.render(); } }, 'Vaciar formulario'),
  ];
}
