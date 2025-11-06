// AgendaItem.js
export class AgendaItem extends HTMLElement {
  constructor({ session, theme, config }) {
    super();
    this.session = session || {};
    this.theme = theme || {};
    this.config = config || {};
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const s = this.session;
    const t = this.theme;
    const cfg = this.config;
    const DEBUG = !!cfg.debugMode;

    const root = document.createElement('div');
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.padding = '10px 12px';
    root.style.borderRadius = '8px';
    root.style.margin = '6px 0';
    root.style.background = t.palette?.secondary;
    this.shadowRoot.append(root);

    // --- Session header ---
    const titleEl = document.createElement('h1');
    titleEl.textContent = s.name || '';
    this.applyThemeStyle(titleEl, t.header2, { margin: '0 0 6px 0' });
    this.applyTypographyOverrides(titleEl, cfg.typography?.sessionName);

    const timeEl = document.createElement('div');
    const start = s.startDateTime ? new Date(s.startDateTime) : null;
    const end   = s.endDateTime   ? new Date(s.endDateTime)   : null;
    const startText = start ? start.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const endText   = end   ? end.toLocaleString('en-US',   {                timeStyle: 'short' })       : '';
    timeEl.textContent = start && end ? `${startText} – ${endText}` : (startText || '');
    this.applyThemeStyle(timeEl, t.paragraph, { margin: '0 0 6px 0' });
    this.applyTypographyOverrides(timeEl, cfg.typography?.sessionTime);

    // --- Session description (toggleable + stylable) ---
    if (cfg.showDescription && s.description) {
      const desc = document.createElement('div');
      desc.innerHTML = s.description || '';
      this.applyThemeStyle(desc, t.mainText, { margin: '0 0 8px 0' });
      this.applyTypographyOverrides(desc, cfg.typography?.sessionDescription);
      root.append(desc);
    }

    // --- Speakers ---
    const speakersWrap = document.createElement('div');
    speakersWrap.style.display = 'flex';
    speakersWrap.style.flexDirection = 'column';
    speakersWrap.style.gap = '6px';

    const speakers = this.getSpeakersArray(s);

    if (DEBUG) {
      console.groupCollapsed('[Agenda Debug] Speakers (effective)', s.name, s.id);
      console.table(speakers.map(sp => ({
        id: sp?.id,
        firstName: sp?.firstName,
        lastName: sp?.lastName,
        title: sp?.title,
        company: sp?.company
      })));
      console.groupEnd();
    }

    const pick = (...vals) => {
      for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
      return '';
    };

    speakers.forEach((sp) => {
      const firstName = (sp?.firstName || '').trim();
      const lastName  = (sp?.lastName  || '').trim();
      const jobTitle  = (sp?.title     || '').trim();
      const company   = (sp?.company   || '').trim();
      const pic       = (sp?.profilePictureUri || '').trim();

      // Speaker line: image left, text stack right (vertically centered)
      const line = document.createElement('div');
      line.style.display = 'flex';
      line.style.alignItems = 'center';
      line.style.gap = '8px';
      line.classList.add('speakerLine');

      // Image
      const img = document.createElement('img');
      img.src = pic;
      Object.assign(img.style, {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: '0'
      });

      // Info (two stacked lines)
      const infoWrap = document.createElement('div');
      infoWrap.style.display = 'flex';
      infoWrap.style.flexDirection = 'column';
      infoWrap.style.justifyContent = 'center';
      infoWrap.style.lineHeight = '1.2';

      // Line 1: Name
      const nameSpan = document.createElement('span');
      nameSpan.classList.add('speakerName');
      nameSpan.textContent = `${firstName} ${lastName}`.trim();
      this.applyThemeStyle(nameSpan, t.paragraph);
      this.applyTypographyOverrides(nameSpan, cfg.typography?.speakerName);

      // Line 2: Title + Company (independent styling)
      const metaLine = document.createElement('span');
      metaLine.style.display = 'block';

      const titleSpan = document.createElement('span');
      titleSpan.classList.add('speakerTitle');
      titleSpan.textContent = jobTitle;
      this.applyThemeStyle(titleSpan, t.paragraph);
      this.applyTypographyOverrides(titleSpan, cfg.typography?.speakerTitle);

      const comma = document.createTextNode(jobTitle && company ? ', ' : '');

      const companySpan = document.createElement('span');
      companySpan.classList.add('speakerCompany');
      companySpan.textContent = company;
      this.applyThemeStyle(companySpan, t.paragraph);
      this.applyTypographyOverrides(companySpan, cfg.typography?.speakerCompany);

      metaLine.append(titleSpan, comma, companySpan);

      // Assemble
      infoWrap.append(nameSpan, metaLine);
      line.append(img, infoWrap);
      speakersWrap.append(line);
    });

    // Append core sections (desc appended conditionally above)
    root.append(titleEl, timeEl, speakersWrap);
  }

  // Prefer resolvedSpeakers from widget.js, else unwrap legacy session.speakers entries.
  getSpeakersArray(session) {
    if (Array.isArray(session.resolvedSpeakers) && session.resolvedSpeakers.length) {
      return session.resolvedSpeakers;
    }
    if (Array.isArray(session.speakers) && session.speakers.length) {
      return session.speakers.map(x => (x && x.speaker) ? x.speaker : x).filter(Boolean);
    }
    return [];
  }

  applyThemeStyle(el, themeStyleObj = {}, extra = {}) {
    const { customClasses, ...styles } = themeStyleObj || {};
    Object.assign(el.style, styles, extra);
    if (Array.isArray(customClasses) && customClasses.length) {
      el.classList.add(...customClasses);
    }
  }

  applyTypographyOverrides(element, override) {
    if (!override) return;
    const { fontSize, color, bold, italic, underline } = override;

    // Size
    if (fontSize !== undefined && fontSize !== null && fontSize !== '') {
      element.style.fontSize = `${fontSize}px`;
    }

    // Color (allow reset via undefined)
    if (color !== undefined) {
      if (color) element.style.color = color;
      else element.style.color = '';
    }

    // Bold
    if (bold !== undefined) {
      element.style.fontWeight = bold ? '700' : '';
    }

    // Italic
    if (italic !== undefined) {
      element.style.fontStyle = italic ? 'italic' : '';
    }

    // Underline — safer: toggle only the underline line so other decorations survive
    if (underline !== undefined) {
      const existing = getComputedStyle(element).textDecorationLine;
      const parts = new Set((existing || '').split(' ').filter(Boolean));
      if (underline) parts.add('underline');
      else parts.delete('underline');
      element.style.textDecorationLine = parts.size ? Array.from(parts).join(' ') : '';
    }
  }
}

export default AgendaItem;
