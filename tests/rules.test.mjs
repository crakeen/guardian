import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/config.js';
import { size, ratio } from '../src/rules/sizing.js';
import { status, risk, account } from '../src/rules/account.js';
import { evaluate, currentWindow } from '../src/rules/gate.js';
import { canBuy } from '../src/rules/challenge.js';
import { summary, wilson } from '../src/metrics.js';
import { madrid, nyToMadridOffset, weekStart } from '../src/time.js';
import { isRateDecision, fomcLock } from '../src/news.js';

const base = (over = {}) => ({ config: { ...DEFAULT_CONFIG }, trades: [], days: {}, log: [], news: [], ...over });
const MON_0905 = new Date('2026-11-09T08:05:00Z'); // lunes, 09:05 España, 03:05 NY
const trade = (o) => ({ id: Math.random().toString(36), status: 'closed', riskUSD: 25, checklistOk: true, ...o });

test('lotaje: 15 pips en EURUSD con 25 $ da 0,16 lotes (anexo A1)', () => {
  const s = size({ asset: 'EURUSD', entry: 1.1, stop: 1.0985, riskUSD: 25, commissionPerLot: 5 });
  assert.equal(s.ok, true);
  assert.equal(s.lots, 0.16);
  assert.ok(s.lossAtStop <= 25);
});

test('lotaje: 6 $ de stop en oro con 25 $ da 0,04 lotes', () => {
  const s = size({ asset: 'XAUUSD', entry: 2669, stop: 2663, riskUSD: 25, commissionPerLot: 5 });
  assert.equal(s.lots, 0.04);
  assert.equal(s.ok, true);
});

test('stop de menos de 15 pips se bloquea (A1)', () => {
  const s = size({ asset: 'EURUSD', entry: 1.16691, stop: 1.16683, riskUSD: 25, commissionPerLot: 5 });
  assert.equal(s.ok, false);
  assert.match(s.problems.join(), /A1/);
});

test('oro con stop de menos de 4 $ se bloquea', () => {
  assert.equal(size({ asset: 'XAUUSD', entry: 2669, stop: 2666, riskUSD: 25, commissionPerLot: 5 }).ok, false);
});

test('ratio en compra y venta', () => {
  assert.equal(ratio({ dir: 'buy', entry: 100, stop: 90, tp: 130 }), 3);
  assert.equal(ratio({ dir: 'sell', entry: 100, stop: 110, tp: 80 }), 2);
  assert.equal(ratio({ dir: 'buy', entry: 100, stop: 110, tp: 130 }), null);
});

test('horario: ventana 3:00 NY = 9:00 España en noviembre', () => {
  assert.equal(nyToMadridOffset(MON_0905), 360);
  assert.equal(currentWindow(MON_0905).id, 'principal');
  assert.equal(currentWindow(new Date('2026-11-09T08:25:00Z')), null); // 09:25: fuera
  assert.equal(currentWindow(new Date('2026-11-09T09:10:00Z')).id, 'continuacion');
  assert.equal(currentWindow(new Date('2026-11-08T08:05:00Z')), null); // domingo
});

test('weekStart es lunes', () => {
  assert.equal(weekStart('2026-11-08'), '2026-11-02');
  assert.equal(weekStart('2026-11-09'), '2026-11-09');
  assert.equal(madrid(MON_0905).date, '2026-11-09');
});

test('día cerrado tras 1 operación', () => {
  const st = status(base({ trades: [trade({ date: '2026-11-09', r: 2, closedAt: '2026-11-09T08:00:00Z' })] }), MON_0905);
  assert.equal(st.canTrade, false);
  assert.ok(st.blocks.some((b) => b.code === 'day'));
});

test('3 pérdidas seguidas bloquean 48 h', () => {
  const trades = ['2026-11-04', '2026-11-05', '2026-11-06'].map((d) => trade({ date: d, r: -1, closedAt: `${d}T09:00:00Z` }));
  trades[2].closedAt = '2026-11-08T09:00:00Z';
  const st = status(base({ trades }), MON_0905);
  assert.ok(st.blocks.some((b) => b.code === 'streak'));
  const later = status(base({ trades }), new Date('2026-11-10T09:05:00Z'));
  assert.ok(!later.blocks.some((b) => b.code === 'streak'));
});

