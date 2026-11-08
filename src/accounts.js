// Cuentas: el forward test (sin dinero) y cada reto o cuenta fondeada. Cada operación pertenece a una.
export const FORWARD = 'forward';
export const TYPES = { forward: 'Forward test', challenge: 'Reto', funded: 'Fondeada' };
export const STATUS = { active: 'Activa', burned: 'Quemada', passed: 'Fase superada', closed: 'Cerrada' };

const NOV = 'cuenta-nov-2026';

// Crea el forward test si falta y asigna cuenta a las operaciones antiguas (migración).
export function ensureAccounts(s) {
  if (!Array.isArray(s.accounts)) s.accounts = [];
  if (!s.accounts.some((a) => a.id === FORWARD)) {
    s.accounts.unshift({ id: FORWARD, name: 'Forward test', type: 'forward', size: 5000, created: '', status: 'active' });
  }
  const novTrades = s.trades.filter((t) => !t.accountId && String(t.id).startsWith('fp-nov-'));
  if (novTrades.length && !s.accounts.some((a) => a.id === NOV)) {
    s.accounts.push({ id: NOV, name: 'Cuenta nueva (nov 2026)', type: 'challenge', size: 5000, created: '2026-11-01', status: 'active' });
  }
  for (const t of s.trades) if (!t.accountId) t.accountId = String(t.id).startsWith('fp-nov-') ? NOV : FORWARD;
  if (!s.accounts.some((a) => a.id === s.config.activeAccount)) s.config.activeAccount = FORWARD;
  return s;
}

export const accountOf = (t) => t.accountId || FORWARD;
export const findAccount = (s, id) => s.accounts.find((a) => a.id === id);
export const accountName = (s, id) => findAccount(s, id)?.name || 'Sin cuenta';
export const activeAccount = (s) => findAccount(s, s.config.activeAccount) || s.accounts[0];
export const tradesOf = (s, id) => (id === 'all' ? s.trades : s.trades.filter((t) => accountOf(t) === id));

// La cuenta activa es la que recibe las operaciones nuevas y la que manda en balance y riesgo.
export function setActive(s, id) {
  const a = findAccount(s, id);
  if (!a) return;
  s.config.activeAccount = id;
  s.config.mode = a.type;
  s.config.startBalance = a.size || 5000;
}

export function addAccount(s, { name, type = 'challenge', size = 5000, created = '' }) {
  const id = `acc-${Date.now().toString(36)}`;
  s.accounts.push({ id, name: name || `Cuenta ${s.accounts.length}`, type, size, created, status: 'active' });
  setActive(s, id);
  return id;
}
