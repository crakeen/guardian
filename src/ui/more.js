// Más: calendario de la semana, retos, ajustes y copia de seguridad.
import { h, card, field, select, check, num, usd } from './dom.js';
import { canBuy, challengeState } from '../rules/challenge.js';
import { madrid, fmtDate, fmtTime, addDays } from '../time.js';
import { download, merge, fresh } from '../store.js';

const nowIso = () => new Date().toISOString();

function calendarCard(ctx) {
  const evs = ctx.events().filter((e) => ['USD', 'EUR', 'GBP'].includes(e.country) && e.impact !== 'Low');
  const byDay = {};
  for (const e of evs) (byDay[madrid(new Date(e.time)).date] ||= []).push(e);
  const f = (ctx.ui.news ||= { country: 'USD', impact: 'High' });
  return card('Calendario de la semana',
    Object.keys(byDay).length ? Object.entries(byDay).map(([d, list]) => h('div', {}, h('h3', {}, fmtDate(d)),
      list.map((e) => h('div', { class: `row news ${e.impact === 'High' ? 'high' : 'med'}` }, h('span', {}, fmtTime(new Date(e.time))), h('span', {}, `${e.country} · ${e.title}`), h('b', {}, e.impact === 'High' ? 'ALTO' : 'medio')))))
      : h('p', { class: 'muted' }, 'Sin datos del calendario.'),
    h('details', {}, h('summary', {}, 'Añadir una noticia a mano'),
      field('Fecha y hora (España)', h('input', { type: 'datetime-local', oninput: (e) => { f.when = e.target.value; } })),
      field('Divisa', select(f.country, { USD: 'USD', EUR: 'EUR', GBP: 'GBP' }, (v) => { f.country = v; })),
      field('Impacto', select(f.impact, { High: 'Alto', Medium: 'Medio' }, (v) => { f.impact = v; })),
      field('Noticia', h('input', { placeholder: 'ej. CPI m/m', oninput: (e) => { f.title = e.target.value; } })),
      h('button', { onclick: () => {
        if (!f.when || !f.title) { alert('Falta la fecha o el nombre.'); return; }
        ctx.commit((s) => { s.news.push({ title: f.title, country: f.country, impact: f.impact, date: new Date(f.when).toISOString(), manual: true }); ctx.ui.news = null; });
      } }, 'Añadir')));
}

function challengeCard(ctx) {
  const s = ctx.state;
  const cs = challengeState(s);
  const cb = canBuy(s, ctx.now());
  const today = madrid(ctx.now()).date;
  const phase = s.config.phase || 1;
  return card('Retos',
    h('div', { class: 'grid' },
      h('div', { class: 'cell' }, h('small', {}, 'Días sin comprar reto'), h('b', {}, cb.daysSinceBuy ?? '—')),
      h('div', { class: 'cell' }, h('small', {}, 'Estado'), h('b', {}, cs.active ? `Reto activo · fase ${phase === 3 ? 'Master' : phase}` : 'Forward test'))),
    ctx.ui.askBuy ? h('div', {},
      h('ul', { class: 'checks' }, cb.items.map((i) => check(i.ok, i.label, i.detail))),
      h('div', { class: `verdict ${cb.ok ? 'go' : 'stop'}` }, h('b', {}, cb.ok ? 'SE PERMITE' : 'NO COMPRES'),
        h('p', {}, cb.ok ? 'Tus números lo respaldan. Un solo reto, y vuelve a leer el plan.' : 'Tus números no lo respaldan todavía. Las ganas de comprar no son un dato.')))
      : h('button', { onclick: () => { ctx.ui.askBuy = true; ctx.render(); } }, '¿Puedo comprar un reto?'),
    h('details', {}, h('summary', {}, 'Registrar un cambio de cuenta'),
      h('div', { class: 'actions col' },
        !cs.active ? h('button', { onclick: () => {
          const msg = cb.ok ? '¿Has comprado un reto?' : 'Comprar ahora va contra tus reglas: se registrará como regla rota (24 h sin operar). ¿Lo has comprado igualmente?';
          if (!confirm(msg)) return;
          const bal = num(prompt('Balance inicial de la cuenta', String(s.config.startBalance))) || s.config.startBalance;
          ctx.commit((st) => {
            st.log.push({ type: 'challenge_buy', at: nowIso(), date: today, data: { rulesOk: cb.ok } });
            if (!cb.ok) st.log.push({ type: 'rule_break', at: nowIso(), date: today, data: { why: 'Reto comprado sin cumplir los requisitos' } });
            Object.assign(st.config, { mode: 'challenge', phase: 1, startBalance: bal, accountStart: today, lastBuy: today });
            ctx.ui.askBuy = false;
          });
        } }, 'He comprado un reto') : null,
        cs.active ? h('button', { onclick: () => {
          if (!confirm('¿Has superado la fase? Empiezan 48 h sin operar y 10 operaciones al 0,25 %.')) return;
          ctx.commit((st) => {
            st.log.push({ type: 'phase_pass', at: nowIso(), date: today, data: { phase } });
            st.config.phase = phase + 1;
            st.config.mode = phase + 1 >= 3 ? 'funded' : 'challenge';
            st.config.accountStart = addDays(today, 1);
          });
        } }, 'He superado la fase') : null,
        cs.active ? h('button', { class: 'ghost', onclick: () => {
          if (!confirm('¿Se ha quemado la cuenta?')) return;
          const rulesOk = confirm('¿Se quemó cumpliendo el 100 % de las reglas? Sé honesto: de esto depende si puedes comprar otro este mes.');
          ctx.commit((st) => {
            st.log.push({ type: 'challenge_burn', at: nowIso(), date: today, data: { rulesOk } });
            Object.assign(st.config, { mode: 'forward', phase: 1, startBalance: 5000 });
          });
          alert('Mínimo 7 días antes de pensar en otro. Primero analiza esta cuenta en Métricas.');
        } }, 'Se ha quemado la cuenta') : null)));
}

