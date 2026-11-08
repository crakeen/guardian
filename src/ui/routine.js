// Rutina antes de operar (Protocolo Diciembre, punto 4), paso a paso.
// El plan solo se guarda con los seis pasos hechos. Sin R alineada, hoy no se opera.
import { h, card, field, select, seg, num } from './dom.js';
import { INSTRUMENTS, ZONES } from '../config.js';
import { todayEvents, ratesToday } from '../news.js';
import { fmtTime } from '../time.js';

const TFS = [['M', 'Mensual'], ['W', 'Semanal'], ['D', 'Diario'], ['12h', '12 h'], ['8h', '8 h'], ['4h', '4 h']];
const DAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const PAIRS_BY_CCY = { USD: ['EURUSD', 'GBPUSD', 'XAUUSD'], EUR: ['EURUSD'], GBP: ['GBPUSD'] };

function step(n, title, done, ...body) {
  return h('div', { class: `rstep ${done ? 'done' : ''}` },
    h('div', { class: 'rstep-head' }, h('span', { class: 'num' }, done ? '✓' : n), h('b', {}, title)),
    h('div', { class: 'rstep-body' }, ...body));
}

const tick = (checked, label, onchange) => h('label', { class: 'tick' },
  h('input', { type: 'checkbox', checked: !!checked, onchange: (e) => onchange(e.target.checked) }), h('span', {}, label));

function newsStep(ctx, f, now, wd) {
  const evs = todayEvents(ctx.events(), now);
  const rates = ratesToday(ctx.events(), now);
  const high = evs.filter((e) => e.impact === 'High');
  return step(1, 'Calendario económico (Forex Factory, impacto 2–3)', f.cal,
    evs.length ? h('div', { class: 'mini' }, evs.map((e) => h('div', { class: `row news ${e.impact === 'High' ? 'high' : 'med'}` },
      h('span', {}, fmtTime(new Date(e.time))), h('span', {}, `${e.country} · ${e.title}`), h('b', {}, e.impact === 'High' ? 'ALTO' : 'medio'))))
      : h('p', { class: 'muted' }, 'La app no tiene noticias de impacto medio o alto para hoy. Compruébalo igualmente en Forex Factory.'),
    high.length ? h('p', { class: 'warn' }, `Noticia roja: no entras en las 2 horas anteriores (${[...new Set(high.map((e) => `${e.country} ${fmtTime(new Date(e.time))}`))].join(', ')}).`) : null,
    rates.map((e) => h('p', { class: 'warn' }, `Tipos de interés ${e.country} a las ${fmtTime(new Date(e.time))}: no operas la sesión de antes en ${PAIRS_BY_CCY[e.country].join(' / ')}.${e.country === 'USD' && /FOMC|Federal Funds/i.test(e.title) ? ' Día de FOMC: nada después de las 14:00 de Nueva York.' : ''}`)),
    h('p', { class: 'muted' }, `Hoy es ${DAYS[wd]}. Fíjate en el día: un lunes no se comporta como un martes, un miércoles o un jueves.`),
    tick(f.cal, 'He anotado la noticia del día y su hora', (v) => { f.cal = v; ctx.render(); }));
}

function tfStep(ctx, f) {
  const done = TFS.every(([k]) => f.tf[k]);
  return step(2, 'R de timeframe alto', done,
    h('p', { class: 'muted' }, 'Baja de un timeframe grande a uno pequeño y marca solo la R más a la izquierda de cada uno.'),
    h('div', { class: 'tfs' }, TFS.map(([k, l]) => tick(f.tf[k], l, (v) => { f.tf[k] = v; ctx.render(); }))));
}

function targetStep(ctx, f) {
  return step(3, 'Objetivo del día', !!f.target?.trim(),
    h('p', { class: 'muted' }, 'El objetivo realista más cercano: unos 40–60 pips en EURUSD o GBPUSD. Ni el de largo plazo ni el más bonito.'),
    field('Objetivo (precio o zona)', h('input', { value: f.target || '', placeholder: 'ej. 1.1285 / máximo de ayer', oninput: (e) => { f.target = e.target.value; }, onchange: () => ctx.render() })));
}

function alignedStep(ctx, f, today) {
  return step(4, '¿Hay una R alineada con el objetivo?', f.aligned === true,
    seg(f.aligned === true ? 'si' : f.aligned === false ? 'no' : '', { si: 'Sí', no: 'No' }, (v) => { f.aligned = v === 'si'; ctx.render(); }),
    f.aligned === false ? h('div', { class: 'verdict stop' }, h('b', {}, 'HOY NO SE OPERA'),
      h('p', {}, 'Sin R no hay operación. Lo apuntas como "sin R" y cierras la plataforma. Es un día bien hecho.'),
      h('button', { onclick: () => ctx.commit((s) => { s.days[today] = { plan: { noTrade: 'Sin R', at: new Date().toISOString() } }; ctx.ui.routine = null; }) }, 'Cerrar el día: sin R')) : null);
}

