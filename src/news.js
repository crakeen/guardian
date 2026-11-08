// Calendario económico: data/calendar.json (lo actualiza una GitHub Action desde Forex Factory)
// más las noticias que añadas a mano.
import { madrid, newYork } from './time.js';

const RATE = /(Funds Rate|Refinancing Rate|Bank Rate|Rate Decision|Rate Statement|Monetary Policy)/i;
const FOMC = /(FOMC|Federal Funds Rate)/i;

export async function loadCalendar() {
  try {
    const res = await fetch('data/calendar.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const j = await res.json();
    return { events: j.events || [], fetchedAt: j.fetchedAt || null };
  } catch {
    return { events: [], fetchedAt: null, error: true };
  }
}

export function allEvents(calendar, manual = []) {
  return [...(calendar?.events || []), ...manual]
    .map((e) => ({ ...e, time: new Date(e.date).getTime() }))
    .filter((e) => !Number.isNaN(e.time))
    .sort((a, b) => a.time - b.time);
}

export const isHigh = (e) => e.impact === 'High';
const inCcys = (e, ccys) => ccys.includes(e.country);

export function todayEvents(events, now = new Date()) {
  const d = madrid(now).date;
  return events.filter((e) => madrid(new Date(e.time)).date === d && ['USD', 'EUR', 'GBP'].includes(e.country) && e.impact !== 'Low');
}

// Noticias rojas de esas divisas entre 15 min antes y `hours` horas después de ahora.
export function highSoon(events, ccys, now = new Date(), hours = 2) {
  const t = now.getTime();
  return events.filter((e) => isHigh(e) && inCcys(e, ccys) && e.time >= t - 15 * 60e3 && e.time <= t + hours * 3600e3);
}

// Decisión de tipos más tarde hoy en esa divisa: no se opera la sesión de antes.
export function rateLaterToday(events, ccys, now = new Date()) {
  const d = madrid(now).date;
  return events.filter((e) => RATE.test(e.title) && inCcys(e, ccys) && e.time > now.getTime() && madrid(new Date(e.time)).date === d);
}

// Día de FOMC después de las 14:00 de Nueva York.
export function fomcLock(events, now = new Date()) {
  const ny = newYork(now);
  const fomc = events.some((e) => e.country === 'USD' && FOMC.test(e.title) && newYork(new Date(e.time)).date === ny.date);
  return fomc && ny.min >= 14 * 60;
}
