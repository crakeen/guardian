// Checklist de entrada: los 6 puntos del Protocolo Diciembre más las reglas duras.
// O todo en verde o no hay operación. No existe un botón para saltárselo.
import { INSTRUMENTS, ZONES, WINDOWS, LAST_ENTRY_NY, BLOCK_PHRASES } from '../config.js';
import { newYork, madrid, hm, nyToMadridOffset } from '../time.js';
import { status as accountStatus } from './account.js';
import { size, ratio, distanceLabel, es } from './sizing.js';
import { highSoon, rateLaterToday, fomcLock } from '../news.js';

export const MANUAL = [
  { id: 'rLeft', label: '1. Hay una R a la izquierda que da la dirección (objetivo).' },
  { id: 'aligned', label: '2. La vela actual está alineada: para comprar abre por debajo y ha tomado el bajo de la anterior (para vender, al revés).' },
  { id: 'p3', label: '4. Compro por debajo de la apertura o vendo por encima (power of three).' },
  { id: 'stopLogic', label: '6. El stop está en un sitio lógico.' },
];

export function currentWindow(now = new Date()) {
  const ny = newYork(now);
  if (ny.wd >= 6) return null;
  return WINDOWS.find((w) => ny.min >= w.start && ny.min < w.end && ny.min < LAST_ENTRY_NY) || null;
}

export function windowsInMadrid(now = new Date()) {
  const off = nyToMadridOffset(now);
  return WINDOWS.map((w) => ({ ...w, from: hm(w.start + off), to: hm(w.end + off), startMd: w.start + off, endMd: w.end + off }));
}

export function evaluate(form, { state, now = new Date(), events = [] }) {
  const items = [];
  const add = (id, label, ok, detail = '') => items.push({ id, label, ok: !!ok, detail });
  const st = accountStatus(state, now);
  const plan = state.days?.[madrid(now).date]?.plan;
  const ins = INSTRUMENTS[form.asset];

  add('status', 'Puedes operar hoy (protocolo de parada)', st.canTrade, st.blocks.map((b) => b.msg).join(' '));
  add('plan', 'Hiciste la rutina y escribiste el plan del día', plan && !plan.noTrade,
    !plan ? 'Sin plan escrito no hay operación: haz la rutina en Hoy.' : plan.noTrade ? `Hoy marcaste "${plan.noTrade}": no se opera.` : '');
  if (plan && !plan.noTrade) {
    add('idea', 'Mismo activo y dirección que tu plan (1 activo y 1 idea al día)', plan.asset === form.asset && plan.dir === form.dir,
      `Tu plan de hoy: ${plan.dir === 'buy' ? 'comprar' : 'vender'} ${plan.asset}.`);
  }

  const win = currentWindow(now);
  const ny = newYork(now);
  add('time', '3. Apertura de vela clave, dentro de sus primeros 20 minutos', win,
    win ? win.label : `Ahora son las ${hm(madrid(now).min)} en España (${hm(ny.min)} NY). Ventanas: ${windowsInMadrid(now).map((w) => `${w.from}–${w.to}`).join(' y ')}.`);

  const ccys = ins?.ccys || [];
  const soon = highSoon(events, ccys, now, state.config.newsHours);
  const rate = rateLaterToday(events, ccys, now);
  const fomc = fomcLock(events, now);
  const newsDetail = [
    ...soon.map((e) => `${e.country} ${e.title}`),
    ...rate.map((e) => `Tipos más tarde hoy: ${e.country} ${e.title}`),
    fomc ? 'Día de FOMC después de las 14:00 NY' : '',
  ].filter(Boolean).join(' · ');
  add('news', `5. Sin noticia de alto impacto en las próximas ${state.config.newsHours} h`, !soon.length && !rate.length && !fomc, newsDetail);

  for (const q of MANUAL) add(q.id, q.label, form.q?.[q.id] === true);

  const r = ratio(form);
  const z = ZONES[form.zone];
  let ratioOk = false;
  let ratioDetail = 'Revisa que el stop y el objetivo estén en el lado correcto.';
  if (r !== null && z) {
    ratioOk = r >= 1 - 1e-9 && r <= z.maxR + 0.05;
    ratioDetail = `Ratio ${es(r)}R. En "${z.label}" el máximo es ${es(z.maxR, 1)}R${r < 1 ? ' y el mínimo, 1R' : ''}.`;
  } else if (!z) ratioDetail = 'Elige en qué zona del rango está el precio.';
  add('ratio', '6. El ratio encaja con el cuadrante', ratioOk, ratioDetail);

  const sz = size({ ...form, riskUSD: st.risk.usd, commissionPerLot: state.config.commissionPerLot });
  add('size', 'Stop mínimo, lotaje y comisión (A1, A2, R4)', sz.ok,
    sz.ok ? `${es(sz.lots)} lotes · stop de ${distanceLabel(form.asset, sz.dist)} · pierdes ${es(sz.lossAtStop)} $ si salta` : sz.problems.join(' '));

  const reason = (form.reason || '').trim();
  const bad = BLOCK_PHRASES.find((p) => p.re.test(reason));
  add('reason', 'Motivo escrito con los puntos del setup', reason.length >= 15 && !bad,
    bad ? bad.msg : reason.length < 15 ? 'Escribe por qué entras, punto por punto.' : '');

  return { ok: items.every((i) => i.ok), items, sizing: sz, ratio: r, window: win, risk: st.risk, status: st };
}
