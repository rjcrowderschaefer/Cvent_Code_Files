import { AgendaItem } from './AgendaItem.js';

export default class AgendaList extends HTMLElement {
  constructor({ sessions = [], theme = {}, config = {} } = {}) {
    super();
    this.sessions = sessions;
    this.theme = theme;
    this.config = config;
    this._typoBindings = [];
    this._onResize = null;
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const t = this.theme || {};
    const cfg = this.config || {};
    const root = document.createElement('div');
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.gap = '12px';
    this.shadowRoot.append(root);

    const sessions = [...(this.sessions || [])].sort((a, b) => {
      const aName = (a?.name || '').toLowerCase();
      const bName = (b?.name || '').toLowerCase();
      const aStart = a?.startDateTime ? new Date(a.startDateTime).getTime() : 0;
      const bStart = b?.startDateTime ? new Date(b.startDateTime).getTime() : 0;
      switch (cfg.sort) {
        case 'nameAsc': return aName.localeCompare(bName);
        case 'dateTimeDesc': return bStart - aStart;
        case 'dateTimeAsc':
        default: return aStart - bStart;
      }
    });

    if (cfg.groupByDay === false) {
      sessions.forEach(s => root.append(this.renderItem(s, t, cfg)));
    } else {
      const groups = groupSessionsByDay(sessions);
      for (const [dayKey, daySessions] of groups) {
        const header = this.renderDayHeader(dayKey, t, cfg);
        root.append(header);
        daySessions.forEach(s => root.append(this.renderItem(s, t, cfg)));
      }
    }

    // reapply responsive on resize
    this._onResize = () => this.reapplyTypography();
    window.addEventListener('resize', this._onResize);
  }

  disconnectedCallback() {
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this._typoBindings = [];
  }

  renderDayHeader(dayKey, theme, cfg) {
    const el = document.createElement('div');
    el.textContent = formatDayKeyLabel(dayKey);
    this.applyThemeStyle(el, theme.header3, { margin: '8px 0 0 0' });
    this.applyTypographyOverrides(el, cfg.typography?.eventDate, true);
    return el;
  }

  renderItem(session, theme, cfg) {
    const item = document.createElement('agenda-item');
    item.session = session;
    item.theme = theme;
    item.config = { ...cfg, allSessions: this.sessions || [] };
    return item;
  }

  reapplyTypography() {
    for (const [el, ov] of this._typoBindings) {
      this._applyTypographyNow(el, ov);
    }
  }

  applyThemeStyle(el, themeStyleObj = {}, extra = {}) {
    const { customClasses, ...styles } = themeStyleObj || {};
    Object.assign(el.style, styles, extra);
    if (Array.isArray(customClasses) && customClasses.length) el.classList.add(...customClasses);
  }

  _activeFontSize(ov) {
    if (!ov) return undefined;
    const w = window.innerWidth || document.documentElement.clientWidth || 1920;
    if (w <= 600 && ov.fontSizeSm) return ov.fontSizeSm;
    if (w <= 1024 && ov.fontSizeMd) return ov.fontSizeMd;
    return ov.fontSize;
  }

  _applyTypographyNow(element, override) {
    const { color, bold, italic, underline } = override || {};
    const fs = this._activeFontSize(override);
    if (fs !== undefined && fs !== null && fs !== '') element.style.fontSize = `${fs}px`;
    else element.style.fontSize = '';

    if (color !== undefined) element.style.color = color || '';
    if (bold !== undefined) element.style.fontWeight = bold ? '700' : '';
    if (italic !== undefined) element.style.fontStyle = italic ? 'italic' : '';
    if (underline !== undefined) {
      const existing = getComputedStyle(element).textDecorationLine;
      const parts = new Set((existing || '').split(' ').filter(Boolean));
      if (underline) parts.add('underline'); else parts.delete('underline');
      element.style.textDecorationLine = parts.size ? Array.from(parts).join(' ') : '';
    }
  }

  applyTypographyOverrides(element, override, track = false) {
    this._applyTypographyNow(element, override);
    if (track) this._typoBindings.push([element, override || {}]);
  }
}

function groupSessionsByDay(sessions) {
  const map = new Map();
  sessions.forEach(s => {
    const d = s?.startDateTime ? new Date(s.startDateTime) : null;
    const key = d
      ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      : 'Unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  });
  return map;
}
function formatDayKeyLabel(key) {
  if (key === 'Unknown') return 'Unknown Date';
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
