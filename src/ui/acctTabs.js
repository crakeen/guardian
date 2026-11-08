// Pestañas "Total · Forward test · Cuenta…" compartidas por Diario y Métricas.
import { h } from './dom.js';
import { accountOf } from '../accounts.js';

export function acctTabs(ctx) {
  const s = ctx.state;
  const valid = ctx.ui.acct === 'all' || s.accounts.some((a) => a.id === ctx.ui.acct);
  const sel = valid ? ctx.ui.acct : 'all';
  ctx.ui.acct = sel;
  const items = [['all', 'Total', s.trades.length], ...s.accounts.map((a) => [a.id, a.name, s.trades.filter((t) => accountOf(t) === a.id).length])];
  const bar = h('div', { class: 'subtabs' }, items.map(([id, label, n]) =>
    h('button', { class: id === sel ? 'on' : '', onclick: () => { ctx.ui.acct = id; ctx.ui.openId = null; ctx.render(); } },
      label, h('small', {}, ` ${n}`))));
  return { sel, bar };
}
