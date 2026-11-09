// Beneficio, swap y comisión tal como salen en MT5. El neto (lo que cuenta) es la suma de los tres.
import { h, field, num, usd, signed } from './dom.js';

export const netOf = (gross, swap, commission) => (gross || 0) + (swap || 0) + (commission || 0);

// f guarda los textos del formulario: { gross, swap, commission }.
export function moneyFields(f, hint = {}) {
  const out = h('p', { class: 'net' });
  const refresh = () => {
    const g = num(f.gross);
    out.textContent = g === null ? 'Neto: escribe el beneficio' : `Neto: ${usd(netOf(g, num(f.swap), num(f.commission)))}`;
  };
  const input = (key, ph) => signed(f[key], ph, (v) => { f[key] = v; refresh(); });
  refresh();
  return h('div', { class: 'money' },
    h('div', { class: 'three' },
      field('Beneficio (MT5)', input('gross', hint.gross ?? 'ej. −25,00')),
      field('Swap', input('swap', '0')),
      field('Comisión', input('commission', hint.commission ?? '0'))),
    out,
    h('p', { class: 'muted' }, 'Cópialos de MT5 con su signo; pulsa ± para el negativo (la comisión y casi siempre el swap van en negativo). El neto es lo que cuenta para el balance, los topes y el %.'));
}

// Devuelve { gross, swap, commission, pnl } o null si falta el beneficio.
export function readMoney(f) {
  const gross = num(f.gross);
  if (gross === null) return null;
  const swap = num(f.swap) ?? 0;
  const commission = num(f.commission) ?? 0;
  return { gross, swap, commission, pnl: Math.round(netOf(gross, swap, commission) * 100) / 100 };
}

export const moneyForm = (t) => ({
  gross: t.gross ?? (typeof t.pnl === 'number' && t.swap === undefined ? t.pnl : ''),
  swap: t.swap ?? '',
  commission: t.commission ?? '',
});
