// Diario: operaciones y días sin operación, con autopsia de cada una.
import { h, card, field, select, seg, num, rStr, usd } from './dom.js';
import { INSTRUMENTS } from '../config.js';
import { fmtDate, madrid } from '../time.js';
import { uid } from '../store.js';
import { accountOf, accountName, findAccount, tradesOf } from '../accounts.js';
import { acctTabs } from './acctTabs.js';

const WINDOWS = ['Londres 9:00', 'Londres 10:00', 'Londres', 'Apertura semanal', 'Nueva York', 'Fuera de ventana'];

function postmortem(t) {
  const lines = [];
  if (t.outOfPlan) lines.push('Registrada fuera de plan.');
  for (const f of t.failed || []) lines.push(`Falló: ${f}`);
  if (t.flags?.stopMoved) lines.push('Moviste el stop en contra (R6).');
  if (t.flags?.added) lines.push('Añadiste a la posición (R7).');
  if (t.flags?.fear) lines.push('Cerraste antes del objetivo por miedo: es el patrón del colapso post-fase.');
  if (t.checklistOk && !t.outOfPlan && t.r < 0) lines.push('Proceso correcto con resultado negativo: es una pérdida buena. No cambies nada por esta.');
  if ((!t.checklistOk || t.outOfPlan) && t.r > 0) lines.push('Ganó fuera de plan: es la más peligrosa, porque refuerza el hábito.');
  return lines;
}

function tradeCard(ctx, t) {
  const open = ctx.ui.openId === t.id;
  const clean = t.checklistOk && !t.outOfPlan && !t.flags?.ruleBroken;
  return h('section', { class: 'card trade', onclick: () => { ctx.ui.openId = open ? null : t.id; ctx.render(); } },
    h('div', { class: 'row' },
      h('span', {}, fmtDate(t.date)),
      h('span', {}, `${t.asset}${t.dir ? (t.dir === 'buy' ? ' ↑' : ' ↓') : ''}`, t.window ? h('small', {}, ` · ${t.window}`) : null),
      h('b', { class: t.status === 'open' ? '' : t.r > 0 ? 'pos' : t.r < 0 ? 'neg' : '' }, t.status === 'open' ? 'abierta' : rStr(t.r))),
    h('div', { class: 'badges' },
      ctx.ui.acct === 'all' ? h('span', { class: 'b acct' }, accountName(ctx.state, accountOf(t))) : null,
      h('span', { class: clean ? 'b ok' : 'b no' }, clean ? 'checklist completo' : 'fuera de plan / incompleto'),
      typeof t.pnl === 'number' && findAccount(ctx.state, accountOf(t))?.type !== 'forward' ? h('span', { class: 'b' }, usd(t.pnl)) : null),
    open ? h('div', { class: 'detail' },
      t.entry ? h('p', { class: 'muted' }, `Entrada ${t.entry} · stop ${t.stop} · objetivo ${t.tp} · ${t.lots} lotes · riesgo ${usd(t.riskUSD)}`) : null,
      t.reason ? h('p', {}, h('b', {}, 'Motivo: '), t.reason) : null,
      t.note ? h('p', {}, h('b', {}, 'Nota: '), t.note) : null,
      h('ul', { class: 'pm' }, postmortem(t).map((l) => h('li', {}, l))),
      h('label', { class: 'field', onclick: (e) => e.stopPropagation() }, h('span', {}, 'Cuenta'),
        select(accountOf(t), Object.fromEntries(ctx.state.accounts.map((a) => [a.id, a.name])), (v) => ctx.commit((s) => { s.trades.find((x) => x.id === t.id).accountId = v; }))),
      h('button', { class: 'ghost', onclick: (e) => {
        e.stopPropagation();
        if (confirm('¿Borrar esta operación? Solo para errores al registrar.')) ctx.commit((s) => { s.trades = s.trades.filter((x) => x.id !== t.id); });
      } }, 'Borrar')) : null);
}

