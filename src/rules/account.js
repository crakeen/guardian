// Estado de la cuenta y del día: balance, riesgo por operación y bloqueos (protocolo de parada).
import { madrid, weekStart, addDays } from '../time.js';

const H = 3600e3;

export const tTime = (t) => new Date(t.closedAt || t.openedAt || `${t.date || '2000-01-01'}T12:00:00`).getTime();
export const closedTrades = (trades) => trades.filter((t) => t.status === 'closed' && typeof t.r === 'number');
const byTime = (a, b) => tTime(a) - tTime(b);

export function pnlOf(t, cfg) {
  if (typeof t.pnl === 'number') return t.pnl;
  return (t.r || 0) * (t.riskUSD || cfg.startBalance * 0.005);
}

export function accountTrades(state) {
  const from = state.config.accountStart || '0000';
  return closedTrades(state.trades).filter((t) => (t.date || '0000') >= from).sort(byTime);
}

export function account(state) {
  const cfg = state.config;
  const start = cfg.startBalance;
  let balance = start;
  let ddMode = false; // cuenta en -3 %: riesgo al 0,25 % hasta volver a la inicial
  for (const t of accountTrades(state)) {
    balance += pnlOf(t, cfg);
    if (balance <= start * 0.97 + 1e-9) ddMode = true;
    else if (balance >= start) ddMode = false;
  }
  return {
    balance, ddMode, start,
    floor: start * (1 - cfg.maxLossPct / 100),
    profitPct: ((balance - start) / start) * 100,
  };
}

const lastLog = (state, type) => state.log.filter((e) => e.type === type).sort((a, b) => new Date(b.at) - new Date(a.at))[0];

export function risk(state) {
  const cfg = state.config;
  const acc = account(state);
  const notes = [];
  let pct;
  if (cfg.mode === 'forward') pct = 0.5;
  else if (acc.profitPct < 2) pct = 0.5;
  else if (acc.profitPct < 4) pct = 0.75;
  else pct = Math.min(1, cfg.targetPct - acc.profitPct);
  if (pct > 0.5) notes.push(`Cuenta en +${acc.profitPct.toFixed(1)} %: el protocolo permite ${pct.toFixed(2)} %.`);
  if (acc.ddMode && pct > 0.25) { pct = 0.25; notes.push('Cuenta por debajo de -3 %: riesgo al 0,25 % hasta volver al balance inicial.'); }
  const pass = lastLog(state, 'phase_pass');
  if (pass) {
    const after = closedTrades(state.trades).filter((t) => tTime(t) > new Date(pass.at).getTime()).length;
    if (after < 10 && pct > 0.25) { pct = 0.25; notes.push(`Protocolo post-fase (A4): operación ${after + 1} de 10 al 0,25 %.`); }
  }
  pct = Math.max(0, pct);
  return { pct, usd: Math.round((pct / 100) * cfg.startBalance * 100) / 100, notes };
}

// Bloqueos con fecha de fin: 3 pérdidas seguidas, regla rota y fase superada.
export function timedBlocks(state) {
  const out = [];
  let streak = 0;
  for (const t of closedTrades(state.trades).sort(byTime)) {
    if (t.r < 0) {
      streak += 1;
      if (streak >= 3) out.push({ code: 'streak', from: tTime(t), until: tTime(t) + 48 * H, msg: '3 pérdidas seguidas: 48 h sin operar.' });
    } else streak = 0;
  }
  for (const t of state.trades) {
    if (t.outOfPlan || t.flags?.ruleBroken) {
      const at = new Date(t.openedAt || t.closedAt || `${t.date}T12:00:00`).getTime();
      out.push({ code: 'rule', from: at, until: at + 24 * H, msg: 'Regla rota: 24 h sin operar.' });
    }
  }
  for (const e of state.log) {
    const at = new Date(e.at).getTime();
    if (e.type === 'rule_break') out.push({ code: 'rule', from: at, until: at + 24 * H, msg: 'Regla rota: 24 h sin operar.' });
    if (e.type === 'phase_pass') out.push({ code: 'phase', from: at, until: at + 48 * H, msg: 'Fase superada: 48 h sin operar (A4). Relee el plan antes de la primera entrada.' });
  }
  return out;
}

export function status(state, now = new Date()) {
  const cfg = state.config;
  const md = madrid(now);
  const today = md.date;
  const wk = weekStart(today);
  const wkEnd = addDays(wk, 6);
  const acc = account(state);
  const rk = risk(state);
  const todays = state.trades.filter((t) => t.date === today);
  const week = state.trades.filter((t) => t.date && t.date >= wk && t.date <= wkEnd);
  const sum = (arr) => closedTrades(arr).reduce((s, t) => s + pnlOf(t, cfg), 0);
  const dayPnl = sum(todays);
  const weekPnl = sum(week);
  const open = state.trades.find((t) => t.status === 'open');
  const blocks = [];
  const add = (code, msg, until) => blocks.push({ code, msg, until });

  if (md.wd >= 6) add('weekend', 'Fin de semana: el mercado está cerrado.');
  if (open) add('open', `Tienes una posición abierta en ${open.asset}: una a la vez (R8).`);
  if (todays.length >= cfg.maxTradesDay) add('day', `Día cerrado: ya has hecho tu operación de hoy (máximo ${cfg.maxTradesDay}).`);
  if (dayPnl <= -cfg.ownDailyUSD + 1e-9) add('dayloss', `Día cerrado: has llegado a tu tope diario de ${cfg.ownDailyUSD} $ (A3).`);
  else if (-dayPnl + rk.usd > cfg.ownDailyUSD + 1e-9) add('dayloss', 'Un stop más te pasaría de tu tope diario.');
  if (weekPnl <= -cfg.weeklyUSD + 1e-9) add('week', `Semana cerrada: has perdido ${cfg.weeklyUSD} $ esta semana. Vuelves el lunes.`);
  else if (-weekPnl + rk.usd > cfg.weeklyUSD + 1e-9) add('week', 'Un stop más te pasaría de tu tope semanal.');
  if (week.length >= cfg.maxTradesWeek) add('weektrades', `Ya llevas ${week.length} operaciones esta semana (máximo ${cfg.maxTradesWeek}).`);
  for (const b of timedBlocks(state)) if (b.until > now.getTime() && b.from <= now.getTime()) add(b.code, b.msg, b.until);
  if (cfg.mode !== 'forward' && acc.balance <= acc.floor + 1e-9) add('dead', 'La cuenta ha tocado el suelo: está perdida. Analízala antes de pensar en otra.');
  if (rk.pct <= 0) add('target', 'Objetivo de fase alcanzado: márcalo en Más → Retos y no operes más.');

  return {
    today, md, canTrade: blocks.length === 0, blocks, risk: rk, account: acc, open,
    day: { trades: todays.length, pnl: dayPnl },
    week: { trades: week.length, pnl: weekPnl },
    firmDailyLeft: (cfg.startBalance * cfg.firmDailyPct) / 100 + dayPnl,
  };
}
