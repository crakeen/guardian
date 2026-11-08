// Métricas: primero el cumplimiento, luego los números, siempre con su margen de error.
import { h, card, pct, rStr } from './dom.js';
import { summary, byAsset, byWindow, bySetup, byWeekday, cleanStreak } from '../metrics.js';
import { MIN_TRADES } from '../rules/challenge.js';

function table(title, rows) {
  if (!rows.length) return null;
  return card(title, h('table', {},
    h('tr', {}, ['', 'Ops', 'Acierto', 'Expect.', 'R total'].map((x) => h('th', {}, x))),
    rows.map((r) => h('tr', {}, h('td', {}, r.key), h('td', {}, r.n), h('td', {}, pct(r.wr)), h('td', { class: r.expectancy > 0 ? 'pos' : r.expectancy < 0 ? 'neg' : '' }, rStr(r.expectancy)), h('td', {}, rStr(r.sumR))))),
    rows.some((r) => r.n < 10) ? h('p', { class: 'muted' }, 'Grupos con menos de 10 operaciones: no saques conclusiones todavía.') : null);
}

export function renderStats(ctx) {
  const tr = ctx.state.trades;
  const s = summary(tr);
  const left = Math.max(0, MIN_TRADES - s.n);
  const [lo, hi] = s.ci;
  return [
    h('header', { class: 'top' }, h('h1', {}, 'Métricas'), h('p', {}, 'Tu métrica principal no es el P&L: es operar según el plan.')),
    h('section', { class: `status ${s.cleanPct >= 0.95 ? 'go' : 'stop'}` },
      h('small', {}, 'Operaciones con checklist completo'),
      h('b', { class: 'big' }, s.n ? pct(s.cleanPct) : '—'),
      h('p', {}, `${s.broken} fuera de plan o incompletas de ${s.n}. Objetivo: 100 %. Racha de días bien hechos: ${cleanStreak(ctx.state)}.`)),
    card(`Muestra: ${s.n} de ${MIN_TRADES}`,
      h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, (s.n / MIN_TRADES) * 100)}%` })),
      h('p', {}, left ? `Faltan ${left} operaciones antes de que estos números signifiquen algo y antes de pensar en un reto.` : 'Muestra mínima alcanzada.'),
      s.n ? h('p', { class: 'muted' }, `Con ${s.n} operaciones, tu acierto real está entre el ${pct(lo)} y el ${pct(hi)} (95 % de confianza). Un ${pct(s.wr)} medido no demuestra un ${pct(s.wr)} real.`) : null),
    card('Números',
      h('div', { class: 'grid' }, [
        ['Acierto', s.n ? pct(s.wr) : '—'], ['Expectancy', rStr(s.expectancy)], ['Profit factor', s.pf === Infinity ? '∞' : s.pf.toLocaleString('es-ES', { maximumFractionDigits: 2 })],
        ['R acumulada', rStr(s.sumR)], ['Ganadas / perdidas / BE', `${s.wins} / ${s.losses} / ${s.be}`], ['Peor racha (R)', rStr(-s.maxDD)],
      ].map(([k, v]) => h('div', { class: 'cell' }, h('small', {}, k), h('b', {}, v)))),
      h('p', { class: 'muted' }, 'Con ratio 1:2, el acierto mínimo para no perder es el 33,3 %.')),
    table('Setup completo frente a fuera de plan', bySetup(tr)),
    table('Por activo', byAsset(tr)),
    table('Por ventana', byWindow(tr)),
    table('Por día de la semana', byWeekday(tr)),
  ];
}
