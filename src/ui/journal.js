// Diario: operaciones y días sin operación, con autopsia de cada una.
import { h, card, field, select, seg, num, rStr, usd, pctStr, signed } from './dom.js';
import { INSTRUMENTS } from '../config.js';
import { fmtDate, madrid } from '../time.js';
import { uid } from '../store.js';
import { accountOf, accountName, findAccount, tradesOf, pctOf, isMoney } from '../accounts.js';
import { moneyFields, readMoney, moneyForm } from './money.js';
import { acctTabs } from './acctTabs.js';

const OTHER = '__otro';
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

// Desglose beneficio / swap / comisión / neto, editable en cuentas con dinero.
function moneyBlock(ctx, t) {
  if (t.status !== 'closed' || !isMoney(ctx.state, accountOf(t))) return null;
  const stop = (e) => e.stopPropagation();
  if (ctx.ui.editMoney === t.id) {
    const f = (ctx.ui.moneyForm ||= moneyForm(t));
    return h('div', { class: 'accform', onclick: stop }, moneyFields(f),
      h('div', { class: 'actions' },
        h('button', { class: 'primary', onclick: () => {
          const m = readMoney(f);
          if (!m) { alert('Escribe el beneficio que marca MT5.'); return; }
          ctx.commit((s) => { Object.assign(s.trades.find((x) => x.id === t.id), m); ctx.ui.editMoney = null; ctx.ui.moneyForm = null; });
        } }, 'Guardar'),
        h('button', { onclick: () => { ctx.ui.editMoney = null; ctx.ui.moneyForm = null; ctx.render(); } }, 'Cancelar')));
  }
  const has = typeof t.gross === 'number';
  return h('div', { onclick: stop },
    h('p', { class: 'muted' }, has
      ? `Beneficio ${usd(t.gross)} · swap ${usd(t.swap || 0)} · comisión ${usd(t.commission || 0)} → neto ${usd(t.pnl)}`
      : `Neto ${usd(t.pnl ?? 0)} (sin desglose de swap y comisión)`),
    h('button', { class: 'ghost', onclick: () => { ctx.ui.editMoney = t.id; ctx.ui.moneyForm = null; ctx.render(); } }, has ? 'Editar beneficio, swap y comisión' : 'Añadir swap y comisión'));
}

