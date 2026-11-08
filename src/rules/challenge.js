// "¿Puedo comprar un reto?": se contesta con tus números, no con cómo te sientes hoy.
import { summary, validTrades } from '../metrics.js';
import { madrid, daysBetween } from '../time.js';

export const MIN_TRADES = 30;

export function challengeState(state) {
  const buys = state.log.filter((e) => e.type === 'challenge_buy').sort((a, b) => a.at.localeCompare(b.at));
  const burns = state.log.filter((e) => e.type === 'challenge_burn').sort((a, b) => a.at.localeCompare(b.at));
  const lastBuy = buys.at(-1)?.date || state.config.lastBuy || '';
  const lastBurn = burns.at(-1);
  const active = buys.length > burns.length || (state.accounts || []).some((a) => a.type !== 'forward' && a.status === 'active');
  return { buys, burns, lastBuy, lastBurn, active };
}

export function canBuy(state, now = new Date()) {
  const today = madrid(now).date;
  const s = summary(state.trades);
  const cs = challengeState(state);
  const month = today.slice(0, 7);
  const thisMonth = cs.buys.filter((b) => b.date.startsWith(month));
  const burnedThisMonth = cs.burns.filter((b) => b.date.startsWith(month));
  const items = [];
  const add = (label, ok, detail) => items.push({ label, ok, detail });

  const valid = validTrades(state.trades).length;
  add(`Al menos ${MIN_TRADES} operaciones dentro de plan`, valid >= MIN_TRADES, `Llevas ${valid} válidas de ${s.n} registradas. Te faltan ${Math.max(0, MIN_TRADES - valid)}. Las de fuera de plan no cuentan.`);
  add('Expectancy positiva', s.expectancy > 0, `${s.expectancy.toLocaleString('es-ES', { maximumFractionDigits: 2 })} R por operación.`);
  add('Checklist completo en el 95 % o más', s.cleanPct >= 0.95, `${Math.round(s.cleanPct * 100)} % con checklist completo (${s.broken} fuera de plan o incompletas).`);
  add('Un solo reto activo', !cs.active, cs.active ? 'Ya tienes un reto activo.' : 'Ninguno activo.');
  const since = cs.lastBurn ? daysBetween(cs.lastBurn.date, today) : null;
  add('7 días desde que quemaste el último', since === null || since >= 7,
    since === null ? 'No hay ninguno quemado registrado.' : `Han pasado ${since} días.`);
  let monthOk = thisMonth.length === 0;
  let monthDetail = 'Ninguno comprado este mes.';
  if (thisMonth.length === 1) {
    const clean = burnedThisMonth.some((b) => b.data?.rulesOk);
    monthOk = clean;
    monthDetail = clean ? 'El primero se quemó cumpliendo el 100 % de las reglas: se permite un segundo.' : 'Ya compraste uno este mes y no se quemó cumpliendo el 100 % de las reglas.';
  } else if (thisMonth.length >= 2) { monthOk = false; monthDetail = 'Ya llevas dos este mes.'; }
  add('Máximo 1 al mes', monthOk, monthDetail);

  return { ok: items.every((i) => i.ok), items, summary: s, daysSinceBuy: cs.lastBuy ? daysBetween(cs.lastBuy, today) : null };
}