test('operación fuera de plan bloquea 24 h', () => {
  const st = status(base({ trades: [trade({ date: '2026-11-08', r: 2, outOfPlan: true, openedAt: '2026-11-08T20:00:00Z' })] }), MON_0905);
  assert.ok(st.blocks.some((b) => b.code === 'rule'));
});

test('semana cerrada a -100 $', () => {
  const trades = [trade({ date: '2026-11-09', r: -1, pnl: -100, closedAt: '2026-11-09T07:00:00Z' })];
  const st = status(base({ trades }), new Date('2026-11-10T08:05:00Z'));
  assert.ok(st.blocks.some((b) => b.code === 'week'));
});

test('riesgo: 0,5 % base, 0,25 % por debajo de -3 % hasta volver a 5.000', () => {
  const cfg = { ...DEFAULT_CONFIG, mode: 'challenge', accountStart: '2026-11-01' };
  assert.equal(risk(base({ config: cfg })).usd, 25);
  const down = [trade({ date: '2026-11-02', r: -1, pnl: -160, closedAt: '2026-11-02T09:00:00Z' })];
  assert.equal(risk(base({ config: cfg, trades: down })).usd, 12.5);
  const partial = [...down, trade({ date: '2026-11-03', r: 2, pnl: 100, closedAt: '2026-11-03T09:00:00Z' })];
  assert.equal(account(base({ config: cfg, trades: partial })).balance, 4940);
  assert.equal(risk(base({ config: cfg, trades: partial })).usd, 12.5);
  const up = [...partial, trade({ date: '2026-11-04', r: 2, pnl: 150, closedAt: '2026-11-04T09:00:00Z' })];
  assert.equal(risk(base({ config: cfg, trades: up })).usd, 25); // 5.090 = +1,8 %: sigue al 0,5 %
  const more = [...up, trade({ date: '2026-11-05', r: 2, pnl: 50, closedAt: '2026-11-05T09:00:00Z' })];
  assert.equal(risk(base({ config: cfg, trades: more })).usd, 37.5); // 5.140 = +2,8 % → 0,75 %
});

test('post-fase: 0,25 % durante 10 operaciones y 48 h de pausa', () => {
  const s = base({ config: { ...DEFAULT_CONFIG, mode: 'challenge' }, log: [{ type: 'phase_pass', at: '2026-11-08T20:00:00Z', date: '2026-11-08' }] });
  assert.equal(risk(s).usd, 12.5);
  assert.ok(status(s, MON_0905).blocks.some((b) => b.code === 'phase'));
});

const goodForm = { asset: 'EURUSD', dir: 'buy', entry: 1.1, stop: 1.098, tp: 1.104, zone: 'optima', q: { rLeft: true, aligned: true, p3: true, stopLogic: true }, reason: 'R izquierda en diario, barrida del bajo de H4, cierre M15 dentro.' };
const planned = (o = {}) => base({ days: { '2026-11-09': { plan: { asset: 'EURUSD', dir: 'buy' } } }, ...o });

test('checklist: entrada válida pasa', () => {
  const ev = evaluate(goodForm, { state: planned(), now: MON_0905, events: [] });
  assert.equal(ev.ok, true, JSON.stringify(ev.items.filter((i) => !i.ok)));
  assert.equal(ev.sizing.lots, 0.12);
});

test('checklist: sin plan del día no hay operación', () => {
  assert.equal(evaluate(goodForm, { state: base(), now: MON_0905, events: [] }).ok, false);
});

test('checklist: "lo tengo muy claro" bloquea', () => {
  const ev = evaluate({ ...goodForm, reason: 'Lo tengo muy claro, va a subir seguro' }, { state: planned(), now: MON_0905, events: [] });
  assert.equal(ev.items.find((i) => i.id === 'reason').ok, false);
});

