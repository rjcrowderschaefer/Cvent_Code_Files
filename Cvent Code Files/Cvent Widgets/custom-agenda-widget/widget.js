// widget.js
import { AgendaItem } from './AgendaItem.js';

export default class extends HTMLElement {
  constructor({ configuration, theme }) {
    super();
    this.configuration = configuration || {};
    this.theme = theme;
    this.attachShadow({ mode: 'open' });

    if (!customElements.get('namespace-agenda-item')) {
      customElements.define('namespace-agenda-item', AgendaItem);
    }
  }

  async connectedCallback() {
    const cfg = this.configuration || {};
    const t = this.theme || {};
    const DEBUG = !!cfg.debugMode;

    // Container
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.width = '100%';
    this.shadowRoot.append(container);

    // 1) Sessions
    const pageSize = Math.max(10, Math.min(300, cfg.maxResults || 100));
    const sort = cfg.sort || 'dateTimeAsc';
    const sessionGen = await this.getSessionGenerator(sort, pageSize);

    const sessions = [];
    for await (const page of sessionGen) sessions.push(...(page.sessions || []));

    // 2) Speaker IDs (many shapes supported)
    const allIds = new Set();
    const grabId = v => { if (v && typeof v === 'string') allIds.add(v); };

    sessions.forEach(s => {
      // Newer shape
      if (Array.isArray(s.speakerIds)) s.speakerIds.forEach(grabId);

      // Legacy arrays with various entry shapes
      if (Array.isArray(s.speakers)) {
        s.speakers.forEach(sp => {
          grabId(sp?.id);
          grabId(sp?.speaker?.id);
          grabId(sp?.speakerId);
          grabId(sp?.personId);
        });
      }
    });

    const speakerIds = [...allIds];
    if (DEBUG) console.log('[Agenda Debug] Speaker IDs collected:', speakerIds);

    // 3) Fetch speakers via getSpeakers (returns an ID->SpeakerDetail map)
    const sdk = this.cventSdk || window.cventSdk || {};
    let speakersById = {};
    if (typeof sdk.getSpeakers === 'function' && speakerIds.length) {
      try {
        speakersById = await sdk.getSpeakers(speakerIds);
        if (DEBUG) {
          console.groupCollapsed('[Agenda Debug] Speakers fetched via getSpeakers');
          console.table(Object.values(speakersById).map(sp => ({
            id: sp.id,
            firstName: sp.firstName,
            lastName: sp.lastName,
            title: sp.title,
            company: sp.company,
            designation: sp.designation
          })));
          console.groupEnd();
        }
      } catch (e) {
        console.error('[Agenda Debug] getSpeakers() failed:', e);
      }
    } else if (DEBUG) {
      console.warn('[Agenda Debug] getSpeakers() not available or no IDs to fetch.');
    }

    // 4) Attach resolvedSpeakers to each session
    sessions.forEach(s => {
      // Build the id list again for this session
      const ids = [
        ...(Array.isArray(s.speakerIds) ? s.speakerIds : []),
        ...(Array.isArray(s.speakers) ? s.speakers.map(sp => sp?.id).filter(Boolean) : []),
        ...(Array.isArray(s.speakers) ? s.speakers.map(sp => sp?.speaker?.id).filter(Boolean) : []),
        ...(Array.isArray(s.speakers) ? s.speakers.map(sp => sp?.speakerId).filter(Boolean) : []),
        ...(Array.isArray(s.speakers) ? s.speakers.map(sp => sp?.personId).filter(Boolean) : [])
      ];

      const resolved = ids.map(id => speakersById[id]).filter(Boolean);

      // Fallback if API map returned empty (use embedded legacy objects)
      s.resolvedSpeakers = resolved.length
        ? resolved
        : (Array.isArray(s.speakers) ? s.speakers.map(x => x?.speaker ?? x).filter(Boolean) : []);
    });

    // 5) Render (group by day optional)
    const renderDayGroup = (label) => {
      const h = document.createElement('h2');
      h.textContent = label;
      Object.assign(h.style, { ...(t.header1 || {}), margin: '16px 0 8px 0' });
      const ov = cfg.typography?.eventDate;
      if (ov) {
        if (ov.fontSize !== undefined && ov.fontSize !== null && ov.fontSize !== '') {
          h.style.fontSize = `${ov.fontSize}px`;
        }
        if (ov.color) h.style.color = ov.color;
      }
      container.append(h);
    };

    const byDay = s =>
      new Date(s.startDateTime).toLocaleDateString('en-US', { dateStyle: 'full' });

    const renderOne = s => {
      container.append(new AgendaItem({ session: s, theme: this.theme, config: cfg }));
    };

    if (cfg.groupByDay) {
      let currentDay = null;
      sessions.forEach(s => {
        const day = byDay(s);
        if (day !== currentDay) { currentDay = day; renderDayGroup(day); }
        renderOne(s);
      });
    } else {
      sessions.forEach(renderOne);
    }
  }
}
