// h('div', { class: 'x', onclick }, hijos...) → elemento.
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

export const num = (s) => {
  const v = parseFloat(String(s ?? '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

export const usd = (v) => `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
export const pct = (v, d = 0) => `${(v * 100).toLocaleString('es-ES', { maximumFractionDigits: d })} %`;
export const rStr = (r) => `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toLocaleString('es-ES', { maximumFractionDigits: 2 })}R`;

export const card = (title, ...kids) => h('section', { class: 'card' }, title ? h('h2', {}, title) : null, ...kids);

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', {}, hint) : null);
}

export function select(value, options, onchange) {
  return h('select', { onchange: (e) => onchange(e.target.value) },
    Object.entries(options).map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
}

export function check(ok, label, detail) {
  return h('li', { class: ok ? 'ok' : 'no' }, h('b', {}, ok ? '✓' : '✕'), h('div', {}, label, detail ? h('small', {}, detail) : null));
}

export function seg(value, options, onpick) {
  return h('div', { class: 'seg' }, Object.entries(options).map(([v, l]) =>
    h('button', { type: 'button', class: v === value ? 'on' : '', onclick: () => onpick(v) }, l)));
}
