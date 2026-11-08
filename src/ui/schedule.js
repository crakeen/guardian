// Horario del día, bloque a bloque, según el Protocolo Diciembre (puntos 3, 7 y 10).
// Las horas se calculan desde Nueva York para que el cambio de hora no descuadre nada.
import { h, card } from './dom.js';
import { madrid, hm, nyToMadridOffset } from '../time.js';
import { WINDOWS, LAST_ENTRY_NY, LUNCH_NY } from '../config.js';

function blocks(off) {
  const [w0, w1] = WINDOWS;
  const at = (ny) => ny + off;
  return [
    { from: at(w0.start) - 90, to: at(w0.start) - 30, kind: 'prep', title: 'Rutina antes de operar',
      what: 'Antes de Londres.',
      todo: ['Haz los 6 pasos de la tarjeta "Rutina antes de operar", justo encima de este horario (solo aparece de lunes a viernes).', 'Si no hay R alineada con el objetivo, hoy no se opera: lo apuntas como "sin R" y cierras la plataforma.'],
      link: true },
    { from: at(w0.start) - 30, to: at(w0.start), kind: 'wait', title: 'Espera',
      what: 'Plan escrito, plataforma abierta.',
      todo: ['No entras antes de la apertura de la vela de las 3:00 NY.', 'Lotaje calculado de antemano a partir del stop en pips.'] },
    { from: at(w0.start), to: at(w0.end), kind: 'entry', title: 'Ventana principal · vela 3:00 NY',
      what: 'Expansión de Londres. Apertura de vela clave: entras dentro de sus primeros 20 minutos o no entras.',
      todo: ['La vela está alineada: para comprar abre por debajo y ha tomado el bajo de la anterior (para vender, al revés).',
        'Compras por debajo de la apertura o vendes por encima (power of three).',
        'Stop en un sitio lógico; el ratio según el cuadrante: zona óptima 3R, mitad 1–1,5R, último cuadrante máx. 1R o no entras.',
        'Pasa el checklist en Entrada antes de pulsar nada.'] },
    { from: at(w0.end), to: at(w1.start), kind: 'wait', title: 'Sin entradas',
      what: 'Resto de la vela de las 3:00 NY.',
      todo: ['Si no entraste, no persigues el precio: entrar porque "se escapa" está prohibido.', 'Nunca entras en los últimos 15 minutos de una vela horaria.', 'Si estás dentro: el stop no se toca.'] },
    { from: at(w1.start), to: at(w1.end), kind: 'entry', title: 'Continuación · vela 4:00 NY',
      what: 'Siguiente vela horaria. Solo si no entraste a las 3:00 NY.',
      todo: ['Continuación por debajo de la apertura (para comprar) o por encima (para vender).', 'Los mismos 6 puntos del checklist. Máximo 1 operación al día: si ya entraste, esto no va contigo.'] },
    { from: at(w1.end), to: at(LUNCH_NY), kind: 'manage', title: 'Gestión',
      what: `Sin entradas nuevas (a partir de las ${hm(at(LAST_ENTRY_NY))} está prohibido igualmente).`,
      todo: ['Salida por tiempo: cuando la siguiente vela horaria o de 4 h toma el extremo de la anterior en contra, break even o cierras.',
        'En contratendencia: break even en cuanto una vela nueva tome el extremo y rechace.', 'Nada de mover el stop cada pocos pips.'] },
    { from: at(LUNCH_NY), to: at(LUNCH_NY) + 60, kind: 'exit', title: 'London Lunch · vela 5:00 NY',
      what: 'Salida por tiempo o reversión.',
      todo: ['Revisas: si no ha llegado al objetivo y la vela de las 5:00 NY va en contra, cierras.'] },
    { from: at(LUNCH_NY) + 60, to: 24 * 60, kind: 'off', title: 'Resto del día',
      what: 'Sesión de Nueva York y Asia: no las operas.',
      todo: ['Diario: captura antes y después, checklist marcado, ratio, resultado y por qué entraste.',
        'Día sin operación: anótalo como "sin R" o "sin alineación". Cuenta como día bien hecho.',
        'Viernes: todo cerrado antes de la noche.'] },
  ];
}

export function scheduleCard(ctx, now) {
  const md = madrid(now);
  const off = nyToMadridOffset(now);
  const closed = md.wd >= 6;
  const showAll = ctx.ui.showAllBlocks;
  const list = blocks(off).map((b) => {
    const state = closed ? 'closed' : md.min >= b.to ? 'past' : md.min >= b.from ? 'now' : 'next';
    return { ...b, state };
  });
  const current = list.findIndex((b) => b.state === 'now' || b.state === 'next');
  return card('Horario de hoy',
    closed ? h('p', { class: 'muted' }, 'Hoy no hay mercado. Así es el horario de un día de diario:') : null,
    off !== 360 ? h('p', { class: 'warn' }, `Semana de cambio de hora: Nueva York va ${off / 60} h por detrás. Las horas ya están ajustadas.`) : null,
    list.map((b, i) => {
      const open = showAll || b.state === 'now' || (b.state === 'next' && i === current) || closed;
      const badge = b.state === 'now' ? 'AHORA' : b.state === 'past' ? 'hecho' : b.state === 'next' ? `en ${hm(b.from - md.min)}` : '';
      return h('div', { class: `block ${b.kind} ${b.state}` },
        h('div', { class: 'block-head' },
          h('span', { class: 'time' }, `${hm(b.from)}–${b.to >= 1440 ? '…' : hm(b.to)}`),
          h('b', {}, b.title),
          badge ? h('span', { class: 'badge' }, badge) : null),
        open ? h('div', { class: 'block-body' }, h('p', {}, b.what), h('ul', {}, b.todo.map((t) => h('li', {}, t))),
          b.link && !closed ? h('button', { onclick: () => document.getElementById('rutina')?.scrollIntoView({ behavior: 'smooth' }) }, 'Ir a la rutina') : null) : null);
    }),
    closed ? null : h('button', { class: 'ghost', onclick: () => { ctx.ui.showAllBlocks = !showAll; ctx.render(); } }, showAll ? 'Ver solo el bloque actual' : 'Ver todos los bloques con detalle'));
}
