// Todo se guarda en este dispositivo (localStorage). Haz copias en Más → Copia de seguridad.
import { DEFAULT_CONFIG } from './config.js';

const KEY = 'guardian-v1';

export const fresh = () => ({ v: 1, config: { ...DEFAULT_CONFIG }, trades: [], days: {}, log: [], news: [] });

function migrate(s) {
  const f = fresh();
  return { ...f, ...s, config: { ...f.config, ...(s.config || {}) }, days: s.days || {}, log: s.log || [], news: s.news || [] };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch { /* almacenamiento bloqueado: se trabaja en memoria */ }
  return fresh();
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function download(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `guardian-copia-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Une una copia o un archivo de importación con lo que ya hay, sin duplicar operaciones.
export function merge(state, data) {
  const ids = new Set(state.trades.map((t) => t.id));
  const trades = (data.trades || []).filter((t) => t && t.id && !ids.has(t.id));
  state.trades.push(...trades);
  const logIds = new Set(state.log.map((e) => e.at + e.type));
  state.log.push(...(data.log || []).filter((e) => !logIds.has(e.at + e.type)));
  for (const [d, v] of Object.entries(data.days || {})) if (!state.days[d]) state.days[d] = v;
  if (data.config) state.config = { ...state.config, ...data.config };
  return trades.length;
}
