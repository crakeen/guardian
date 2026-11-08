// Más: calendario de la semana, retos, ajustes y copia de seguridad.
import { h, card, field, select, check, num, usd } from './dom.js';
import { canBuy, challengeState } from '../rules/challenge.js';
import { madrid, fmtDate, fmtTime } from '../time.js';
import { download, merge, fresh } from '../store.js';
import { APP_VERSION } from '../config.js';
import { TYPES, STATUS, accountOf, activeAccount, addAccount, setActive } from '../accounts.js';

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
          const name = prompt('Nombre de la cuenta (ej. FundingPips 5K dic)', '') || '';
          const bal = num(prompt('Balance inicial de la cuenta', String(s.config.startBalance))) || s.config.startBalance;
          ctx.commit((st) => {
            addAccount(st, { name, type: 'challenge', size: bal, created: today });
            st.log.push({ type: 'challenge_buy', at: nowIso(), date: today, data: { rulesOk: cb.ok } });
            if (!cb.ok) st.log.push({ type: 'rule_break', at: nowIso(), date: today, data: { why: 'Reto comprado sin cumplir los requisitos' } });
            Object.assign(st.config, { phase: 1, lastBuy: today });
            ctx.ui.askBuy = false;
          });
        } }, 'He comprado un reto') : null,
        cs.active ? h('button', { onclick: () => {
          if (!confirm('¿Has superado la fase? Empiezan 48 h sin operar y 10 operaciones al 0,25 %.')) return;
          ctx.commit((st) => {
            st.log.push({ type: 'phase_pass', at: nowIso(), date: today, data: { phase } });
            st.config.phase = phase + 1;
            const acc = activeAccount(st);
            if (acc && phase + 1 >= 3) { acc.type = 'funded'; setActive(st, acc.id); }
          });
        } }, 'He superado la fase') : null,
        cs.active ? h('button', { class: 'ghost', onclick: () => {
          if (!confirm('¿Se ha quemado la cuenta?')) return;
          const rulesOk = confirm('¿Se quemó cumpliendo el 100 % de las reglas? Sé honesto: de esto depende si puedes comprar otro este mes.');
          ctx.commit((st) => {
            st.log.push({ type: 'challenge_burn', at: nowIso(), date: today, data: { rulesOk } });
            const acc = activeAccount(st);
            if (acc && acc.type !== 'forward') acc.status = 'burned';
            st.config.phase = 1;
            setActive(st, 'forward');
          });
          alert('Mínimo 7 días antes de pensar en otro. Primero analiza esta cuenta en Métricas.');
        } }, 'Se ha quemado la cuenta') : null)));
}

function accountsCard(ctx) {
  const s = ctx.state;
  const edit = ctx.ui.editAcc;
  const f = (ctx.ui.accForm ||= { name: '', type: 'challenge', size: 5000 });
  const form = (a) => {
    const g = (ctx.ui.accEdit ||= { ...a });
    return h('div', { class: 'accform' },
      field('Nombre', h('input', { value: g.name, oninput: (e) => { g.name = e.target.value; } })),
      a.id === 'forward' ? null : field('Tipo', select(g.type, { challenge: 'Reto', funded: 'Fondeada' }, (v) => { g.type = v; })),
      a.id === 'forward' ? null : field('Tamaño ($)', h('input', { inputmode: 'decimal', value: g.size, oninput: (e) => { g.size = num(e.target.value) || 0; } })),
      a.id === 'forward' ? null : field('Estado', select(g.status, STATUS, (v) => { g.status = v; })),
      h('div', { class: 'actions' },
        h('button', { class: 'primary', onclick: () => ctx.commit((st) => {
          const acc = st.accounts.find((x) => x.id === a.id);
          Object.assign(acc, { name: g.name || acc.name, type: g.type, size: g.size, status: g.status });
          if (st.config.activeAccount === a.id) setActive(st, a.id);
          ctx.ui.editAcc = null; ctx.ui.accEdit = null;
        }) }, 'Guardar'),
        h('button', { onclick: () => { ctx.ui.editAcc = null; ctx.ui.accEdit = null; ctx.render(); } }, 'Cancelar')));
  };
  return card('Cuentas',
    h('p', { class: 'muted' }, 'La cuenta activa recibe las operaciones nuevas y manda en el balance y el riesgo. Los topes diario y semanal cuentan para todas a la vez.'),
    s.accounts.map((a) => {
      const n = s.trades.filter((t) => accountOf(t) === a.id).length;
      const isActive = s.config.activeAccount === a.id;
      return h('div', { class: `acc ${isActive ? 'on' : ''}` },
        h('div', { class: 'row' },
          h('span', {}, h('b', {}, a.name), h('small', {}, a.type !== 'forward' ? ` · ${TYPES[a.type]} ${a.size} $ · ${STATUS[a.status] || ''}` : ' · sin dinero')),
          h('span', {}, `${n} op.`),
          isActive ? h('b', { class: 'pos' }, 'ACTIVA') : h('span', {})),
        edit === a.id ? form(a) : h('div', { class: 'actions' },
          isActive ? null : h('button', { onclick: () => ctx.commit((st) => setActive(st, a.id)) }, 'Usar para operar'),
          h('button', { class: 'ghost', onclick: () => { ctx.ui.editAcc = a.id; ctx.ui.accEdit = null; ctx.render(); } }, 'Editar')));
    }),
    h('details', {}, h('summary', {}, 'Añadir una cuenta'),
      field('Nombre', h('input', { value: f.name, placeholder: 'ej. FundingPips 5K dic', oninput: (e) => { f.name = e.target.value; } })),
      field('Tipo', select(f.type, { challenge: 'Reto', funded: 'Fondeada' }, (v) => { f.type = v; })),
      field('Tamaño ($)', h('input', { inputmode: 'decimal', value: f.size, oninput: (e) => { f.size = num(e.target.value) || 0; } })),
      h('p', { class: 'muted' }, 'Para registrar un reto que compras ahora usa "He comprado un reto" en Retos: así cuenta para tus reglas de compra. Esto es para dar de alta cuentas que ya tenías.'),
      h('button', { onclick: () => ctx.commit((st) => { addAccount(st, { name: f.name, type: f.type, size: f.size, created: madrid(ctx.now()).date }); ctx.ui.accForm = null; }) }, 'Añadir y usar para operar')));
}

function settingsCard(ctx) {
  const c = ctx.state.config;
  const f = (ctx.ui.cfg ||= { ...c });
  const firmDaily = (f.startBalance * c.firmDailyPct) / 100;
  const save = () => ctx.commit((s) => {
    const start = s.config.startBalance || 5000;
    const firm = (start * s.config.firmDailyPct) / 100;
    const own = Math.min(num(f.ownDailyUSD) || firm / 2, firm / 2);
    const weekly = Math.min(num(f.weeklyUSD) || start * 0.02, start * 0.02);
    Object.assign(s.config, { ownDailyUSD: own, weeklyUSD: weekly, commissionPerLot: num(f.commissionPerLot) ?? 5, lastBuy: f.lastBuy });
    ctx.ui.cfg = null;
  });
  return card('Ajustes',
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
    accountsCard(ctx),
    challengeCard(ctx),
    settingsCard(ctx),
    backupCard(ctx),
    h('p', { class: 'muted center' }, `Versión ${APP_VERSION} · Herramienta personal de disciplina. No es asesoría financiera.`),
  ];
}