function settingsCard(ctx) {
  const c = ctx.state.config;
  const f = (ctx.ui.cfg ||= { ...c });
  const firmDaily = (f.startBalance * c.firmDailyPct) / 100;
  const save = () => ctx.commit((s) => {
    const start = num(f.startBalance) || 5000;
    const firm = (start * s.config.firmDailyPct) / 100;
    const own = Math.min(num(f.ownDailyUSD) || firm / 2, firm / 2);
    const weekly = Math.min(num(f.weeklyUSD) || start * 0.02, start * 0.02);
    Object.assign(s.config, { mode: f.mode, startBalance: start, accountStart: f.accountStart, ownDailyUSD: own, weeklyUSD: weekly, commissionPerLot: num(f.commissionPerLot) ?? 5, lastBuy: f.lastBuy });
    ctx.ui.cfg = null;
  });
  return card('Ajustes',
    field('Modo', select(f.mode, { forward: 'Forward test (sin dinero)', challenge: 'Reto (fase 1 o 2)', funded: 'Cuenta fondeada (Master)' }, (v) => { f.mode = v; })),
    field('Balance inicial ($)', h('input', { inputmode: 'decimal', value: f.startBalance, oninput: (e) => { f.startBalance = num(e.target.value) || 0; } })),
    field('Inicio de la cuenta', h('input', { type: 'date', value: f.accountStart, oninput: (e) => { f.accountStart = e.target.value; } }), 'Solo cuentan para el balance las operaciones desde esta fecha.'),
    field('Tu tope diario ($)', h('input', { inputmode: 'decimal', value: f.ownDailyUSD, oninput: (e) => { f.ownDailyUSD = e.target.value; } }), `No puede pasar de la mitad del de la firma (${usd(firmDaily / 2)}).`),
    field('Tope semanal ($)', h('input', { inputmode: 'decimal', value: f.weeklyUSD, oninput: (e) => { f.weeklyUSD = e.target.value; } }), 'Máximo el 2 % de la cuenta.'),
    field('Comisión por lote ($)', h('input', { inputmode: 'decimal', value: f.commissionPerLot, oninput: (e) => { f.commissionPerLot = e.target.value; } })),
    field('Último reto comprado', h('input', { type: 'date', value: f.lastBuy || '', oninput: (e) => { f.lastBuy = e.target.value; } })),
    h('p', { class: 'muted' }, 'Los límites solo se pueden apretar, nunca aflojar por encima del plan. Comprueba las cifras en tu panel de FundingPips: las normas cambian.'),
    h('button', { class: 'primary', onclick: save }, 'Guardar ajustes'));
}

function backupCard(ctx) {
  return card('Copia de seguridad',
    h('p', { class: 'muted' }, 'Tus datos solo están en este dispositivo. Si borras Safari o cambias de móvil, se pierden. Exporta una copia cada semana.'),
    h('div', { class: 'actions col' },
      h('button', { onclick: () => download(ctx.state) }, 'Exportar copia (.json)'),
      h('label', { class: 'button' }, 'Importar copia o Excel convertido',
        h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const data = JSON.parse(await file.text());
            let res = { added: 0, updated: 0 };
            ctx.commit((s) => { res = merge(s, data); });
            alert(`${res.added} operaciones nuevas y ${res.updated} actualizadas.`);
          } catch { alert('El archivo no es una copia válida.'); }
        } })),
      h('button', { class: 'ghost', onclick: () => {
        if (!confirm('¿Borrar TODOS los datos de este dispositivo?')) return;
        if (!confirm('No se puede deshacer. ¿Seguro? Exporta antes una copia si no lo has hecho.')) return;
        ctx.commit((s) => { Object.assign(s, fresh()); });
      } }, 'Borrar todo')));
}

export function renderMore(ctx) {
  return [
    h('header', { class: 'top' }, h('h1', {}, 'Más')),
    calendarCard(ctx),
    challengeCard(ctx),
    settingsCard(ctx),
    backupCard(ctx),
    h('p', { class: 'muted center' }, 'Herramienta personal de disciplina. No es asesoría financiera.'),
  ];
}
