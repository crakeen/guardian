// Guardián: el jefe de riesgo de tu plan. Las reglas las calcula el código; no se negocian.
import { load, save } from './store.js';
import { loadCalendar, allEvents } from './news.js';
import { h } from './ui/dom.js';
import { renderToday } from './ui/today.js';
import { renderEntry } from './ui/entry.js';
import { renderJournal } from './ui/journal.js';
import { renderStats } from './ui/stats.js';
import { renderMore } from './ui/more.js';

const TABS = [
  { id: 'hoy', label: 'Hoy', icon: '◉', view: renderToday },
  { id: 'entrada', label: 'Entrada', icon: '✓', view: renderEntry },
  { id: 'diario', label: 'Diario', icon: '☰', view: renderJournal },
  { id: 'metricas', label: 'Métricas', icon: '▲', view: renderStats },
  { id: 'mas', label: 'Más', icon: '⋯', view: renderMore },
];

const FAKE_NOW = new URLSearchParams(location.search).get('now');
const state = load();
let calendar = { events: [] };
let tab = TABS.some((t) => t.id === location.hash.slice(1)) ? location.hash.slice(1) : 'hoy';

const ctx = {
  state,
  ui: {}, // estado de formularios que sobrevive a los repintados
  get calendar() { return calendar; },
  events: () => allEvents(calendar, state.news),
  // ?now=2026-11-09T08:05:00Z simula una hora concreta (solo para probar la app).
  now: () => (FAKE_NOW ? new Date(FAKE_NOW) : new Date()),
  commit(fn) {
    fn(state);
    if (!save(state)) alert('No se ha podido guardar en este dispositivo. Exporta una copia en Más.');
    render();
  },
  go(id) { tab = id; location.hash = id; render(); window.scrollTo(0, 0); },
  render: () => render(),
};

function render() {
  const t = TABS.find((x) => x.id === tab);
  const root = document.getElementById('app');
  const view = h('main', { class: 'view' }, t.view(ctx));
  const bar = h('nav', { class: 'tabs' }, TABS.map((x) =>
    h('button', { class: x.id === tab ? 'on' : '', onclick: () => ctx.go(x.id) }, h('i', {}, x.icon), h('span', {}, x.label))));
  root.replaceChildren(view, bar);
}

// Repinta cada minuto (reloj, ventanas, bloqueos que caducan) salvo si estás escribiendo.
setInterval(() => {
  const a = document.activeElement;
  if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) return;
  render();
}, 60e3);

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id !== tab && TABS.some((t) => t.id === id)) { tab = id; render(); }
});

render();
loadCalendar().then((c) => { calendar = c; render(); });
navigator.storage?.persist?.();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