test('checklist: noticia roja en 2 h bloquea; ratio fuera de zona bloquea', () => {
  const events = [{ title: 'CPI m/m', country: 'USD', impact: 'High', time: MON_0905.getTime() + 3600e3 }];
  assert.equal(evaluate(goodForm, { state: planned(), now: MON_0905, events }).items.find((i) => i.id === 'news').ok, false);
  const ev = evaluate({ ...goodForm, zone: 'ultimo' }, { state: planned(), now: MON_0905, events: [] });
  assert.equal(ev.items.find((i) => i.id === 'ratio').ok, false);
});

test('checklist: activo distinto al del plan bloquea', () => {
  const ev = evaluate({ ...goodForm, asset: 'GBPUSD' }, { state: planned(), now: MON_0905, events: [] });
  assert.equal(ev.items.find((i) => i.id === 'idea').ok, false);
});

test('métricas y compra de reto con 22 operaciones', () => {
  const rs = [2, 2, 2, 2, 2, 2, -1, -1, 2, -1, 2, -1, -1, 0, -1, 0, 0, 1, 2, 2, -1, 0];
  const trades = rs.map((r, i) => trade({ date: null, r, checklistOk: ![6, 17, 19, 20].includes(i) }));
  const s = summary(trades);
  assert.equal(s.n, 22);
  assert.equal(s.wr, 0.5);
  assert.equal(s.sumR, 14);
  assert.equal(s.pf, 3);
  assert.equal(Math.round(s.cleanPct * 100), 82);
  const cb = canBuy(base({ trades }), MON_0905);
  assert.equal(cb.ok, false);
  const [lo, hi] = wilson(6, 8);
  assert.ok(lo > 0.4 && lo < 0.42 && hi > 0.92);
});

test('un discurso de un miembro del FOMC no es una decisión de tipos', () => {
  assert.equal(isRateDecision({ title: 'FOMC Member Waller Speaks' }), false);
  assert.equal(isRateDecision({ title: 'MPC Member Mann Speaks' }), false);
  assert.equal(isRateDecision({ title: 'Federal Funds Rate' }), true);
  assert.equal(isRateDecision({ title: 'Main Refinancing Rate' }), true);
  assert.equal(isRateDecision({ title: 'Official Bank Rate' }), true);
  const talk = [{ title: 'FOMC Member Waller Speaks', country: 'USD', time: new Date('2026-11-10T09:00:00Z').getTime() }];
  assert.equal(fomcLock(talk, new Date('2026-11-10T20:00:00Z')), false);
});

import { ensureAccounts, setActive, tradesOf } from '../src/accounts.js';

test('cuentas: las del Excel van al forward test y las fp-nov a su propia cuenta', () => {
  const s = ensureAccounts(base({ trades: [trade({ id: 'xl-1', r: 2 }), trade({ id: 'fp-nov-1', r: 1, pnl: 28 })] }));
  assert.equal(s.trades[0].accountId, 'forward');
  assert.equal(s.trades[1].accountId, 'cuenta-nov-2026');
  assert.equal(s.accounts.length, 2);
  assert.equal(tradesOf(s, 'all').length, 2);
  assert.equal(tradesOf(s, 'cuenta-nov-2026').length, 1);
});

test('cuentas: el balance solo suma las operaciones de la cuenta activa', () => {
  const s = ensureAccounts(base({ trades: [trade({ id: 'xl-1', r: 2, date: '2026-10-01' }), trade({ id: 'fp-nov-1', r: -1, pnl: -40, date: '2026-11-02' })] }));
  assert.equal(account(s).balance, 5050); // forward: 2R × 25 $
  setActive(s, 'cuenta-nov-2026');
  assert.equal(s.config.mode, 'challenge');
  assert.equal(account(s).balance, 4960);
});

test('la muestra para comprar reto solo cuenta operaciones dentro de plan', () => {
  const trades = [...Array(25)].map((_, i) => trade({ id: `a${i}`, r: 2 })).concat([...Array(10)].map((_, i) => trade({ id: `b${i}`, r: 1, outOfPlan: true, checklistOk: false })));
  const item = canBuy(base({ trades }), MON_0905).items[0];
  assert.equal(item.ok, false);
  assert.match(item.detail, /25 válidas de 35/);
});
