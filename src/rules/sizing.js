// Lotaje desde el stop (R4), stop mínimo (A1) y comisión máxima (A2).
import { INSTRUMENTS } from '../config.js';

export const es = (v, d = 2) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const floor2 = (x) => Math.floor(x * 100 + 1e-9) / 100;

export function distanceLabel(asset, dist) {
  const ins = INSTRUMENTS[asset];
  if (!ins) return '';
  const v = dist / ins.unit;
  return ins.unitName === 'pips' ? `${es(v, 1)} pips` : `${es(v, 2)} $`;
}

// Devuelve el lotaje que cabe en el riesgo incluyendo la comisión, y los motivos si no se puede.
export function size({ asset, entry, stop, riskUSD, commissionPerLot }) {
  const ins = INSTRUMENTS[asset];
  const out = { ok: false, lots: 0, dist: 0, lossAtStop: 0, commission: 0, problems: [] };
  if (!ins) { out.problems.push('Activo no permitido (R5).'); return out; }
  if (!(entry > 0) || !(stop > 0)) { out.problems.push('Falta la entrada o el stop.'); return out; }
  const dist = Math.abs(entry - stop);
  out.dist = dist;
  if (dist + 1e-9 < ins.minStop) {
    out.problems.push(`Stop de ${distanceLabel(asset, dist)}: el mínimo es ${distanceLabel(asset, ins.minStop)} (A1).`);
  }
  const lossPerLot = dist * ins.contract;
  const lots = lossPerLot > 0 ? floor2(riskUSD / (lossPerLot + commissionPerLot)) : 0;
  out.lots = lots;
  out.commission = lots * commissionPerLot;
  out.lossAtStop = lots * lossPerLot + out.commission;
  if (lots < 0.01) out.problems.push('El stop está demasiado lejos para tu riesgo: ni 0,01 lotes caben.');
  if (out.commission > 0.1 * riskUSD + 1e-9) {
    out.problems.push(`Comisión de ${es(out.commission)} $: supera el 10 % del riesgo (A2).`);
  }
  out.ok = out.problems.length === 0;
  return out;
}

export function ratio({ dir, entry, stop, tp }) {
  if (!(entry > 0 && stop > 0 && tp > 0)) return null;
  const risk = dir === 'buy' ? entry - stop : stop - entry;
  const reward = dir === 'buy' ? tp - entry : entry - tp;
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}
