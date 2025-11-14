import { sessions } from './mockSessions.js';
import { theme } from './mockTheme.js';
import { initialConfig } from './mockConfig.js';
import { AgendaItem } from './AgendaItem.js';
import AgendaList from './AgendaList.js';

customElements.define('agenda-item', AgendaItem);
customElements.define('agenda-list', AgendaList);

let config = structuredClone(initialConfig);

const mount = document.getElementById('mount');
const $ = (id) => document.getElementById(id);

function render() {
  mount.innerHTML = '';
  const list = document.createElement('agenda-list');
  list.sessions = sessions;
  list.theme = theme;
  list.config = config;
  mount.appendChild(list);
}
render();

/* ----------------- helpers for HEX inputs ----------------- */
function normalizeHex(v) {
  if (!v) return '';
  let s = v.trim().replace(/^#/,'').toUpperCase();
  if (s.length === 3) s = s.split('').map(ch => ch + ch).join('');
  return s;
}
function isValidHex6(v) { return /^[0-9A-F]{6}$/.test(v); }
function makeHexInput(initialHex, onValidHex) {
  const hex = document.createElement('input');
  hex.type = 'text';
  hex.placeholder = '#RRGGBB';
  hex.value = initialHex ? `#${normalizeHex(initialHex)}` : '#000000';
  hex.style.width = '92px';
  hex.style.height = '28px';
  hex.style.padding = '2px 6px';
  hex.style.border = '1px solid #ccc';
  hex.style.borderRadius = '6px';
  hex.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  hex.style.fontSize = '12px';

  const apply = () => {
    const norm = normalizeHex(hex.value);
    if (isValidHex6(norm)) {
      const withHash = `#${norm}`;
      onValidHex(withHash);
      hex.value = withHash;
      hex.style.borderColor = '#ccc';
    } else {
      hex.style.borderColor = '#d33';
    }
  };
  hex.addEventListener('change', apply);
  hex.addEventListener('blur', apply);
  hex.addEventListener('input', () => {
    const norm = normalizeHex(hex.value);
    hex.style.borderColor = isValidHex6(norm) ? '#0a0' : '#d33';
  });
  return hex;
}

/** ---------- BASIC CONTROLS (Agenda section) ---------- **/
$('sort').value = config.sort;
$('sort').onchange = () => { config = { ...config, sort: $('sort').value }; render(); };

$('groupByDay').checked = !!config.groupByDay;
$('groupByDay').onchange = () => { config = { ...config, groupByDay: $('groupByDay').checked }; render(); };

$('showDescription').checked = !!config.showDescription;
$('showDescription').onchange = () => { config = { ...config, showDescription: $('showDescription').checked }; render(); };

/* ---- gutterBg color + HEX input ---- */
const gutterColor = $('gutterBg');
gutterColor.value = config.gutterBg || '#e8eef9';
const gutterRow = gutterColor.parentElement;
const gutterHex = makeHexInput(gutterColor.value, (withHash) => {
  if (withHash !== gutterColor.value) gutterColor.value = withHash;
  config = { ...config, gutterBg: withHash };
  render();
});
gutterRow.appendChild(gutterHex);
gutterColor.onchange = () => {
  const v = gutterColor.value || '#000000';
  gutterHex.value = v.toUpperCase();
  config = { ...config, gutterBg: v };
  render();
};

/* ---- cardBg color + HEX input ---- */
const cardColor = $('cardBg');
cardColor.value = config.cardBg || '#ffffff';
const cardRow = cardColor.parentElement;
const cardHex = makeHexInput(cardColor.value, (withHash) => {
  if (withHash !== cardColor.value) cardColor.value = withHash;
  config = { ...config, cardBg: withHash };
  render();
});
cardRow.appendChild(cardHex);
cardColor.onchange = () => {
  const v = cardColor.value || '#000000';
  cardHex.value = v.toUpperCase();
  config = { ...config, cardBg: v };
  render();
};

/** ---------- TYPOGRAPHY CONTROLS ---------- **/

// Agenda bucket (on-card + day header)
const AGENDA_TYPO_KEYS = [
  ['eventDate',              'Event Date (day header)'],
  ['sessionName',            'Session Name'],
  ['sessionTime',            'Session Date & Start/End'],
  ['sessionDescription',     'Session Description'],
  ['speakerName',            'Speaker Name (card)'],
  ['speakerTitle',           'Speaker Title (card)'],
  ['speakerCompany',         'Speaker Company (card)']
];

// Modal bucket
const MODAL_TYPO_KEYS = [
  ['modalName',              'Modal Name (top header)'],
  ['modalSpeakerName',       'Modal Speaker Name'],
  ['modalSpeakerTitle',      'Modal Speaker Title'],
  ['modalSpeakerCompany',    'Modal Speaker Company'],
  ['modalSpeakerBio',        'Modal Speaker Bio'],
  ['modalSessionsHeader',    'Modal Sessions Header'],
  ['modalSessionName',       'Modal Session Name'],
  ['modalSessionDateTime',   'Modal Session Date & Time']
];

const typoAgenda = document.getElementById('typoAgenda');
AGENDA_TYPO_KEYS.forEach(([key, label]) => {
  typoAgenda.append(makeTypographyBlock(key, label));
});

const typoModal = document.getElementById('typoModal');
MODAL_TYPO_KEYS.forEach(([key, label]) => {
  typoModal.append(makeTypographyBlock(key, label));
});

/* ---------- Modal color controls (header/bg/divider) ---------- */
(function addModalColorControls(){
  const modalSection = document.getElementById('modalSection').querySelector('.block');

  const mkColorRow = (labelText, colorId, current, onChange) => {
    const wrap = document.createElement('div');
    wrap.className = 'row field';

    const lbl = document.createElement('label');
    lbl.textContent = labelText;

    const input = document.createElement('input');
    input.type = 'color';
    input.id = colorId;
    input.value = current;

    const hex = makeHexInput(current, (withHash) => {
      if (withHash !== input.value) input.value = withHash;
      onChange(withHash);
      render();
    });

    input.onchange = () => {
      const v = input.value || '#000000';
      hex.value = v.toUpperCase();
      onChange(v);
      render();
    };

    wrap.append(lbl, input, hex);
    return wrap;
  };

  const h = document.createElement('h3');
  h.textContent = 'Modal Colors';
  modalSection.prepend(h);

  const headerRow = mkColorRow(
    'Header background',
    'modalHeaderBg',
    config.modalColors?.headerBg || '#ffffff',
    (v) => { config = { ...config, modalColors: { ...config.modalColors, headerBg: v } }; }
  );

  const dividerRow = mkColorRow(
    'Divider line',
    'modalDivider',
    config.modalColors?.dividerColor || '#eeeeee',
    (v) => { config = { ...config, modalColors: { ...config.modalColors, dividerColor: v } }; }
  );

  const contentRow = mkColorRow(
    'Content background',
    'modalContentBg',
    config.modalColors?.contentBg || '#ffffff',
    (v) => { config = { ...config, modalColors: { ...config.modalColors, contentBg: v } }; }
  );

  modalSection.insertBefore(headerRow, modalSection.querySelector('#typoModal'));
  modalSection.insertBefore(dividerRow, modalSection.querySelector('#typoModal'));
  modalSection.insertBefore(contentRow, modalSection.querySelector('#typoModal'));
})();

/* ---------- Typography block UI ---------- */
function makeTypographyBlock(key, label) {
  const fs = document.createElement('fieldset');
  const lg = document.createElement('legend');
  lg.textContent = label;
  fs.append(lg);

  // row: base size + MD + SM
  const rowSizes = document.createElement('div');
  rowSizes.className = 'row field';

  const mkSize = (lbl, prop) => {
    const wrap = document.createElement('div');
    const l = document.createElement('label'); l.textContent = lbl;
    const i = document.createElement('input');
    i.type = 'number'; i.min = '10'; i.max = '72'; i.placeholder = 'default';
    i.value = config.typography?.[key]?.[prop] ?? '';
    i.oninput = () => {
      const val = i.value === '' ? undefined : Math.max(10, Math.min(72, Number(i.value) || undefined));
      setTypo(key, { [prop]: val }); render();
    };
    wrap.append(l, document.createElement('br'), i);
    return wrap;
  };

  rowSizes.append(
    mkSize('Font size (px)', 'fontSize'),
    mkSize('≤1024px (px)', 'fontSizeMd'),
    mkSize('≤600px (px)',  'fontSizeSm')
  );

  // row: color + HEX
  const rowColor = document.createElement('div');
  rowColor.className = 'row field';

  const colorWrap = document.createElement('div');
  const colorLbl = document.createElement('label'); colorLbl.textContent = 'Color';
  const colorInput = document.createElement('input'); colorInput.type = 'color';
  colorInput.value = config.typography?.[key]?.color || '#000000';
  colorWrap.append(colorLbl, document.createElement('br'), colorInput);

  const hexWrap = document.createElement('div');
  const hexLbl = document.createElement('label'); hexLbl.textContent = 'HEX';
  const initialHex = config.typography?.[key]?.color || '#000000';
  const hexInput = makeHexInput(initialHex, (withHash) => {
    if (withHash !== colorInput.value) colorInput.value = withHash;
    setTypo(key, { color: withHash }); render();
  });
  hexWrap.append(hexLbl, document.createElement('br'), hexInput);

  colorInput.onchange = () => {
    const v = colorInput.value || '#000000';
    hexInput.value = v.toUpperCase();
    setTypo(key, { color: v }); render();
  };

  // row: bold / italic / underline
  const rowBIU = document.createElement('div');
  rowBIU.className = 'row field';
  rowBIU.append(
    makeFlag(key, 'bold', 'Bold'),
    makeFlag(key, 'italic', 'Italic'),
    makeFlag(key, 'underline', 'Underline')
  );

  // reset
  const reset = document.createElement('button');
  reset.className = 'reset';
  reset.type = 'button';
  reset.textContent = 'Use event default';
  reset.onclick = () => {
    setTypo(key, {
      fontSize: undefined, fontSizeMd: undefined, fontSizeSm: undefined,
      color: undefined, bold: undefined, italic: undefined, underline: undefined
    });
    rowSizes.querySelectorAll('input[type="number"]').forEach(i => i.value = '');
    colorInput.value = '#000000';
    hexInput.value = '#000000';
    rowBIU.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    render();
  };

  fs.append(rowSizes, rowColor, hexWrap, rowBIU, reset);
  return fs;
}

function makeFlag(key, prop, label) {
  const wrap = document.createElement('label');
  wrap.style.display = 'inline-flex';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '6px';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!config.typography?.[key]?.[prop];
  cb.onchange = () => { setTypo(key, { [prop]: cb.checked }); render(); };

  const txt = document.createElement('span');
  txt.textContent = label;

  wrap.append(cb, txt);
  return wrap;
}

function setTypo(key, patch) {
  config = {
    ...config,
    typography: {
      ...config.typography,
      [key]: { ...(config.typography?.[key] || {}), ...patch }
    }
  };
}