function eurgbpStep(ctx, f) {
  const hint = { EUR: 'EUR fuerte: para comprar contra el dólar, EURUSD; para vender, GBPUSD.', GBP: 'GBP fuerte: para comprar contra el dólar, GBPUSD; para vender, EURUSD.', unclear: 'No está claro: no elijas par por EURGBP. Si no hay otra razón clara, mejor oro o no operar.' }[f.eurgbp];
  return step(5, 'EURGBP: par fuerte y par débil', !!f.eurgbp,
    select(f.eurgbp || '', { '': 'Elige…', EUR: 'EUR fuerte / GBP débil', GBP: 'GBP fuerte / EUR débil', unclear: 'No está claro' }, (v) => { f.eurgbp = v; ctx.render(); }),
    hint ? h('p', { class: 'muted' }, hint) : null,
    h('p', { class: 'muted' }, 'Máximo 1 activo y 1 idea al día: nada de comprar uno y vender otro.'));
}

function planStep(ctx, f) {
  const r = num(f.ratio);
  const z = ZONES[f.zone];
  const ratioBad = r !== null && z && (r < 1 || r > z.maxR + 0.05);
  const done = !!(f.asset && f.dir && f.zone && r !== null && !ratioBad);
  return step(6, 'Plan escrito', done,
    field('Activo', select(f.asset, Object.fromEntries(Object.keys(INSTRUMENTS).map((k) => [k, k])), (v) => { f.asset = v; ctx.render(); })),
    f.asset === 'XAUUSD' ? tick(f.smt, 'SMT: he comparado con XAGUSD (lo añades tú; el curso no lo cubre)', (v) => { f.smt = v; }) : null,
    field('Dirección', seg(f.dir, { buy: 'Comprar', sell: 'Vender' }, (v) => { f.dir = v; ctx.render(); })),
    field('Zona prevista', select(f.zone, Object.fromEntries(Object.entries(ZONES).map(([k, zz]) => [k, `${zz.label} · máx ${String(zz.maxR).replace('.', ',')}R`])), (v) => { f.zone = v; ctx.render(); })),
    field('Ratio previsto (R)', h('input', { inputmode: 'decimal', value: f.ratio || '', placeholder: z ? `entre 1 y ${String(z.maxR).replace('.', ',')}` : '', oninput: (e) => { f.ratio = e.target.value; }, onchange: () => ctx.render() })),
    ratioBad ? h('p', { class: 'warn' }, `Ese ratio no encaja con la zona: entre 1R y ${String(z.maxR).replace('.', ',')}R. Si el stop no da ratio, alarga el TP; no aprietes el stop.`) : null,
    field('Notas', h('textarea', { rows: 2, value: f.notes || '', placeholder: 'Qué R, qué liquidez, qué esperas ver a las 9:00', oninput: (e) => { f.notes = e.target.value; } })));
}

export function routineCard(ctx, st, now) {
  const today = st.today;
  const plan = ctx.state.days[today]?.plan;
  if (plan?.noTrade) return card('Plan del día', h('p', { class: 'good' }, `Hoy: "${plan.noTrade}". No se opera. Es un día bien hecho.`));
  if (plan) {
    return card('Plan del día',
      h('p', {}, h('b', {}, `${plan.dir === 'buy' ? 'Comprar' : 'Vender'} ${plan.asset}`), ` · objetivo ${plan.target || '—'}`),
      h('p', { class: 'muted' }, `${ZONES[plan.zone]?.label || ''} · ratio previsto ${String(plan.ratio ?? '—').replace('.', ',')}R${plan.eurgbp ? ` · EURGBP: ${{ EUR: 'EUR fuerte', GBP: 'GBP fuerte', unclear: 'no claro' }[plan.eurgbp]}` : ''}`),
      plan.notes ? h('p', {}, plan.notes) : null,
      h('div', { class: 'actions' },
        h('button', { class: 'primary', onclick: () => ctx.go('entrada') }, 'Ir al checklist de entrada'),
        st.day.trades === 0 ? h('button', { onclick: () => ctx.commit((s) => { s.days[today].plan = { noTrade: 'Sin alineación', at: new Date().toISOString() }; }) }, 'No hay alineación: cerrar el día') : null));
  }
  if (st.md.wd >= 6) return null;
  const f = (ctx.ui.routine ||= { tf: {}, asset: 'EURUSD', dir: 'buy', zone: 'optima' });
  const doneAll = f.cal && TFS.every(([k]) => f.tf[k]) && f.target?.trim() && f.aligned === true && f.eurgbp;
  const r = num(f.ratio);
  const z = ZONES[f.zone];
  const planOk = r !== null && z && r >= 1 && r <= z.maxR + 0.05;
  return card('Rutina antes de operar',
    h('p', { class: 'muted' }, 'Seis pasos. El plan solo se guarda con todos hechos.'),
    newsStep(ctx, f, now, st.md.wd),
    tfStep(ctx, f),
    targetStep(ctx, f),
    alignedStep(ctx, f, today),
    f.aligned === false ? null : eurgbpStep(ctx, f),
    f.aligned === false ? null : planStep(ctx, f),
    f.aligned === false ? null : h('button', {
      class: 'primary', disabled: !(doneAll && planOk),
      onclick: () => ctx.commit((s) => {
        s.days[today] = { plan: { asset: f.asset, dir: f.dir, target: f.target, zone: f.zone, ratio: r, eurgbp: f.eurgbp, smt: !!f.smt, tf: Object.keys(f.tf).filter((k) => f.tf[k]), notes: f.notes, at: new Date().toISOString() } };
        ctx.ui.routine = null;
      }),
    }, doneAll && planOk ? 'Guardar plan del día' : 'Completa los seis pasos'));
}