function tradeCard(ctx, t) {
  const open = ctx.ui.openId === t.id;
  const clean = t.checklistOk && !t.outOfPlan && !t.flags?.ruleBroken;
  const p = pctOf(ctx.state, t);
  const val = p !== null ? p : t.r;
  return h('section', { class: 'card trade', onclick: () => { ctx.ui.openId = open ? null : t.id; ctx.render(); } },
    h('div', { class: 'row' },
      h('span', {}, fmtDate(t.date)),
      h('span', {}, `${t.asset}${t.dir ? (t.dir === 'buy' ? ' ↑' : ' ↓') : ''}`, t.window ? h('small', {}, ` · ${t.window}`) : null),
      h('b', { class: t.status === 'open' ? '' : val > 0 ? 'pos' : val < 0 ? 'neg' : '' }, t.status === 'open' ? 'abierta' : p !== null ? pctStr(p) : rStr(t.r))),
    h('div', { class: 'badges' },
      ctx.ui.acct === 'all' ? h('span', { class: 'b acct' }, accountName(ctx.state, accountOf(t))) : null,
      h('span', { class: clean ? 'b ok' : 'b no' }, clean ? 'checklist completo' : 'fuera de plan / incompleto'),
      typeof t.pnl === 'number' && findAccount(ctx.state, accountOf(t))?.type !== 'forward' ? h('span', { class: 'b' }, usd(t.pnl)) : null),
    open ? h('div', { class: 'detail' },
      t.entry ? h('p', { class: 'muted' }, `Entrada ${t.entry} · stop ${t.stop} · objetivo ${t.tp} · ${t.lots} lotes · riesgo ${usd(t.riskUSD)}`) : null,
      moneyBlock(ctx, t),
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
  const other = f.asset === OTHER;
  if (!ctx.ui.showPast) return h('button', { onclick: () => { ctx.ui.past = null; ctx.ui.showPast = true; ctx.render(); } }, 'Añadir operación pasada');
  return card('Operación pasada',
    field('Cuenta', select(f.accountId, Object.fromEntries(ctx.state.accounts.map((a) => [a.id, a.name])), (v) => { f.accountId = v; ctx.render(); })),
    field('Fecha', h('input', { type: 'date', value: f.date, oninput: (e) => { f.date = e.target.value; } })),
    field('Activo', select(f.asset, { ...Object.fromEntries(Object.keys(INSTRUMENTS).map((k) => [k, k])), [OTHER]: 'Otro (fuera del plan)' }, (v) => { f.asset = v; ctx.render(); })),
    other ? h('div', { class: 'warn' },
      h('p', {}, h('b', {}, 'Activo fuera del plan. '), 'R5: solo EURUSD, GBPUSD y XAUUSD. Se guarda como regla rota: 24 h sin operar desde la hora de entrada, y no cuenta para la muestra válida.'),
      field('¿Qué activo?', h('input', { value: f.other || '', placeholder: 'ej. GER40', autocapitalize: 'characters', oninput: (e) => { f.other = e.target.value; } }))) : null,
    field('Hora de entrada (España)', h('input', { type: 'time', value: f.time || '', oninput: (e) => { f.time = e.target.value; } }), other ? 'Desde esta hora cuentan las 24 h.' : 'Opcional.'),
    field('Dirección', seg(f.dir, { buy: 'Compra', sell: 'Venta' }, (v) => { f.dir = v; ctx.render(); })),
    isMoney(ctx.state, f.accountId) ? moneyFields(f.money ||= {})
      : field('Resultado en R', signed(f.r, '+2, −1 o 0 (break even = 0)', (v) => { f.r = v; })),
    other ? null : field('¿Setup completo?', seg(f.setup, { si: 'Sí, los 6 puntos', no: 'No' }, (v) => { f.setup = v; ctx.render(); })),
    field('Ventana', select(f.window, Object.fromEntries(WINDOWS.map((w) => [w, w])), (v) => { f.window = v; })),
    field('Nota', h('textarea', { rows: 2, value: f.note, oninput: (e) => { f.note = e.target.value; } })),
    h('div', { class: 'actions' },
      h('button', { class: 'primary', onclick: () => {
        const money = isMoney(ctx.state, f.accountId);
        const m = money ? readMoney(f.money || {}) : null;
        if (money && !m) { alert('Escribe el beneficio que marca MT5.'); return; }
        const risk = (findAccount(ctx.state, f.accountId)?.size || 5000) * 0.005;
        const r = money ? Math.round((m.pnl / risk) * 100) / 100 : num(f.r);
        if (r === null) { alert('Indica el resultado en R.'); return; }
        const name = other ? (f.other || '').trim().toUpperCase().replace(/[^A-Z0-9.]/g, '').slice(0, 12) : f.asset;
        if (!name) { alert('Escribe qué activo operaste.'); return; }
        if (other && !f.time) { alert('Pon la hora de entrada: desde ahí cuentan las 24 h sin operar.'); return; }
        const openedAt = f.time && f.date ? `${f.date}T${f.time}:00` : undefined;
        ctx.commit((s) => {
          s.trades.push({ id: uid(), ...(m || {}), accountId: f.accountId, date: f.date || null, asset: name, dir: f.dir, r, status: 'closed',
            checklistOk: !other && f.setup === 'si', outOfPlan: other, failed: other ? ['Activo fuera del plan (R5: solo EURUSD, GBPUSD y XAUUSD)'] : undefined,
            window: f.window, note: f.note, riskUSD: risk, openedAt, closedAt: openedAt || `${f.date}T12:00:00`, source: 'manual' });
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
