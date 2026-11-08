// Métricas del sistema: la principal es el % de operaciones con checklist completo, no el P&L.
import { closedTrades, tTime } from './rules/account.js';
import { weekday } from './time.js';

export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n;
  const den = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / den;
  const m = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, c - m), Math.min(1, c + m)];
}

export function summary(trades) {
  const ts = closedTrades(trades);
  const n = ts.length;
  const rs = ts.map((t) => t.r);
  const wins = rs.filter((r) => r > 0).length;
  const losses = rs.filter((r) => r < 0).length;
  const pos = rs.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const neg = Math.abs(rs.filter((r) => r < 0).reduce((a, b) => a + b, 0));
  const sumR = rs.reduce((a, b) => a + b, 0);
  const clean = ts.filter((t) => t.checklistOk && !t.outOfPlan && !t.flags?.ruleBroken).length;
  let peak = 0; let cum = 0; let maxDD = 0;
  for (const t of [...ts].sort((a, b) => tTime(a) - tTime(b))) {
    cum += t.r; peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum);
  }
  return {
    n, wins, losses, be: n - wins - losses,
    wr: n ? wins / n : 0,
    ci: wilson(wins, n),
    expectancy: n ? sumR / n : 0,
    sumR,
    pf: neg ? pos / neg : pos ? Infinity : 0,
    cleanPct: n ? clean / n : 0,
    broken: n - clean,
    maxDD,
  };
}

export function groupBy(trades, keyFn) {
  const groups = {};
  for (const t of closedTrades(trades)) {
    const k = keyFn(t) || 'Sin dato';
    (groups[k] ||= []).push(t);
  }
  return Object.entries(groups)
    .map(([k, arr]) => ({ key: k, ...summary(arr) }))
    .sort((a, b) => b.n - a.n);
}

const DOW = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const byAsset = (tr) => groupBy(tr, (t) => t.asset);
export const byWindow = (tr) => groupBy(tr, (t) => t.window);
export const bySetup = (tr) => groupBy(tr, (t) => (t.checklistOk && !t.outOfPlan ? 'Setup completo' : 'Fuera de plan / incompleto'));
export const byWeekday = (tr) => groupBy(tr, (t) => (t.date ? DOW[weekday(t.date)] : null));

// Días bien hechos seguidos: un día sin operación por "sin R" también cuenta.
export function cleanStreak(state) {
  const days = new Set([
    ...state.trades.filter((t) => t.date).map((t) => t.date),
    ...Object.keys(state.days || {}).filter((d) => state.days[d].plan),
  ]);
  let streak = 0;
  for (const d of [...days].sort().reverse()) {
    const ts = state.trades.filter((t) => t.date === d);
    const bad = ts.some((t) => !t.checklistOk || t.outOfPlan || t.flags?.ruleBroken);
    if (bad) break;
    streak += 1;
  }
  return streak;
}
