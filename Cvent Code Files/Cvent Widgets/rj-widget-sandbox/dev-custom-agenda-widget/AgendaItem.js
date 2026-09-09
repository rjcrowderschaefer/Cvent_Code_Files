// AgendaItem.js
// Reusable custom element used by widget.js (registered as <vertical-agenda-layout>)

export class AgendaItem extends HTMLElement {
  constructor() {
    super();
    // Properties will be assigned by widget.js *before* append()
    this.session = {};
    this.theme = {};
    this.config = {};

    this._typoBindings = [];
    this._onResize = null;

    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    const t = this.theme || {};
    const cfg = this.config || {};
    const s = this.session || {};

    // Concurrent tile mode: render a compact, height-adaptive tile instead of
    // the full card. Everything below (the full-card path) is left untouched.
    if (cfg.tileMode === true) {
      this._renderTile(s, t, cfg);
      return;
    }

    const isBreak = cfg.isBreak === true;
    const bs = cfg.breakStyle || {};

    // Session-type accent is OFF by default so existing events are unchanged.
    // When off: no accent bar, and focus sessions render like normal plenary.
    const accentOn = cfg.showAccentBar === true;
    const isFocus = accentOn && cfg.isFocus === true;
    const plenaryAccent = cfg.plenaryAccent || "#f7a325";
    const focusAccent = cfg.focusAccent || "#1a7f8e";

    // Accent bar color: break sessions match their gutter bg; else focus/plenary.
    const breakGutterBg = bs.gutterBg || "#e8eaed";
    const typeAccent = isBreak
      ? breakGutterBg
      : isFocus
      ? focusAccent
      : plenaryAccent;

    // Gutter color priority: break > focus > plenary/default.
    // Focus sessions recolor the gutter to the focus accent (with light text).
    const gutterBg = isBreak
      ? breakGutterBg
      : isFocus
      ? focusAccent
      : cfg.gutterBg || t.palette?.accent || "#e8eef9";
    const cardBg = isBreak
      ? bs.cardBg || "#f7f7f5"
      : cfg.cardBg || t.palette?.secondary || "#ffffff";

    const showMoreColor =
      cfg.showMoreColor ||
      cfg?.typography?.sessionDescription?.color ||
      "#0066cc";

    const modalHeaderBg = cfg.modalColors?.headerBg ?? "#ffffff";
    const modalDivider = cfg.modalColors?.dividerColor ?? "#eeeeee";
    const modalContentBg = cfg.modalColors?.contentBg ?? "#ffffff";

    const style = document.createElement("style");
    style.textContent = `
      :host { 
        display: block;
        font-family: inherit;
      }
      
      .sessionTitle {
      padding-top: 0px !important;
      padding-bottom: 0px !important;
      line-height: 24px !important;
      }

      .card {
        display: grid;
        grid-template-columns: 80px 1fr;
        background: ${cardBg};
        border-radius: 8px;
        overflow: hidden;
        width: calc(100% - 40px); /* 20px on each side */
        max-width: 1210px;
        margin: 0 auto;  /* centers it on any screen */
        box-sizing: border-box;
      }

      .date-header {
        margin-left: 50px;
        border-bottom: 1px solid ${gutterBg} !important;
        padding-right: 20px;
        padding-left: 20px;
      }

      .content h1 {
        margin-bottom: 2px !important;
        margin-top: 0 !important;
        line-height: 1.2;
      }
      
      .timeGutter {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        text-align: left;
        gap: 4px;
        padding: 10px 8px;
        background: ${gutterBg};
        align-self: stretch;
      }

      .timePart { 
      line-height: 1.1;
      white-space: nowrap;
      }

      .timeTz {
      font-size: 12px !important;
      font-style: italic !important;
      font-weight: normal !important;
      }

      .content {
        display: flex;
        flex-direction: column;
        padding: 10px 12px;
        gap: 8px;
        min-width: 0;
      }

      .sessionLocation {
        display: inline-flex;          
        align-items: center;
        gap: 2px;                     
        align-self: flex-start;
        font-weight: 400;
        text-transform: uppercase;
      }

      .sessionLocationIcon {
        width: 12px;
        height: 12px;
        object-fit: contain;
        display: inline-block;
      }

      .sessionCategory {
        display: inline-flex;          
        align-items: center;
        gap: 3px;                     
        align-self: flex-start;
        font-weight: 400;
        text-transform: uppercase;
      }

      .sessionCategoryIcon {
        width: 12px;
        height: 12px;
        object-fit: contain;
        display: inline-block;
      }

      .sessionMetaRow {
        display: flex;
        align-items: center;
        column-gap: 15px;
        row-gap: 8px;
        flex-wrap: wrap;
        align-self: flex-start;
      }

      .speakersWrap {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        column-gap: 16px;
        row-gap: 12px;
      }

      .speakersWrap[data-count="1"] {
      grid-template-columns: minmax(0, 1fr);
      }

      .speakerLine {
        display: flex;
        gap: 10px;
        cursor: pointer;
      }

      .avatar {
        width: 50px;
        height: 50px;
        border: none;
        object-fit: cover;
        flex-shrink: 0;
        align-self: flex-start;
      }
      
      .info {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        line-height: 1.2;
        min-width: 0;
      }

      .truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .speakerTitle {
        white-space: normal;
        overflow: visible;
        text-overflow: unset;
        word-break: break-word;
      }

      .speakerCompany {
        white-space: normal;
        overflow: visible; 
        text-overflow: unset;
        word-break: break-word;
      }

      .sessionDescriptionBlock {
        position: relative;
        margin: 0 !important;
        padding: 0;
      }

      .sessionDescriptionBlock .desc-text {
        margin: 0;
        padding: 0;
      }

      .sessionDescriptionBlock .desc-text p {
        margin: 0;
        padding: 0;
      }

      .sessionDescriptionBlock .desc-text > *:first-child {
        margin-top: 0 !important;
      }

      .sessionDescriptionBlock .desc-text > *:last-child {
        margin-bottom: 0 !important;
      }


      .desc-limited {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* Mobile-only 4-line clamp (applied when editor 'limited' toggle is OFF) */
      .desc-mobile-clamp {
        display: -webkit-box !important;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .mobile-desc-toggle {
        cursor: pointer;
        font-size: 13px;
        margin-top: 2px;
        margin-bottom: 10px;
        text-decoration: underline;
        color: ${typeAccent} !important;
      }

      .show-more-toggle {
        cursor: pointer;
        font-size: 14px;
        margin-top: 4px;
        text-decoration: underline;
        color: ${showMoreColor} !important;
      }


      .show-more-toggle:hover {
        opacity: 0.75;
      }

      .sessionDescriptionBlock.expanded .desc-limited {
        -webkit-line-clamp: unset;
        display: block;
      }

      .sessionDescriptionBlock.expanded .show-more {
        display: none;
      }

    /* --- Limited description mode --- */
      .desc-limited {
        display: -webkit-box;
        -webkit-line-clamp: 2;   /* 2-line clamp */
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .speakerMeta {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

        .speakerTitle {
        display: block;
        margin-bottom: 2px;
        white-space: normal;
        overflow: visible;
        text-overflow: unset;
        word-break: break-word;
        }

        .speakerCompany {
        display: block;
        white-space: normal;
        overflow: visible;
        text-overflow: unset;
        word-break: break-word;
      }

      /* ===== Modal ===== */
      .backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.45);
        display: none;
        place-items: center;
        z-index: 999999;
      }
      .backdrop[open] { 
        display: grid; 
      }

      .modal {
        width: min(720px, 92vw);
        max-height: 90vh;
        overflow: auto;
        background: #fff; /* container background */
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
      }

      .modalHeader {
        display:flex; align-items:center;
        justify-content:space-between;
        padding: 12px 16px;
        background: ${modalHeaderBg};
        border-bottom: 1px solid ${modalDivider};
      }

      .modalTitle { /* styled via cfg.typography.modalName */ }
      .closeBtn {
        appearance: none; border: none; background: transparent;
        font-size: 20px; cursor: pointer; line-height: 1;
      }

      .modalBody {
      padding: 16px;
      display: grid;
      grid-template-columns: 125px 1fr;
      grid-auto-rows: auto;
      column-gap: 14px;
      row-gap: 2px;
      background: ${modalContentBg};
    }

    /* Row 1, col 1: avatar */
    .modalAvatar {
      width: 125px;
      height: 125px;
      object-fit: cover;
      grid-column: 1;
      grid-row: 1;
    }

    /* Row 1, col 2: name/title/company */
    .modalDetails {
      grid-column: 2;
      grid-row: 1;
      margin-top: 20px;
    }

    .kv { 
      margin: 2px 0; 
    }

    /* Row 2: bio, full width starting under avatar */
    .bio {
      margin: 5px 0 0 0;
      line-height: 1.45;
      grid-column: 1 / -1; /* span both columns */
      grid-row: 2;
    }

    /* Row 3: sessions header full width */
    .sessionsHeader { 
      margin-top: 10px;
      grid-column: 1 / -1;
      grid-row: 3;
    }

    /* Row 4: sessions list full width */
    .sessionsList { 
      margin: 0 0 0 18px;
      padding: 0;
      grid-column: 1 / -1;
      grid-row: 4;
    }

    .sessionsList li {
      margin: 0 0;
    }

    .modalBody > div > div:first-child {
      display: none !important;
      }

      @media (max-width: 1024px) {
  .card {
    grid-template-columns: 80px 1fr;
    width: calc(100% - 40px);
  }

  .speakersWrap {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .speakersWrap[data-count="1"] {
    grid-template-columns: minmax(0, 1fr) !important;
  }
}

@media (max-width: 600px) {
  .card {
    grid-template-columns: 70px 1fr;
    width: calc(100% - 30px);
  }

  .speakersWrap {
    grid-template-columns: 1fr !important;
  }

  .truncate {
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
  }

  .speakerTitle {
    display: block;
    margin-bottom: 2px;
  }

  .speakerCompany {
    display: block;
  }

  .comma-node {
    display: none;
  }

  .modalBody > div.modalDetails > div:first-child {
    display: none !important;
  }

  .sessionsList li {
    margin: 2px 0 !important;
    line-height: 1.3 !important;
    padding: 0 !important;
  }

  .timeTz {
      font-size: 10px !important;
      }
}

    `;
    this.shadowRoot.append(style);

    // Root card
    const card = document.createElement("div");
    card.classList.add("card");
    this.shadowRoot.append(card);

    // Session-type accent bar across the top of every card (plenary or focus)
    const accentBar = document.createElement("div");
    accentBar.classList.add("typeAccentBar");
    accentBar.style.height = "6px";
    accentBar.style.width = "100%";
    accentBar.style.background = typeAccent;
    accentBar.style.flexShrink = "0";

    const border = cfg.cardBorder || {
      width: 0.5,
      style: "solid",
      color: "#cccccc",
    };

    if (!border.width || border.width === 0 || border.style === "none") {
      card.style.border = "none";
    } else {
      card.style.border = `${border.width}px ${border.style} ${border.color}`;
    }

    // Time gutter
    const start = s.startDateTime ? new Date(s.startDateTime) : null;
    const end = s.endDateTime ? new Date(s.endDateTime) : null;
    const tz = cfg.eventTimezone || "America/New_York";

    const startText = start
      ? start.toLocaleString("en-US", { timeStyle: "short", timeZone: tz })
      : "";
    const endText = end
      ? end.toLocaleString("en-US", { timeStyle: "short", timeZone: tz })
      : "";

    // Auto-detected abbreviation (fallback when no override is set)
    const autoTzAbbr = start
      ? start
          .toLocaleString("en-US", { timeZoneName: "short", timeZone: tz })
          .split(" ")
          .pop()
      : "";

// Timezone label resolution:
    //   showTimezone === false      -> hidden entirely
    //   non-empty override          -> use that static text
    //   blank override              -> auto (DST-aware, per session date)
    const overrideAbbr =
      typeof cfg.timezoneAbbr === "string" ? cfg.timezoneAbbr.trim() : "";
    const showTz = cfg.showTimezone !== false;
    const tzAbbr = showTz ? overrideAbbr || autoTzAbbr : "";

    const gutter = document.createElement("div");
    gutter.classList.add("timeGutter");

    const timeStartEl = document.createElement("div");
    timeStartEl.classList.add("timePart", "timeStart");
    timeStartEl.textContent = startText || "";
    this.applyThemeStyle(timeStartEl, t.paragraph);
    this.applyTypographyOverrides(
      timeStartEl,
      cfg.typography?.sessionTime,
      !isBreak && !isFocus
    );

    const timeEndEl = document.createElement("div");
    timeEndEl.classList.add("timePart", "timeEnd");
    timeEndEl.textContent = endText || "";
    this.applyThemeStyle(timeEndEl, t.paragraph);
    this.applyTypographyOverrides(
      timeEndEl,
      cfg.typography?.sessionTime,
      !isBreak && !isFocus
    );

    // Gutter text color overrides (untracked typography above prevents a
    // resize re-apply from stomping these). Break wins, then focus.
    if (isBreak) {
      const bt = bs.gutterText || "#5f5e5a";
      timeStartEl.style.color = bt;
      timeEndEl.style.color = bt;
    } else if (isFocus) {
      const ft = cfg.focusGutterText || "#e8f6f8";
      timeStartEl.style.color = ft;
      timeEndEl.style.color = ft;
    }

    gutter.append(timeStartEl, timeEndEl);

    if (showTz && tzAbbr) {
      const tzEl = document.createElement("div");
      tzEl.classList.add("timePart", "timeTz");
      tzEl.textContent = tzAbbr;
      this.applyThemeStyle(tzEl, t.paragraph);
      this.applyTypographyOverrides(
        tzEl,
        cfg.typography?.sessionTime,
        !isBreak && !isFocus
      );
      // Recolor tz label to match the gutter text (break, then focus)
      if (isBreak) {
        tzEl.style.color = bs.gutterText || "#5f5e5a";
      } else if (isFocus) {
        tzEl.style.color = cfg.focusGutterText || "#e8f6f8";
      }
      gutter.append(tzEl);
    }

    // Content
    const content = document.createElement("div");
    content.classList.add("content");

    // Focus tag — small pill placed top-right ON THE SAME LINE as the title.
    let focusTag = null;
    if (isFocus) {
      const focusLabel =
        typeof cfg.focusLabel === "string" && cfg.focusLabel.trim()
          ? cfg.focusLabel.trim()
          : "Focus";
      focusTag = document.createElement("div");
      const lang = cfg.eventLang || "en";
      focusTag.textContent =
        lang === "es"
          ? `sesión de ${focusLabel}`
          : lang === "pt"
          ? `sessão de ${focusLabel}`
          : `${focusLabel} session`;
      focusTag.style.flexShrink = "0";
      focusTag.style.fontSize = "11px";
      focusTag.style.fontWeight = "600";
      focusTag.style.textTransform = "uppercase";
      focusTag.style.letterSpacing = "0.04em";
      focusTag.style.color = "#ffffff";
      focusTag.style.background = focusAccent;
      focusTag.style.padding = "2px 8px";
      focusTag.style.borderRadius = "10px";
      focusTag.style.alignSelf = "flex-start";
      focusTag.style.marginTop = "2px";
    }

    // Title
    const titleEl = document.createElement("div");
    titleEl.textContent = s.name || "";
    titleEl.classList.add("sessionTitle");
    this.applyThemeStyle(titleEl, t.header2, { margin: "0" });

    // Apply title typography to the text element itself, always — so break
    // titles (which get wrapped in a flex row for the icon) match normal titles.
    this.applyTypographyOverrides(titleEl, cfg.typography?.sessionName, true);

    // Break icon inline-left of the title (only when a Break type is set)
    let titleNode = titleEl;
    if (isBreak && cfg.breakType) {
      const iconSize = bs.iconSize ?? 20;
      const iconColor = bs.iconColor || bs.gutterText || "#5f5e5a";
      const icon = this._breakIconSvg(cfg.breakType, iconSize, iconColor);
      if (icon) {
        const titleRow = document.createElement("div");
        titleRow.style.display = "flex";
        titleRow.style.alignItems = "center";
        titleRow.style.gap = "4px";
        titleRow.append(icon, titleEl);
        titleNode = titleRow;
      }
    }
    // If there's a focus tag, put title + tag on one line (tag pinned right).
    if (focusTag) {
      const titleRow = document.createElement("div");
      titleRow.style.display = "flex";
      titleRow.style.alignItems = "flex-start";
      titleRow.style.justifyContent = "space-between";
      titleRow.style.gap = "12px";
      titleRow.style.width = "100%";
      // titleNode should flex to fill; tag stays at its size on the right.
      titleNode.style.flex = "1 1 auto";
      titleNode.style.minWidth = "0";
      titleRow.append(titleNode, focusTag);
      content.append(titleRow);
    } else {
      content.append(titleNode);
    }

    // Location & Category
    const locationName =
      s &&
      s.location &&
      typeof s.location.name === "string" &&
      s.location.name.trim()
        ? s.location.name.trim()
        : "";

    const categoryName =
      s &&
      s.category &&
      typeof s.category.name === "string" &&
      s.category.name.trim()
        ? s.category.name.trim()
        : "";

    if (locationName || categoryName) {
      const metaRow = document.createElement("div");
      metaRow.classList.add("sessionMetaRow");

      if (locationName) {
        const locationEl = document.createElement("div");
        locationEl.classList.add("sessionLocation");

        const locationIcon = document.createElement("img");
        locationIcon.src =
          "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/840e234ada7e4fe585bf4ce841c2d3b5.png";
        locationIcon.classList.add("sessionLocationIcon");

        const locationText = document.createElement("span");
        locationText.textContent = locationName;

        locationEl.append(locationIcon, locationText);

        this.applyTypographyOverrides(
          locationEl,
          (cfg.typography && cfg.typography.sessionLocation) || {},
          true
        );

        metaRow.append(locationEl);
      }

      if (categoryName) {
        const categoryEl = document.createElement("div");
        categoryEl.classList.add("sessionCategory");

        const categoryIcon = document.createElement("img");
        categoryIcon.src =
          "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/5379adb990964836bd3e0bfdf2c9ce44.png";
        categoryIcon.classList.add("sessionCategoryIcon");

        const categoryText = document.createElement("span");
        categoryText.textContent = categoryName;

        categoryEl.append(categoryIcon, categoryText);

        this.applyTypographyOverrides(
          categoryEl,
          (cfg.typography && cfg.typography.sessionCategory) || {},
          true
        );

        metaRow.append(categoryEl);
      }
      content.append(metaRow);
    }

    // Description (optionally skipped on breaks)
    if (s.description && !(isBreak && bs.hideDescription === true)) {
      const wrap = document.createElement("div");
      wrap.classList.add("sessionDescriptionBlock");

      const text = document.createElement("div");
      text.classList.add("desc-text");
      text.innerHTML = s.description;

      this.applyThemeStyle(text, t.mainText);
      this.applyTypographyOverrides(
        text,
        cfg.typography?.sessionDescription,
        true
      );

      wrap.append(text);

      // Apply Show Description toggle
      if (!cfg.showDescription && !cfg.showDescriptionLimited) {
        wrap.style.display = "none";
      }

      // Limited mode (2 lines + toggle)
      if (cfg.showDescriptionLimited) {
        text.classList.add("desc-limited");

        const toggle = document.createElement("div");
        toggle.classList.add("show-more-toggle");
        toggle.textContent = "Show more";

        let expanded = false;
        toggle.onclick = () => {
          expanded = !expanded;
          if (expanded) {
            text.classList.remove("desc-limited");
            toggle.textContent = "Show less";
          } else {
            text.classList.add("desc-limited");
            toggle.textContent = "Show more";
          }
        };

        this.applyThemeStyle(toggle, t.mainText);
        this.applyTypographyOverrides(
          toggle,
          cfg.typography?.sessionDescription,
          true
        );

        wrap.append(toggle);
      } else {
        // Editor 'limited' toggle OFF: apply the mobile-only 4-line clamp
        // (desktop shows full; <=600px clamps with show more/less).
        this._applyMobileDescClamp(text, wrap);
      }

      content.append(wrap);
    }

    
    // Speakers (skipped on breaks when configured)
    if (!(isBreak && bs.hideSpeakers !== false)) {
      const speakersWrap = document.createElement("div");
      speakersWrap.classList.add("speakersWrap");

      const speakers = this.getSpeakersArray(s);
      speakers.forEach((sp) => speakersWrap.append(this.renderSpeakerLine(sp)));
      speakersWrap.dataset.count = speakers.length;
      content.append(speakersWrap);
    } 

    // Assemble — accent bar (when enabled) spans full width on top
    if (accentOn) {
      accentBar.style.gridColumn = "1 / -1";
      card.append(accentBar, gutter, content);
    } else {
      card.append(gutter, content);
    }

    // Modal element (single, reused). Focus tinting is applied in
    // openModalForSpeaker (after typography) so it isn't overridden.
    this.modal = this.buildModal();
    this.shadowRoot.append(this.modal.backdrop);

    // Keyboard escape
    this.shadowRoot.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") this.closeModal();
      },
      { capture: true }
    );

    // Reapply responsive typography on resize
    this._onResize = () => this.reapplyTypography();
    window.addEventListener("resize", this._onResize);
  }

  // ===========================================================
  // CONCURRENT TILE MODE (compact, height-adaptive)
  // ===========================================================
  _renderTile(s, t, cfg) {
    const tz = cfg.eventTimezone || "America/New_York";
    const accentOn = cfg.showAccentBar === true;
    const isFocus = accentOn && cfg.isFocus === true;
    const isBreak = cfg.isBreak === true;
    const bs = cfg.breakStyle || {};
    const plenaryAccent = cfg.plenaryAccent || "#f7a325";
    const focusAccent = cfg.focusAccent || "#1a7f8e";
    const breakGutterBg = bs.gutterBg || "#e8eaed";
    const accentColor = isBreak
      ? breakGutterBg
      : isFocus
      ? focusAccent
      : plenaryAccent;

    // Tile background matches the standalone card's cardBg logic so both use the
    // same editor "Card Bg" setting (break sessions use their own break card bg).
    const tileCardBg = isBreak
      ? bs.cardBg || "#f7f7f5"
      : cfg.cardBg || t.palette?.secondary || "#ffffff";

    // Resolve font styling from the SAME typography config the standalone cards
    // use, so tiles and standalone cards match. Returns responsive CSS pieces.
    const typo = cfg.typography || {};
    const activeSize = (ov) => {
      if (!ov) return undefined;
      const w =
        window.innerWidth || document.documentElement.clientWidth || 1920;
      if (w <= 600 && ov.fontSizeSm) return ov.fontSizeSm;
      if (w <= 1024 && ov.fontSizeMd) return ov.fontSizeMd;
      return ov.fontSize;
    };
    const cssFor = (key, fallbackPx) => {
      const ov = typo[key] || {};
      const size = activeSize(ov);
      const parts = [];
      parts.push(`font-size:${size ? size + "px" : fallbackPx};`);
      if (ov.bold !== undefined)
        parts.push(`font-weight:${ov.bold ? "700" : "400"};`);
      if (ov.italic) parts.push("font-style:italic;");
      if (ov.color) parts.push(`color:${ov.color};`);
      return parts.join("");
    };
    // Title/speaker-name colors: on tiles we don't invert them the way the
    // gutter does, so use the configured color if present, else sensible tile
    // defaults.
    // Pull base weight/family from the theme (the standalone card applies these
    // via applyThemeStyle before the typography override, so tiles must too to
    // match). Only weight and family carry over; sizes come from typography.
    const themeCss = (themeObj) => {
      const o = themeObj || {};
      const parts = [];
      if (o.fontFamily) parts.push(`font-family:${o.fontFamily};`);
      if (o.fontWeight) parts.push(`font-weight:${o.fontWeight};`);
      return parts.join("");
    };
    const titleThemeCss = themeCss(t.header2);
    const bodyThemeCss = themeCss(t.paragraph);

    const titleCss = titleThemeCss + cssFor("sessionName", "14px");
    // Time on a tile sits on a light card (no colored gutter), so the
    // sessionTime color (often white for the gutter) would be invisible.
    // Use the configured color only if it's not white; else a readable gray.
    const rawTimeColor = (typo.sessionTime && typo.sessionTime.color) || "";
    const timeColorOk =
      rawTimeColor &&
      !["#fff", "#ffffff", "white"].includes(rawTimeColor.toLowerCase());
    const timeColorCss = timeColorOk ? `color:${rawTimeColor};` : "color:#666;";
    const timeCss = bodyThemeCss + cssFor("sessionTime", "11px") + timeColorCss;
    const descCss = bodyThemeCss + cssFor("sessionDescription", "12px");
    const spkNameBase = bodyThemeCss + cssFor("speakerName", "12px");
    // Focus sessions: speaker names use the focus accent (overrides the
    // configured speakerName color), matching the standalone focus behavior.
    const spkNameCss = isFocus
      ? spkNameBase + `color:${focusAccent};`
      : spkNameBase;
    const spkTitleCss = bodyThemeCss + cssFor("speakerTitle", "11px");
    const spkCompanyCss = bodyThemeCss + cssFor("speakerCompany", "11px");

    // Times
    const start = s.startDateTime ? new Date(s.startDateTime) : null;
    const end = s.endDateTime ? new Date(s.endDateTime) : null;
    const fmt = (d) =>
      d
        ? d.toLocaleString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: tz,
          })
        : "";
    const timeText = start ? `${fmt(start)}–${fmt(end)}` : "";

    // Card shell
    const style = document.createElement("style");
    style.textContent = `
      :host { display:block; height:${cfg.tileStack ? "auto" : "100%"}; font-family: inherit; }
      .tcard {
        display:flex; flex-direction:column; height:${cfg.tileStack ? "auto" : "100%"};
        border:0.5px solid #ccc; border-radius:10px; overflow:hidden;
        background:${tileCardBg};
        box-sizing:border-box;
      }
      .tbar { height:5px; flex-shrink:0; background:${accentColor}; }
      .tbody { padding:8px 10px ${cfg.tileStack ? "12px" : "0"}; display:flex; flex-direction:column; gap:3px; min-height:0; flex:1; overflow:${cfg.tileStack ? "visible" : "hidden"}; }
      .ttitle { ${titleCss} line-height:1.2; }
      .ttime { ${timeCss} }
      .tspeakers { display:flex; flex-direction:column; gap:6px; min-height:0; }
      .tspeakerRow { display:flex; align-items:center; gap:8px; }
      .tavatar { width:30px; height:30px; border-radius:4px; object-fit:cover; flex-shrink:0; background:#ddd; }
      .tspeakerName { ${spkNameCss} line-height:1.15; }
      .tspeakerMeta { ${spkTitleCss} line-height:1.15; }
      .tavatars { display:flex; align-items:center; gap:4px; }
      .tavatars img, .tavatars .tmore { width:28px; height:28px; border-radius:4px; object-fit:cover; background:#ddd; }
      .tavatars .tmore { display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:600; color:#555; background:#e6e6e6; }
      .tdesc { ${descCss} line-height:1.35; }
      .desc-mobile-clamp {
        display:-webkit-box !important;
        -webkit-line-clamp:4;
        -webkit-box-orient:vertical;
        overflow:hidden;
      }
      .mobile-desc-toggle {
        cursor:pointer; font-size:12px; font-weight:600; margin-top:2px; margin-bottom:10px;
        text-decoration:underline; color:${accentColor};
      }
      .tmoreBtn {
        margin-top:auto; align-self:flex-start; cursor:pointer;
        font-size:12px; font-weight:600; color:${accentColor};
        background:none; border:none; padding:4px 0 0 0; text-decoration:underline;
      }
      .sbackdrop {
        position:fixed; inset:0; background:rgba(0,0,0,.45);
        display:none; place-items:center; z-index:999999;
      }
      .sbackdrop[open] { display:grid; }
      .smodal {
        width:min(680px,92vw); max-height:88vh; overflow:auto;
        background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.25);
      }
      .smodalHead {
        display:flex; align-items:flex-start; justify-content:space-between;
        gap:12px; padding:16px 18px; border-bottom:1px solid #eee;
      }
      .smodalTitle { font-size:20px; font-weight:700; line-height:1.25; }
      .smodalTime { font-size:13px; color:#666; margin-top:4px; }
      .smodalClose {
        appearance:none; border:none; background:transparent; font-size:22px;
        cursor:pointer; line-height:1; flex-shrink:0;
      }
      .smodalBody { padding:16px 18px; }
      .smodalDesc { font-size:14px; line-height:1.5; color:#333; margin-bottom:16px; }
      .smodalTags { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
      .smodalTag { font-size:12px; border:0.5px solid #bbb; border-radius:12px; padding:3px 12px; }
      .smodalSpeakersHdr { font-size:15px; font-weight:700; margin:4px 0 10px; }
      .smodalSpeakers { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .smodalSpeaker { display:flex; gap:10px; cursor:pointer; align-items:flex-start; }
      .smodalSpeaker img { width:44px; height:44px; border-radius:4px; object-fit:cover; flex-shrink:0; background:#ddd; }
      .smodalSpeakerName { font-size:13px; font-weight:600; }
      .smodalSpeakerMeta { font-size:12px; color:#666; line-height:1.3; }
      .smodalBack {
        appearance:none; border:none; background:transparent; cursor:pointer;
        font-size:13px; font-weight:600; color:#555; padding:0; text-decoration:underline;
      }
      .modalBody {
        padding:16px; display:grid; grid-template-columns:125px 1fr;
        grid-auto-rows:auto; column-gap:14px; row-gap:2px; background:#fff;
      }
      .modalAvatar { width:125px; height:125px; object-fit:cover; border-radius:4px; grid-column:1; grid-row:1; }
      .modalDetails { grid-column:2; grid-row:1; margin-top:20px; }
      .kv { margin:2px 0; }
      .bio { margin:5px 0 0 0; line-height:1.45; grid-column:1 / -1; grid-row:2; }
      .sessionsHeader { margin-top:10px; grid-column:1 / -1; grid-row:3; }
      .sessionsList { margin:0 0 0 18px; padding:0; grid-column:1 / -1; grid-row:4; }
      .sessionsList li { margin:0; }
    `;
    this.shadowRoot.append(style);

    const card = document.createElement("div");
    card.classList.add("tcard");
    card.style.cursor = "pointer";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.addEventListener("click", () => {
      this._openSessionModal(s, cfg, tz);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this._openSessionModal(s, cfg, tz);
      }
    });
    const bar = document.createElement("div");
    bar.classList.add("tbar");
    const body = document.createElement("div");
    body.classList.add("tbody");
    card.append(bar, body);
    this.shadowRoot.append(card);

    // Always-present: title + time
    const titleEl = document.createElement("div");
    titleEl.classList.add("ttitle");
    titleEl.textContent = s.name || "";
    const timeEl = document.createElement("div");
    timeEl.classList.add("ttime");
    timeEl.textContent = timeText;
    body.append(titleEl); // time added in the fit pass so it can be omitted

    // Speaker area (two render styles: full rows vs avatar cluster)
    const speakers = this.getSpeakersArray(s);
    const speakersFull = document.createElement("div");
    speakersFull.classList.add("tspeakers");
    speakers.forEach((sp) => {
      const wrapEl = sp && sp.speaker ? sp.speaker : sp;
      const row = document.createElement("div");
      row.classList.add("tspeakerRow");
      const img = document.createElement("img");
      img.classList.add("tavatar");
      img.src =
        (wrapEl?.profilePictureUri || "").trim() ||
        "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
      const info = document.createElement("div");
      const nm = document.createElement("div");
      nm.classList.add("tspeakerName");
      nm.textContent = `${wrapEl?.firstName || ""} ${wrapEl?.lastName || ""}`.trim();
      const meta = document.createElement("div");
      meta.classList.add("tspeakerMeta");
      meta.textContent = (wrapEl?.company || wrapEl?.organization || "").trim();
      info.append(nm, meta);
      row.append(img, info);
      speakersFull.append(row);
    });

    const speakersAvatars = document.createElement("div");
    speakersAvatars.classList.add("tavatars");
    const maxAvatars = 5;
    speakers.slice(0, maxAvatars).forEach((sp) => {
      const wrapEl = sp && sp.speaker ? sp.speaker : sp;
      const img = document.createElement("img");
      img.src =
        (wrapEl?.profilePictureUri || "").trim() ||
        "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
      speakersAvatars.append(img);
    });
    if (speakers.length > maxAvatars) {
      const more = document.createElement("div");
      more.classList.add("tmore");
      more.textContent = `+${speakers.length - maxAvatars}`;
      speakersAvatars.append(more);
    }

    // Description (stripped to plain text for the tile)
    const descText = (s.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const descEl = document.createElement("div");
    descEl.classList.add("tdesc");

    // STACK MODE (mobile): content-height card. Show time, full description
    // (no truncation), and full speaker rows. No fixed-height fit needed.
    if (cfg.tileStack) {
      if (timeText) body.append(timeEl);
      if (descText) {
        descEl.textContent = descText;
        body.append(descEl);
        // Mobile 4-line clamp with show more/less (toggle stops propagation).
        this._applyMobileDescClamp(descEl, body);
      }
      if (speakers.length) body.append(speakersFull);
      return;
    }

    // Progressive fit AFTER layout. Priority: title (always) -> time ->
    // description (truncated with ...show more) -> speakers. Each element is
    // only kept if it FULLY fits. Nothing is ever shown half-cut.
    //
    // We measure against the tile's real available height rather than the flex
    // body's scrollHeight (which a flex column with overflow:hidden reports
    // unreliably, letting children be compressed instead of overflowing).
    requestAnimationFrame(() => {
      const BOTTOM_GAP = 10;
      const avail = () => body.clientHeight - BOTTOM_GAP;
      const contentH = () => {
        const kids = [...body.children];
        if (!kids.length) return 0;
        const gap = 3; // matches .tbody gap
        let h = 0;
        kids.forEach((k) => (h += k.offsetHeight));
        h += gap * (kids.length - 1);
        return h;
      };
      const fits = () => contentH() <= avail();

      if (!fits()) return; // even the title overflows

      // 1) Time — add only if it fully fits.
      if (timeText) {
        body.append(timeEl);
        if (!fits()) {
          timeEl.remove();
          return;
        }
      }

      // 2) Description — as many lines as fit, capped at 6, with "… show more".
      //    Reserve room for the avatar cluster below (so avatars still appear on
      //    tall tiles). The description never exceeds 6 lines.
      const MAX_DESC_LINES = 6;
      let descTruncated = false;
      if (descText) {
        // Measure the avatar cluster height so we can reserve space for it.
        let reserve = 0;
        if (speakers.length) {
          body.append(speakersAvatars);
          reserve = speakersAvatars.offsetHeight + 3; // + gap
          speakersAvatars.remove();
        }

        body.append(descEl);
        descEl.textContent = descText;

        const lineH = parseFloat(getComputedStyle(descEl).lineHeight) || 16;
        const maxByLines = Math.round(lineH * MAX_DESC_LINES) + 1;

        // Description is acceptable if it's within the 6-line cap AND leaves
        // room for the reserved avatar space below.
        const descOk = () =>
          descEl.offsetHeight <= maxByLines &&
          contentH() + reserve <= avail();

        if (!descOk()) {
          const words = descText.split(" ");
          let lo = 1,
            hi = words.length,
            best = 0;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            descEl.textContent = words.slice(0, mid).join(" ") + "… show more";
            if (descOk()) {
              best = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }
          if (best > 0) {
            descEl.textContent = words.slice(0, best).join(" ") + "… show more";
            descTruncated = true;
          } else {
            descEl.remove();
          }
        }
      }

      // 3) Speakers — avatar cluster at the bottom if it fully fits.
      if (speakers.length) {
        body.append(speakersAvatars);
        if (!fits()) {
          speakersAvatars.remove();
        }
      }
    });
  }

  // Shared modal: shows session detail, or a speaker's detail with a
  // "Back to session details" button. Same window, swapped content.
  _openSessionModal(s, cfg, tz) {
    if (!this._sessionModal) {
      const backdrop = document.createElement("div");
      backdrop.classList.add("sbackdrop");
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) backdrop.removeAttribute("open");
      });
      const modal = document.createElement("div");
      modal.classList.add("smodal");
      backdrop.appendChild(modal);
      this.shadowRoot.appendChild(backdrop);
      this._sessionModal = { backdrop, modal };
      this.shadowRoot.addEventListener("keydown", (e) => {
        if (e.key === "Escape") backdrop.removeAttribute("open");
      });
    }
    this._sessionCtx = { s, cfg, tz };
    this._renderSessionView();
    this._sessionModal.backdrop.setAttribute("open", "");
  }

  _renderSessionView() {
    const { s, cfg, tz } = this._sessionCtx;
    const { modal } = this._sessionModal;
    modal.innerHTML = "";

    const head = document.createElement("div");
    head.classList.add("smodalHead");
    const headLeft = document.createElement("div");
    const title = document.createElement("div");
    title.classList.add("smodalTitle");
    title.textContent = s.name || "";
    const time = document.createElement("div");
    time.classList.add("smodalTime");
    const start = s.startDateTime ? new Date(s.startDateTime) : null;
    const end = s.endDateTime ? new Date(s.endDateTime) : null;
    const fmtFull = (d) =>
      d
        ? d.toLocaleString("en-US", {
            weekday: "short", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit", timeZone: tz,
          })
        : "";
    const fmtT = (d) =>
      d
        ? d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
        : "";
    time.textContent = start ? `${fmtFull(start)} – ${fmtT(end)}` : "";
    headLeft.append(title, time);
    const close = document.createElement("button");
    close.classList.add("smodalClose");
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", () =>
      this._sessionModal.backdrop.removeAttribute("open")
    );
    head.append(headLeft, close);

    const bodyEl = document.createElement("div");
    bodyEl.classList.add("smodalBody");

    const descHtml = (s.description || "").trim();
    if (descHtml) {
      const desc = document.createElement("div");
      desc.classList.add("smodalDesc");
      desc.innerHTML = descHtml;
      bodyEl.append(desc);
    }

    const tags = [];
    if (s.location?.name?.trim()) tags.push(s.location.name.trim());
    if (s.category?.name?.trim()) tags.push(s.category.name.trim());
    if (tags.length) {
      const tagWrap = document.createElement("div");
      tagWrap.classList.add("smodalTags");
      tags.forEach((tx) => {
        const tag = document.createElement("span");
        tag.classList.add("smodalTag");
        tag.textContent = tx;
        tagWrap.append(tag);
      });
      bodyEl.append(tagWrap);
    }

    const speakers = this.getSpeakersArray(s);
    if (speakers.length) {
      const hdr = document.createElement("div");
      hdr.classList.add("smodalSpeakersHdr");
      hdr.textContent = speakers.length === 1 ? "Speaker" : "Speakers";
      bodyEl.append(hdr);

      const grid = document.createElement("div");
      grid.classList.add("smodalSpeakers");
      speakers.forEach((spRaw) => {
        const sp = spRaw && spRaw.speaker ? spRaw.speaker : spRaw;
        const row = document.createElement("div");
        row.classList.add("smodalSpeaker");
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        const img = document.createElement("img");
        img.src =
          (sp?.profilePictureUri || "").trim() ||
          "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
        const info = document.createElement("div");
        const nm = document.createElement("div");
        nm.classList.add("smodalSpeakerName");
        nm.textContent = `${sp?.firstName || ""} ${sp?.lastName || ""}`.trim();
        const meta = document.createElement("div");
        meta.classList.add("smodalSpeakerMeta");
        const jt = (sp?.title || sp?.designation || sp?.jobTitle || "").trim();
        const co = (sp?.company || sp?.organization || "").trim();
        meta.textContent = [jt, co].filter(Boolean).join(" · ");
        info.append(nm, meta);
        row.append(img, info);
        const go = () => this._renderSpeakerView(sp);
        row.addEventListener("click", go);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
        });
        grid.append(row);
      });
      bodyEl.append(grid);
    }

    modal.append(head, bodyEl);
    close.focus();
  }

  _renderSpeakerView(sp) {
    const { modal } = this._sessionModal;
    modal.innerHTML = "";

    // Header: back button + close
    const head = document.createElement("div");
    head.classList.add("smodalHead");
    const back = document.createElement("button");
    back.classList.add("smodalBack");
    back.textContent = "← Back to session details";
    back.addEventListener("click", () => this._renderSessionView());
    const close = document.createElement("button");
    close.classList.add("smodalClose");
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", () =>
      this._sessionModal.backdrop.removeAttribute("open")
    );
    head.append(back, close);

    // Body: identical markup/classes to the standalone speaker modal, populated
    // by the SAME shared filler so both views look the same.
    const refs = this._buildSpeakerBody();
    this._fillSpeakerRefs(refs, sp);

    modal.append(head, refs.body);
    back.focus();
  }

  // Apply a mobile-only 4-line description clamp with an inline show more/less
  // toggle. textEl is the description element; appendTarget is where the toggle
  // goes. Only clamps at <=600px; above that the description shows in full.
  // The toggle stops propagation so it doesn't also open the card modal.
  _applyMobileDescClamp(textEl, appendTarget) {
    const isMobile = () =>
      (window.innerWidth || document.documentElement.clientWidth || 1920) <= 600;

    const toggle = document.createElement("div");
    toggle.classList.add("mobile-desc-toggle");
    toggle.textContent = "…show more";
    toggle.style.display = "none";

    let expanded = false;
    const sync = () => {
      if (!isMobile()) {
        // Desktop: no clamp, no toggle.
        textEl.classList.remove("desc-mobile-clamp");
        toggle.style.display = "none";
        return;
      }
      // Mobile: clamp unless expanded; show toggle only if the text overflows
      // 4 lines (i.e., clamping actually hides something).
      if (expanded) {
        textEl.classList.remove("desc-mobile-clamp");
        toggle.textContent = "show less";
        toggle.style.display = "";
        return;
      }
      textEl.classList.add("desc-mobile-clamp");
      // Detect overflow: scrollHeight > clientHeight when clamped.
      const overflowing = textEl.scrollHeight > textEl.clientHeight + 1;
      console.log("MOBILE CLAMP |", "isMobile:", isMobile(), "| scrollH:", textEl.scrollHeight, "| clientH:", textEl.clientHeight, "| overflowing:", overflowing);
      toggle.textContent = "…show more";
      toggle.style.display = overflowing ? "" : "none";
    };

    toggle.addEventListener("click", (e) => {
      e.stopPropagation(); // don't open the card modal
      expanded = !expanded;
      sync();
    });

    appendTarget.append(toggle);
    requestAnimationFrame(sync);

    // Re-evaluate on resize (rotate, window resize).
    const onR = () => sync();
    window.addEventListener("resize", onR);
    this._mobileClampHandlers = this._mobileClampHandlers || [];
    this._mobileClampHandlers.push(onR);
  }

  _breakIconSvg(type, size, color) {
    // Paths drawn within the 24x24 box with padding so they don't clip.
    const paths = {
      Coffee:
        "M4 11h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 12h1.5a2.5 2.5 0 0 1 0 5H17M7 5V3M10 5V3M13 5V3",
      Lunch:
        "M5 3v8M8 3v8M5 11h3M6.5 11v10M15 3c-1.5 1-2.5 3-2.5 5.5S13.5 13 15 13v8",
      Networking:
        "M9 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M4 21v-1a5 5 0 0 1 5-5 5 5 0 0 1 5 5v1M16 3.5a2.5 2.5 0 0 1 0 5M17 15.2a5 5 0 0 1 3 4.8v1",
      General:
        "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16M12 8v4l3 2",
    };
    const d = paths[type];
    if (!d) return null;
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    // INLINE styles beat Cvent's global svg/path CSS so icons can't be distorted.
    svg.style.width = `${size}px`;
    svg.style.height = `${size}px`;
    svg.style.minWidth = `${size}px`;
    svg.style.flexShrink = "0";
    svg.style.display = "block";
    svg.style.fill = "none";
    svg.style.stroke = color;
    svg.style.strokeWidth = "2px";
    svg.style.strokeLinecap = "round";
    svg.style.strokeLinejoin = "round";
    const path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", d);
    path.style.fill = "none";
    path.style.stroke = color;
    path.style.strokeWidth = "2px";
    path.style.strokeLinecap = "round";
    path.style.strokeLinejoin = "round";
    svg.appendChild(path);
    return svg;
  }

  disconnectedCallback() {
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    if (this._mobileClampHandlers) {
      this._mobileClampHandlers.forEach((h) =>
        window.removeEventListener("resize", h)
      );
      this._mobileClampHandlers = [];
    }
    this._typoBindings = [];
  }

  renderSpeakerLine(spRaw) {
    const t = this.theme || {};
    const cfg = this.config || {};

    // 0) unwrap if you were passed { speaker, role }
    const sp = spRaw && spRaw.speaker ? spRaw.speaker : spRaw;

    const sid = sp?.id || sp?.speakerId || "";
    const firstName = (sp?.firstName || "").trim();
    const lastName = (sp?.lastName || "").trim();

    // 1) local values (may be empty pre-hydration)
    let jobTitle = (
      sp?.title ||
      sp?.designation || // Cvent commonly uses this for job title
      sp?.jobTitle ||
      sp?.position ||
      sp?.role ||
      ""
    )
      .toString()
      .trim();

    let company = (
      sp?.company ||
      sp?.organization ||
      sp?.companyName ||
      sp?.org ||
      ""
    )
      .toString()
      .trim();

    const pic = (sp?.profilePictureUri || "").trim();

    const line = document.createElement("div");
    line.classList.add("speakerLine");
    line.setAttribute("role", "button");
    line.setAttribute("tabindex", "0");
    if (sid) line.dataset.speakerId = sid;
    line.addEventListener("click", () => this.openModalForSpeaker(sp));
    line.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.openModalForSpeaker(sp);
      }
    });

    const img = document.createElement("img");
    img.src =
      pic ||
      "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
    img.alt = `${firstName} ${lastName}`.trim() || "Speaker";
    img.classList.add("avatar");

    const info = document.createElement("div");
    info.classList.add("info");

    const nameSpan = document.createElement("span");
    nameSpan.classList.add("speakerName");
    nameSpan.textContent = `${firstName} ${lastName}`.trim();
    this.applyThemeStyle(nameSpan, t.paragraph);
    // On focus cards, speaker names use the focus accent. Apply untracked so a
    // resize typography re-apply can't stomp it, then set the color after.
    const nameIsFocus =
      cfg.showAccentBar === true && cfg.isFocus === true;
    this.applyTypographyOverrides(
      nameSpan,
      cfg.typography?.speakerName,
      !nameIsFocus
    );
    if (nameIsFocus) {
      nameSpan.style.color = cfg.focusAccent || "#1a7f8e";
    }

    const meta = document.createElement("div");
    meta.classList.add("speakerMeta");

    const titleSpan = document.createElement("div");
    titleSpan.classList.add("speakerTitle");
    titleSpan.textContent = jobTitle;
    this.applyThemeStyle(titleSpan, t.paragraph);
    this.applyTypographyOverrides(
      titleSpan,
      cfg.typography?.speakerTitle,
      true
    );

    const companySpan = document.createElement("div");
    companySpan.classList.add("speakerCompany");
    companySpan.textContent = company;
    this.applyThemeStyle(companySpan, t.paragraph);
    this.applyTypographyOverrides(
      companySpan,
      cfg.typography?.speakerCompany,
      true
    );

    // TEMP: make sure styles can't hide them while testing
    titleSpan.style.fontSize = titleSpan.style.fontSize || "16px";
    titleSpan.style.color = titleSpan.style.color || "inherit";
    companySpan.style.fontSize = companySpan.style.fontSize || "16px";
    companySpan.style.color = companySpan.style.color || "inherit";

    meta.append(titleSpan, companySpan);
    info.append(nameSpan, meta);
    line.append(img, info);

    // 2) Lazy hydration- if missing, fetch from SDK and patch DOM
    const getSpeakersFn =
      this.config?.getSpeakers ||
      (typeof window !== "undefined" ? window.getSpeakers : undefined);
    if ((!jobTitle || !company) && typeof getSpeakersFn === "function" && sid) {
      // log once per line so you can see it fire
      console.debug("Hydrating speaker", {
        sid,
        hadTitle: !!jobTitle,
        hadCompany: !!company,
      });

      getSpeakersFn([sid])
        .then((map) => {
          const key = String(sid);
          const full = map?.[key];
          if (!full || full.failureReason) {
            console.warn(
              "getSpeakers returned failure for",
              key,
              full?.failureReason
            );
            return;
          }

          const hydratedTitle = (
            full.title ||
            full.designation || // per docs
            ""
          )
            .toString()
            .trim();

          const hydratedCompany = (
            full.company ||
            full.organization ||
            full.companyName ||
            ""
          )
            .toString()
            .trim();

          // Patch the DOM if we gained data
          if (hydratedTitle && !jobTitle) {
            jobTitle = hydratedTitle;
            titleSpan.textContent = hydratedTitle;
          }
          if (hydratedCompany && !company) {
            company = hydratedCompany;
            companySpan.textContent = hydratedCompany;
          }
          // comma.textContent = jobTitle && company ? ", " : "";

          console.debug("Hydrated speaker result", {
            sid: key,
            title: hydratedTitle,
            company: hydratedCompany,
          });
        })
        .catch((err) => {
          console.warn("getSpeakers error", err);
        });
    } else {
      // Diagnostics when hydration didn't run:
      if (!getSpeakersFn)
        console.warn("getSpeakers not available on config/window");
      if (!sid) console.warn("Speaker has no id/speakerId; cannot hydrate", sp);
    }

    return line;
  }

  buildModal() {
    const backdrop = document.createElement("div");
    backdrop.classList.add("backdrop");
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this.closeModal();
    });

    const modal = document.createElement("div");
    modal.classList.add("modal");
    backdrop.appendChild(modal);

    const header = document.createElement("div");
    header.classList.add("modalHeader");

    const title = document.createElement("div");
    title.classList.add("modalTitle");
    header.appendChild(title);

    const close = document.createElement("button");
    close.classList.add("closeBtn");
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", () => this.closeModal());
    header.appendChild(close);

    const body = document.createElement("div");
    body.classList.add("modalBody");

    // left: avatar
    const avatar = document.createElement("img");
    avatar.classList.add("modalAvatar");
    avatar.alt = "Speaker photo";

    // right: name/title/company
    const details = document.createElement("div");
    details.classList.add("modalDetails"); // ← add a class for targeting

    const nameEl = document.createElement("div");
    const titleEl = document.createElement("div");
    titleEl.classList.add("kv");
    const companyEl = document.createElement("div");
    companyEl.classList.add("kv");

    const bioEl = document.createElement("div");
    bioEl.classList.add("bio");

    const sessionsHdr = document.createElement("div");
    sessionsHdr.classList.add("sessionsHeader");
    sessionsHdr.textContent = "Sessions";

    const sessionsUl = document.createElement("ul");
    sessionsUl.classList.add("sessionsList");

    // Only keep name/title/company in the right column
    details.append(nameEl, titleEl, companyEl);

    // Bio + sessions become *separate* grid items
    body.append(avatar, details, bioEl, sessionsHdr, sessionsUl);

    modal.append(header, body);

    return {
      backdrop,
      header,
      title,
      avatar,
      nameEl,
      titleEl,
      companyEl,
      bioEl,
      sessionsHdr,
      sessionsUl,
    };
  }

  applyModalTypography(cfg) {
    this.applyTypographyOverrides(
      this.modal.title,
      cfg.typography?.modalName,
      true
    );
    this.applyTypographyOverrides(
      this.modal.nameEl,
      cfg.typography?.modalSpeakerName,
      true
    );
    this.applyTypographyOverrides(
      this.modal.titleEl,
      cfg.typography?.modalSpeakerTitle,
      true
    );
    this.applyTypographyOverrides(
      this.modal.companyEl,
      cfg.typography?.modalSpeakerCompany,
      true
    );
    this.applyTypographyOverrides(
      this.modal.bioEl,
      cfg.typography?.modalSpeakerBio,
      true
    );
    this.applyTypographyOverrides(
      this.modal.sessionsHdr,
      cfg.typography?.modalSessionsHeader,
      true
    );
  }

  // Build the reusable speaker-detail body (avatar, name/title/company, bio,
  // sessions list) using the same classes as the standalone modal. Returns the
  // container plus element refs. Used by BOTH the standalone speaker modal and
  // the session-modal speaker view, so they render identically.
  _buildSpeakerBody() {
    const body = document.createElement("div");
    body.classList.add("modalBody");

    const avatar = document.createElement("img");
    avatar.classList.add("modalAvatar");
    avatar.alt = "Speaker photo";

    const details = document.createElement("div");
    details.classList.add("modalDetails");
    const nameEl = document.createElement("div");
    const titleEl = document.createElement("div");
    titleEl.classList.add("kv");
    const companyEl = document.createElement("div");
    companyEl.classList.add("kv");
    details.append(nameEl, titleEl, companyEl);

    const bioEl = document.createElement("div");
    bioEl.classList.add("bio");

    const sessionsHdr = document.createElement("div");
    sessionsHdr.classList.add("sessionsHeader");
    sessionsHdr.textContent = "Sessions";

    const sessionsUl = document.createElement("ul");
    sessionsUl.classList.add("sessionsList");

    body.append(avatar, details, bioEl, sessionsHdr, sessionsUl);

    return { body, avatar, nameEl, titleEl, companyEl, bioEl, sessionsHdr, sessionsUl };
  }

  // Populate a set of speaker refs (from _buildSpeakerBody or this.modal) with a
  // speaker's data: name/title/company/bio, "appears in" sessions, typography,
  // focus recolor, and lazy hydration. Shared by both speaker-view flows.
  _fillSpeakerRefs(refs, spRaw) {
    const cfg = this.config || {};
    const allSessions = Array.isArray(cfg.allSessions)
      ? cfg.allSessions
      : [this.session];
    const sp = spRaw && spRaw.speaker ? spRaw.speaker : spRaw;

    const fullName = `${(sp?.firstName || "").trim()} ${(
      sp?.lastName || ""
    ).trim()}`.trim();
    let jobTitle = (
      sp?.title || sp?.designation || sp?.jobTitle || sp?.position || sp?.role || ""
    ).toString().trim();
    let company = (
      sp?.company || sp?.organization || sp?.companyName || sp?.org || ""
    ).toString().trim();
    let bio = (sp?.biography ?? sp?.bio ?? sp?.about ?? "").toString();

    if (refs.title) refs.title.textContent = fullName || "Speaker";
    refs.avatar.src =
      (sp?.profilePictureUri || "").trim() ||
      "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
    refs.nameEl.textContent = fullName || "";
    refs.titleEl.textContent = jobTitle || "";
    refs.companyEl.textContent = company || "";
    refs.bioEl.innerHTML = bio || "";

    // Typography (mirror applyModalTypography on these refs)
    this.applyTypographyOverrides(refs.nameEl, cfg.typography?.modalSpeakerName, true);
    this.applyTypographyOverrides(refs.titleEl, cfg.typography?.modalSpeakerTitle, true);
    this.applyTypographyOverrides(refs.companyEl, cfg.typography?.modalSpeakerCompany, true);
    this.applyTypographyOverrides(refs.bioEl, cfg.typography?.modalSpeakerBio, true);
    this.applyTypographyOverrides(refs.sessionsHdr, cfg.typography?.modalSessionsHeader, true);

    // Focus recolor of the speaker name
    if (cfg.isFocus === true && cfg.showAccentBar === true) {
      refs.nameEl.style.color = cfg.focusAccent || "#1a7f8e";
    }

    refs.titleEl.style.display = jobTitle ? "" : "none";
    refs.companyEl.style.display = company ? "" : "none";
    refs.bioEl.style.display = bio ? "" : "none";

    // "Appears in" sessions
    const speakerId = sp?.id || sp?.speakerId;
    const appearsIn = allSessions.filter((sess) => {
      const list = Array.isArray(sess.resolvedSpeakers)
        ? sess.resolvedSpeakers
        : Array.isArray(sess.speakers)
        ? sess.speakers.map((x) => (x && x.speaker ? x.speaker : x)).filter(Boolean)
        : [];
      return list.some((x) => (x?.id || x?.speakerId) === speakerId);
    });
    refs.sessionsHdr.textContent = appearsIn.length === 1 ? "Session" : "Sessions";

    refs.sessionsUl.innerHTML = "";
    const tz = cfg.eventTimezone || "America/New_York";
    if (appearsIn.length) {
      appearsIn.forEach((sess) => {
        const li = document.createElement("li");
        const nameSpan = document.createElement("span");
        nameSpan.textContent = sess.name || "(Untitled)";
        this.applyTypographyOverrides(nameSpan, cfg.typography?.modalSessionName, true);

        const dtSpan = document.createElement("span");
        const st = sess.startDateTime ? new Date(sess.startDateTime) : null;
        const et = sess.endDateTime ? new Date(sess.endDateTime) : null;
        const stTxt = st
          ? st.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: tz })
          : "";
        const etTxt = et
          ? et.toLocaleString("en-US", { timeStyle: "short", timeZone: tz })
          : "";
        const overrideAbbr =
          typeof cfg.timezoneAbbr === "string" ? cfg.timezoneAbbr.trim() : "";
        const autoAbbr = st
          ? st.toLocaleString("en-US", { timeZoneName: "short", timeZone: tz }).split(" ").pop()
          : "";
        const showTz = cfg.showTimezone !== false;
        const tzAbbr = showTz ? overrideAbbr || autoAbbr : "";
        dtSpan.textContent = stTxt
          ? etTxt
            ? ` — ${stTxt} – ${etTxt}${tzAbbr ? " " + tzAbbr : ""}`
            : ` — ${stTxt}${tzAbbr ? " " + tzAbbr : ""}`
          : "";
        this.applyTypographyOverrides(dtSpan, cfg.typography?.modalSessionDateTime, true);

        li.append(nameSpan, dtSpan);
        refs.sessionsUl.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "No other sessions found.";
      refs.sessionsUl.appendChild(li);
    }

    // Lazy hydration of missing title/company/bio
    if ((!jobTitle || !company || !bio) && speakerId) {
      const getSpeakersFn =
        cfg.getSpeakers ||
        (typeof window !== "undefined" ? window.getSpeakers : undefined);
      if (typeof getSpeakersFn === "function") {
        getSpeakersFn([speakerId])
          .then((map) => {
            const full = map?.[String(speakerId)];
            if (!full || full.failureReason) return;
            const hTitle = (full.title || full.designation || "").toString().trim();
            const hCompany = (full.company || full.organization || full.companyName || "").toString().trim();
            const hBio = (full.biography ?? full.bio ?? full.about ?? "").toString();
            if (hTitle && !jobTitle) {
              refs.titleEl.textContent = hTitle;
              refs.titleEl.style.display = "";
            }
            if (hCompany && !company) {
              refs.companyEl.textContent = hCompany;
              refs.companyEl.style.display = "";
            }
            if (hBio && !bio) {
              refs.bioEl.innerHTML = hBio;
              refs.bioEl.style.display = "";
            }
          })
          .catch(() => {});
      }
    }
  }

  openModalForSpeaker(spRaw) {
    if (!this.modal) {
      this.modal = this.buildModal();
      this.shadowRoot.append(this.modal.backdrop);
    }
    // Populate the standalone modal's refs via the shared filler.
    this._fillSpeakerRefs(
      {
        title: this.modal.title,
        avatar: this.modal.avatar,
        nameEl: this.modal.nameEl,
        titleEl: this.modal.titleEl,
        companyEl: this.modal.companyEl,
        bioEl: this.modal.bioEl,
        sessionsHdr: this.modal.sessionsHdr,
        sessionsUl: this.modal.sessionsUl,
      },
      spRaw
    );

    // Focus recolor of the modal header (name recolor handled in filler).
    const cfg = this.config || {};
    if (cfg.isFocus === true && cfg.showAccentBar === true) {
      this.modal.header.style.background = cfg.focusAccent || "#1a7f8e";
    }

    this.modal.backdrop.setAttribute("open", "");
    this.modal.backdrop.querySelector(".closeBtn")?.focus();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cvent-speaker-modal-open"));
    }
  }

  closeModal() {
    this.modal?.backdrop?.removeAttribute("open");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cvent-speaker-modal-close"));
    }
  }

  reapplyTypography() {
    for (const [el, override] of this._typoBindings) {
      this._applyTypographyNow(el, override);
    }
  }

  // === helpers ===
  getSpeakersArray(session) {
    // Normalize to a flat speaker array, preserving Cvent's raw array order
    let speakers = [];
    if (
      Array.isArray(session?.resolvedSpeakers) &&
      session.resolvedSpeakers.length
    ) {
      speakers = session.resolvedSpeakers;
    } else if (Array.isArray(session?.speakers) && session.speakers.length) {
      speakers = session.speakers
        .map((x) => (x && x.speaker ? x.speaker : x))
        .filter(Boolean);
    }

    // "sessionOrder" preserves Cvent's drag-and-drop order (raw array order).
    // Default "alphabetical" keeps existing behavior so published events are
    // unaffected unless a planner opts in.
    const mode = this.config?.speakerOrder || "alphabetical";
    console.log("SPEAKER MODE |", session?.name, "| mode:", mode, "| order:", speakers.map(s => s.firstName).join(", "));
    if (mode === "sessionOrder") {
      return speakers;
    }

    return [...speakers].sort((a, b) => {
      const aFirst = (a?.firstName || "").trim().toLowerCase();
      const bFirst = (b?.firstName || "").trim().toLowerCase();
      if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
      const aLast = (a?.lastName || "").trim().toLowerCase();
      const bLast = (b?.lastName || "").trim().toLowerCase();
      return aLast.localeCompare(bLast);
    });
  }
  applyThemeStyle(el, themeStyleObj = {}, extra = {}) {
    const { customClasses, ...styles } = themeStyleObj || {};
    Object.assign(el.style, styles, extra);
    if (Array.isArray(customClasses) && customClasses.length)
      el.classList.add(...customClasses);
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
    element.style.fontSize =
      fs !== undefined && fs !== null && fs !== "" ? `${fs}px` : "";
    if (color !== undefined) element.style.color = color || "";
    if (bold !== undefined) element.style.fontWeight = bold ? "700" : "";
    if (italic !== undefined) element.style.fontStyle = italic ? "italic" : "";
    if (underline !== undefined) {
      element.style.textDecoration = underline ? "underline" : "none";
    }
  }

  applyTypographyOverrides(element, override, track = false) {
    this._applyTypographyNow(element, override);
    if (track) this._typoBindings.push([element, override || {}]);
  }
}
