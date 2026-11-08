// Hoy: estado del día, ventanas, números, noticias, rutina y posición abierta.
import { h, card, usd } from './dom.js';
import { status } from '../rules/account.js';
import { todayEvents } from '../news.js';
import { madrid, newYork, hm, fmtDate, fmtTime } from '../time.js';
import { renderClose } from './close.js';
import { routineCard } from './routine.js';
import { scheduleCard } from './schedule.js';

const untilStr = (ms) => {
  const d = new Date(ms);
  return `${fmtDate(madrid(d).date)} a las ${fmtTime(d)}`;
};

function statusCard(st) {
  if (st.canTrade) {
    return h('section', { class: 'status go' }, h('b', {}, 'PUEDES OPERAR'), h('p', {}, 'Solo si el checklist sale entero en verde.'));
  }
  return h('section', { class: 'status stop' }, h('b', {}, st.blocks.some((b) => b.code === 'weekend') ? 'MERCADO CERRADO' : 'NO OPERAS'),
    h('ul', {}, st.blocks.map((b) => h('li', {}, b.msg, b.until ? h('small', {}, ` Hasta el ${untilStr(b.until)}.`) : null))));
}


function numbersCard(ctx, st) {
  const cfg = ctx.state.config;
  const cells = [
    ['Riesgo por operación', `${usd(st.risk.usd)} · ${st.risk.pct.toLocaleString('es-ES')} %`],
    ['Hoy', `${usd(st.day.pnl)} / tope −${cfg.ownDailyUSD} $`],
    ['Semana', `${usd(st.week.pnl)} / tope −${cfg.weeklyUSD} $`],
    ['Operaciones semana', `${st.week.trades} / ${cfg.maxTradesWeek}`],
  ];
  if (cfg.mode !== 'forward') {
    cells.push(['Balance', usd(st.account.balance)], ['Margen hasta el suelo', usd(st.account.balance - st.account.floor)]);
    cells.push(['Límite de la firma hoy', `${usd(st.firmDailyLeft)} libres`]);
  }
  return card(cfg.mode === 'forward' ? 'Números (forward test, cuenta virtual)' : 'Números',
    h('div', { class: 'grid' }, cells.map(([k, v]) => h('div', { class: 'cell' }, h('small', {}, k), h('b', {}, v)))),
    st.risk.notes.map((n) => h('p', { class: 'warn' }, n)),
    cfg.mode !== 'forward' ? h('p', { class: 'muted' }, 'El día de la firma se reinicia a las 22:00 (23:00 en verano), hora de España.') : null);
}

function newsCard(ctx, now) {
  const evs = todayEvents(ctx.events(), now);
  const c = ctx.calendar;
  return card('Noticias de hoy (USD · EUR · GBP)',
    evs.length ? h('div', {}, evs.map((e) => h('div', { class: `row news ${e.impact === 'High' ? 'high' : 'med'}` },
      h('span', {}, fmtTime(new Date(e.time))), h('span', {}, `${e.country} · ${e.title}`), h('b', {}, e.impact === 'High' ? 'ALTO' : 'medio'))))
      : h('p', { class: 'muted' }, c.error ? 'No se ha podido cargar el calendario. Míralo en Forex Factory y añade la noticia en Más.' : 'Sin noticias de impacto medio o alto.'),
    c.fetchedAt ? h('p', { class: 'muted' }, `Calendario actualizado: ${fmtDate(madrid(new Date(c.fetchedAt)).date)} ${fmtTime(new Date(c.fetchedAt))}.`) : null);
}


export function renderToday(ctx) {
  const now = ctx.now();
  const st = status(ctx.state, now);
  const md = st.md;
  const night = md.h >= 23 || md.h < 7;
  const open = st.open;
  return [
    h('header', { class: 'top' }, h('h1', {}, 'Hoy'), h('p', {}, `${fmtDate(md.date)} · ${hm(md.min)} España · ${hm(newYork(now).min)} NY`)),
    night ? h('section', { class: 'status night' }, h('b', {}, 'ES DE MADRUGADA'), h('p', {}, 'Operar a estas horas ha sido un problema, no una ventaja. No operas Asia. Cierra la plataforma y vete a dormir.')) : null,
    open ? card(`Posición abierta: ${open.dir === 'buy' ? 'compra' : 'venta'} ${open.asset}`,
      h('p', {}, `Entrada ${open.entry} · stop ${open.stop} · objetivo ${open.tp} · ${open.lots} lotes`),
      md.wd === 5 ? h('p', { class: 'warn' }, 'Es viernes: cierra antes de la noche. Nada de fin de semana.') : null,
      h('p', { class: 'muted' }, 'El stop nunca se mueve en contra (R6). No añades a la posición (R7).'),
      renderClose(ctx, open)) : null,
    statusCard(st),
    routineCard(ctx, st, now),
    scheduleCard(ctx, now),
    newsCard(ctx, now),
    numbersCard(ctx, st),
    md.wd === 7 ? card('Revisión del domingo', h('p', {}, 'Cuenta las reglas rotas de la semana (deben ser cero) y marca las R de timeframe alto para la semana que viene.'),
      h('button', { onclick: () => ctx.go('metricas') }, 'Ver métricas')) : null,
  ];
}
