// Hoy: estado del día, ventanas, números, noticias, rutina y posición abierta.
import { h, card, usd, field, select, seg } from './dom.js';
import { status } from '../rules/account.js';
import { windowsInMadrid } from '../rules/gate.js';
import { todayEvents } from '../news.js';
import { madrid, newYork, hm, fmtDate, fmtTime, nyToMadridOffset } from '../time.js';
import { INSTRUMENTS, ZONES, LAST_ENTRY_NY, LUNCH_NY } from '../config.js';
import { renderClose } from './close.js';

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

function windowsCard(now) {
  const md = madrid(now);
  const off = nyToMadridOffset(now);
  const ws = windowsInMadrid(now);
  const rows = ws.map((w) => {
    const st = md.min >= w.endMd ? 'pasada' : md.min >= w.startMd ? 'AHORA' : `en ${hm(w.startMd - md.min)}`;
    return h('div', { class: `row ${st === 'AHORA' ? 'live' : ''}` }, h('span', {}, `${w.from}–${w.to}`), h('span', {}, w.label), h('b', {}, md.wd >= 6 ? '—' : st));
  });
  return card('Ventanas de hoy',
    h('div', { class: 'row' }, h('span', {}, `${hm(ws[0].startMd - 90)}–${hm(ws[0].startMd - 30)}`), h('span', {}, 'Rutina antes de operar'), h('b', {}, '')),
    rows,
    h('p', { class: 'muted' }, `No abres nuevas a partir de las ${hm(LAST_ENTRY_NY + off)}. A las ${hm(LUNCH_NY + off)} (London Lunch) revisas: si va en contra y no ha llegado, cierras.`),
    off !== 360 ? h('p', { class: 'warn' }, `Semana de cambio de hora: Nueva York va ${off / 60} h por detrás.`) : null);
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

function routineCard(ctx, st) {
  const day = ctx.state.days[st.today];
  const plan = day?.plan;
  if (plan?.noTrade) {
    return card('Plan del día', h('p', { class: 'good' }, `Hoy: "${plan.noTrade}". No se opera. Es un día bien hecho.`));
  }
  if (plan) {
    return card('Plan del día',
      h('p', {}, h('b', {}, `${plan.dir === 'buy' ? 'Comprar' : 'Vender'} ${plan.asset}`), ` · objetivo ${plan.target || '—'} · ${ZONES[plan.zone]?.label || ''}`),
      plan.eurgbp ? h('p', { class: 'muted' }, `EURGBP: ${plan.eurgbp}`) : null,
      plan.notes ? h('p', { class: 'muted' }, plan.notes) : null,
      h('div', { class: 'actions' },
        h('button', { class: 'primary', onclick: () => ctx.go('entrada') }, 'Ir al checklist de entrada'),
        st.day.trades === 0 ? h('button', { onclick: () => ctx.commit((s) => { s.days[st.today].plan = { noTrade: 'Sin alineación', at: new Date().toISOString() }; }) }, 'No hay alineación: cerrar el día') : null));
  }
  if (st.md.wd >= 6) return null;
  const f = (ctx.ui.routine ||= { asset: 'EURUSD', dir: 'buy', zone: 'optima', steps: {} });
  const steps = [
    ['cal', 'Calendario revisado: anoto la noticia del día y su hora.'],
    ['r', 'R de timeframe alto marcadas (M, W, D, 12h, 8h, 4h), solo la más a la izquierda.'],
    ['obj', 'Objetivo realista más cercano elegido (40–60 pips en EURUSD/GBPUSD).'],
  ];
  const allSteps = steps.every(([k]) => f.steps[k]);
  return card('Rutina antes de operar',
    h('ul', { class: 'steps' }, steps.map(([k, l]) => h('li', {}, h('label', {},
      h('input', { type: 'checkbox', checked: !!f.steps[k], onchange: (e) => { f.steps[k] = e.target.checked; ctx.render(); } }), l)))),
    allSteps ? h('div', {},
      h('p', {}, h('b', {}, '¿Hay una R alineada con el objetivo?')),
      field('Activo', select(f.asset, Object.fromEntries(Object.keys(INSTRUMENTS).map((k) => [k, k])), (v) => { f.asset = v; })),
      field('Dirección', seg(f.dir, { buy: 'Comprar', sell: 'Vender' }, (v) => { f.dir = v; ctx.render(); })),
      field('Objetivo', h('input', { value: f.target || '', placeholder: 'precio o zona', oninput: (e) => { f.target = e.target.value; } })),
      field('Zona prevista', select(f.zone, Object.fromEntries(Object.entries(ZONES).map(([k, z]) => [k, z.label])), (v) => { f.zone = v; })),
      field('EURGBP (fuerte / débil)', h('input', { value: f.eurgbp || '', placeholder: 'opcional', oninput: (e) => { f.eurgbp = e.target.value; } })),
      field('Notas', h('textarea', { rows: 2, value: f.notes || '', oninput: (e) => { f.notes = e.target.value; } })),
      h('div', { class: 'actions' },
        h('button', { class: 'primary', onclick: () => ctx.commit((s) => {
          s.days[st.today] = { plan: { asset: f.asset, dir: f.dir, target: f.target, zone: f.zone, eurgbp: f.eurgbp, notes: f.notes, at: new Date().toISOString() } };
          ctx.ui.routine = null;
        }) }, 'Sí: guardar plan'),
        h('button', { onclick: () => ctx.commit((s) => { s.days[st.today] = { plan: { noTrade: 'Sin R', at: new Date().toISOString() } }; ctx.ui.routine = null; }) }, 'No: hoy no se opera')))
      : h('p', { class: 'muted' }, 'Marca los tres pasos para escribir el plan.'));
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
    routineCard(ctx, st),
    windowsCard(now),
    newsCard(ctx, now),
    numbersCard(ctx, st),
    md.wd === 7 ? card('Revisión del domingo', h('p', {}, 'Cuenta las reglas rotas de la semana (deben ser cero) y marca las R de timeframe alto para la semana que viene.'),
      h('button', { onclick: () => ctx.go('metricas') }, 'Ver métricas')) : null,
  ];
}
