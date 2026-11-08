// Fechas y horas en Madrid y Nueva York, sin librerías.

const fmts = {};
function parts(d, tz) {
  fmts[tz] ||= new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmts[tz].formatToParts(d).map((x) => [x.type, x.value]));
  const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  const h = Number(p.hour) % 24;
  return { date: `${p.year}-${p.month}-${p.day}`, h, m: Number(p.minute), min: h * 60 + Number(p.minute), wd };
}

export const madrid = (d = new Date()) => parts(d, 'Europe/Madrid');
export const newYork = (d = new Date()) => parts(d, 'America/New_York');

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(dateStr) {
  const w = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
}

// Lunes de la semana de esa fecha.
export const weekStart = (dateStr) => addDays(dateStr, 1 - weekday(dateStr));

export const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 864e5);

export const hm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function fmtTime(date) {
  const p = madrid(date instanceof Date ? date : new Date(date));
  return hm(p.min);
}

const DOW = ['', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fmtDate(dateStr) {
  if (!dateStr) return 'sin fecha';
  const [, mo, da] = dateStr.split('-').map(Number);
  return `${DOW[weekday(dateStr)]} ${da} ${MON[mo - 1]}`;
}

// Diferencia NY→Madrid en minutos para ese instante (normalmente 360; 300 en semanas de cambio de hora).
export function nyToMadridOffset(d = new Date()) {
  const a = madrid(d);
  const b = newYork(d);
  let diff = a.min - b.min;
  if (a.date !== b.date) diff += 1440;
  return ((diff % 1440) + 1440) % 1440;
}
