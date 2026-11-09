// Valores por defecto: reglas públicas de FundingPips 2-Step Pro (5.000 $) y del Protocolo Diciembre.
// Tus datos reales se cambian en Más → Ajustes y se guardan solo en tu dispositivo.

// Súbela junto con VERSION en sw.js en cada publicación.
export const APP_VERSION = 'gd-v9';

export const INSTRUMENTS = {
  EURUSD: { contract: 100000, unit: 0.0001, unitName: 'pips', minStop: 0.0015, digits: 5, ccys: ['EUR', 'USD'] },
  GBPUSD: { contract: 100000, unit: 0.0001, unitName: 'pips', minStop: 0.0015, digits: 5, ccys: ['GBP', 'USD'] },
  XAUUSD: { contract: 100, unit: 1, unitName: '$', minStop: 4, digits: 2, ccys: ['USD'] },
};

export const ZONES = {
  optima: { label: 'Zona óptima (tarter sub / primer cuadrante)', maxR: 3 },
  mitad: { label: 'Mitad del rango', maxR: 1.5 },
  ultimo: { label: 'Último cuadrante / continuación tardía', maxR: 1 },
};

// Ventanas de entrada en hora de Nueva York (minuto del día). Se muestran convertidas a hora de España.
export const WINDOWS = [
  { id: 'principal', label: 'Ventana principal (vela 3:00 NY)', start: 3 * 60, end: 3 * 60 + 20 },
  { id: 'continuacion', label: 'Continuación (vela 4:00 NY)', start: 4 * 60, end: 4 * 60 + 20 },
];
export const LAST_ENTRY_NY = 4 * 60 + 45; // no abres nuevas a partir de las 10:45 España
export const LUNCH_NY = 5 * 60; // London Lunch: revisión / salida por tiempo

export const DEFAULT_CONFIG = {
  mode: 'forward', // forward | challenge | funded
  phase: 1, // 1, 2 o 3 (Master)
  startBalance: 5000,
  accountStart: '2026-09-01',
  maxLossPct: 6, // suelo estático
  firmDailyPct: 3,
  ownDailyUSD: 75, // A3: mitad del de la firma
  weeklyUSD: 100, // 2 %
  maxTradesDay: 1,
  maxTradesWeek: 4,
  targetPct: 6,
  commissionPerLot: 5,
  newsHours: 2,
  lastBuy: '', // fecha del último reto comprado
};

export const BLOCK_PHRASES = [
  { re: /lo\s+tengo\s+(muy\s+)?clar/i, msg: '"Lo tengo claro" no es un criterio: en tu historial precede a las operaciones fuera de plan.' },
  { re: /se\s+(me\s+)?escapa/i, msg: 'Entrar porque "se escapa" está prohibido (punto 9).' },
  { re: /recuperar|revancha|desquit/i, msg: 'Entrar para recuperar es operar por revancha.' },
];