function addPast(ctx) {
  const def = ctx.ui.acct && ctx.ui.acct !== 'all' ? ctx.ui.acct : ctx.state.config.activeAccount;
  const f = (ctx.ui.past ||= { date: madrid(ctx.now()).date, asset: 'EURUSD', dir: 'buy', r: '', setup: 'si', window: 'Londres 9:00', note: '', accountId: def });
  if (!ctx.ui.showPast) return h('button', { onclick: () => { ctx.ui.past = null; ctx.ui.showPast = true; ctx.render(); } }, 'Añadir operación pasada');
  return card('Operación pasada',
    field('Cuenta', select(f.accountId, Object.fromEntries(ctx.state.accounts.map((a) => [a.id, a.name])), (v) => { f.accountId = v; })),
    field('Fecha', h('input', { type: 'date', value: f.date, oninput: (e) => { f.date = e.target.value; } })),
    field('Activo', select(f.asset, Object.fromEntries(Object.keys(INSTRUMENTS).map((k) => [k, k])), (v) => { f.asset = v; })),
    field('Dirección', seg(f.dir, { buy: 'Compra', sell: 'Venta' }, (v) => { f.dir = v; ctx.render(); })),
    field('Resultado en R', h('input', { inputmode: 'decimal', value: f.r, placeholder: '+2, −1 o 0 (break even = 0, nunca "BE")', oninput: (e) => { f.r = e.target.value; } })),
    field('¿Setup completo?', seg(f.setup, { si: 'Sí, los 6 puntos', no: 'No' }, (v) => { f.setup = v; ctx.render(); })),
    field('Ventana', select(f.window, Object.fromEntries(WINDOWS.map((w) => [w, w])), (v) => { f.window = v; })),
    field('Nota', h('textarea', { rows: 2, value: f.note, oninput: (e) => { f.note = e.target.value; } })),
    h('div', { class: 'actions' },
      h('button', { class: 'primary', onclick: () => {
        const r = num(f.r);
        if (r === null) { alert('Indica el resultado en R.'); return; }
        ctx.commit((s) => {
          s.trades.push({ id: uid(), accountId: f.accountId, date: f.date || null, asset: f.asset, dir: f.dir, r, status: 'closed', checklistOk: f.setup === 'si', outOfPlan: false, window: f.window, note: f.note, riskUSD: s.config.startBalance * 0.005, closedAt: `${f.date}T12:00:00`, source: 'manual' });
          ctx.ui.past = null; ctx.ui.showPast = false;
        });
      } }, 'Guardar'),
      h('button', { onclick: () => { ctx.ui.showPast = false; ctx.render(); } }, 'Cancelar')));
}

export function renderJournal(ctx) {
  const s = ctx.state;
  const { sel, bar } = acctTabs(ctx);
  const trades = [...tradesOf(s, sel)].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.closedAt || '').localeCompare(a.closedAt || ''));
  const noTrade = Object.entries(s.days).filter(([, d]) => d.plan?.noTrade).sort((a, b) => b[0].localeCompare(a[0]));
  return [
    h('header', { class: 'top' }, h('h1', {}, 'Diario'), h('p', {}, `${trades.length} operaciones${sel === 'all' ? ` · ${noTrade.length} días sin operar` : ''}. Toca una para ver su autopsia.`)),
    bar,
    addPast(ctx),
    trades.length ? trades.map((t) => tradeCard(ctx, t)) : card(null, h('p', { class: 'muted' }, sel === 'all' ? 'Aún no hay operaciones. Importa tu Excel en Más → Copia de seguridad.' : 'Esta cuenta aún no tiene operaciones.')),
    sel === 'all' && noTrade.length ? card('Días sin operación (cuentan como días bien hechos)',
      noTrade.map(([d, v]) => h('div', { class: 'row' }, h('span', {}, fmtDate(d)), h('span', {}, v.plan.noTrade), h('b', { class: 'pos' }, '✓')))) : null,
  ];
}
