// Métricas: primero el cumplimiento, luego los números, siempre con su margen de error.
import { h, card, pct, rStr, usd } from './dom.js';
import { summary, byAsset, byWindow, bySetup, byWeekday, cleanStreak, groupBy, validTrades } from '../metrics.js';
import { closedTrades } from '../rules/account.js';
import { accountOf, accountName, findAccount, tradesOf, TYPES, STATUS } from '../accounts.js';
import { fmtDate } from '../time.js';
import { acctTabs } from './acctTabs.js';
import { MIN_TRADES } from '../rules/challenge.js';

function table(title, rows) {
  if (!rows.length) return null;
  return card(title, h('table', {},
    h('tr', {}, ['', 'Ops', 'Acierto', 'Expect.', 'R total'].map((x) => h('th', {}, x))),
    rows.map((r) => h('tr', {}, h('td', {}, r.key), h('td', {}, r.n), h('td', {}, pct(r.wr)), h('td', { class: r.expectancy > 0 ? 'pos' : r.expectancy < 0 ? 'neg' : '' }, rStr(r.expectancy)), h('td', {}, rStr(r.sumR))))),
    rows.some((r) => r.n < 10) ? h('p', { class: 'muted' }, 'Grupos con menos de 10 operaciones: no saques conclusiones todavía.') : null);
}

// Ficha de una cuenta: tipo, estado y dinero (el forward test va solo en R).
function accountCard(ctx, id, tr) {
  const a = findAccount(ctx.state, id);
  if (!a) return null;
  const money = a.type !== 'forward';
  const pnl = closedTrades(tr).reduce((x, t) => x + (typeof t.pnl === 'number' ? t.pnl : 0), 0);
  const dates = tr.map((t) => t.date).filter(Boolean).sort();
  const cells = [
    ['Tipo', TYPES[a.type] || a.type], ['Estado', STATUS[a.status] || a.status],
    ['Primera / última', dates.length ? `${fmtDate(dates[0])} – ${fmtDate(dates.at(-1))}` : '—'],
    ['Activa para operar', ctx.state.config.activeAccount === id ? 'Sí' : 'No'],
  ];
  if (money) cells.push(['Tamaño', usd(a.size || 0)], ['Resultado', usd(pnl)], ['Balance', usd((a.size || 0) + pnl)]);
  return card(a.name, h('div', { class: 'grid' }, cells.map(([k, v]) => h('div', { class: 'cell' }, h('small', {}, k), h('b', { class: k === 'Resultado' ? (pnl >= 0 ? 'pos' : 'neg') : '' }, v)))),
    money ? h('p', { class: 'muted' }, 'Resultado = suma del beneficio de cada operación tal como lo registraste.') : h('p', { class: 'muted' }, 'Forward test: sin dinero, solo cuenta la R.'));
}

export function renderStats(ctx) {
  const { sel, bar } = acctTabs(ctx);
  const tr = tradesOf(ctx.state, sel);
  const s = summary(tr);
  const valid = validTrades(tr).length;
  const left = Math.max(0, MIN_TRADES - valid);
  const [lo, hi] = s.ci;
  return [
    h('header', { class: 'top' }, h('h1', {}, 'Métricas'), h('p', {}, 'Tu métrica principal no es el P&L: es operar según el plan.')),
    bar,
    sel === 'all' ? null : accountCard(ctx, sel, tr),
    h('section', { class: `status ${s.cleanPct >= 0.95 ? 'go' : 'stop'}` },
      h('small', {}, 'Operaciones con checklist completo'),
      h('b', { class: 'big' }, s.n ? pct(s.cleanPct) : '—'),
      h('p', {}, `${s.broken} fuera de plan o incompletas de ${s.n}. Objetivo: 100 %.${sel === 'all' ? ` Racha de días bien hechos: ${cleanStreak(ctx.state)}.` : ''}`)),
    card(`Muestra válida: ${valid} de ${MIN_TRADES}`,
      h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, (valid / MIN_TRADES) * 100)}%` })),
      h('p', {}, left ? `Faltan ${left} operaciones dentro de plan antes de pensar en un reto. Las ${s.n - valid} fuera de plan o incompletas no cuentan.` : 'Muestra mínima alcanzada con operaciones dentro de plan.'),
      s.n ? h('p', { class: 'muted' }, `Con ${s.n} operaciones, tu acierto real está entre el ${pct(lo)} y el ${pct(hi)} (95 % de confianza). Un ${pct(s.wr)} medido no demuestra un ${pct(s.wr)} real.`) : null),
    card('Números',
      h('div', { class: 'grid' }, [
        ['Acierto', s.n ? pct(s.wr) : '—'], ['Expectancy', rStr(s.expectancy)], ['Profit factor', s.pf === Infinity ? '∞' : s.pf.toLocaleString('es-ES', { maximumFractionDigits: 2 })],
        ['R acumulada', rStr(s.sumR)], ['Ganadas / perdidas / BE', `${s.wins} / ${s.losses} / ${s.be}`], ['Peor racha (R)', rStr(-s.maxDD)],
      ].map(([k, v]) => h('div', { class: 'cell' }, h('small', {}, k), h('b', {}, v)))),
      h('p', { class: 'muted' }, 'Con ratio 1:2, el acierto mínimo para no perder es el 33,3 %.')),
    sel === 'all' ? table('Por cuenta', groupBy(tr, (t) => accountName(ctx.state, accountOf(t)))) : null,
    table('Setup completo frente a fuera de plan', bySetup(tr)),
    table('Por activo', byAsset(tr)),
    table('Por ventana', byWindow(tr)),
    table('Por día de la semana', byWeekday(tr)),
  ];
}
