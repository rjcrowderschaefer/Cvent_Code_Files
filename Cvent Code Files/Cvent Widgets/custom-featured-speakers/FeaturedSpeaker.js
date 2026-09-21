// FeaturedSpeaker.js
// Reusable custom element used by widget.js (registered as <dev-featured-speaker-card>)
// Renders a single speaker tile (square photo, name, role, company tag) and a
// click-to-open bio modal. Visual language mirrors the NYCW "Meet our speakers"
// section: fixed square tiles, hover "Click to view bio" overlay, accent name on
// hover, modal with brand top bar, eyebrow, rule, scrollable bio.

const FALLBACK_TOKENS = {
  ink: "#141416",
  muted: "#5C5C5A",
  faint: "#6F6F6D",
  hair: "#E4E4E0",
  placeholder: "#EDEDEA",
  accent: "#9C5F00",
  tagBg: "#F0F0EE",
  tagInk: "#3F3F3D",
  modalBar: "#F7A325",
  bioInk: "#3F3F3D",
  focus: "#2B6CE8",
};

export class FeaturedSpeaker extends HTMLElement {
  constructor() {
    super();
    // Properties assigned by widget.js before append()
    this.speaker = {};
    this.theme = {};
    this.config = {};

    this._typoBindings = [];
    this._onResize = null;
    this._onKeydown = null;
    this._lastFocus = null;

    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    const sp = this.speaker || {};
    const cfg = this.config || {};
    const c = { ...FALLBACK_TOKENS, ...(cfg.colors || {}) };
    const tile = Math.max(120, Math.min(400, Number(cfg.tileSize) || 200));
    const hoverPrompt = cfg.hoverPrompt !== undefined ? cfg.hoverPrompt : "Click to view bio";
    const lines = (v, d) => Math.max(0, Math.min(6, Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d));
    const nameLines = lines(cfg.nameLines, 2);
    const titleLines = lines(cfg.titleLines, 3);
    const tagLines = lines(cfg.tagLines, 1);
    const fixedSlot = cfg.fixedTextSlot !== false;
    const clamp = (n) => n > 0 ? `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${n};overflow:hidden;` : "";
    const slot = (n, lh) => (fixedSlot && n > 0) ? `min-height:calc(${n} * ${lh});` : "";
    const fontFamily = cfg.fontFamily || `"BBGAvenir","Helvetica Neue",Helvetica,Arial,-apple-system,BlinkMacSystemFont,sans-serif`;

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        max-width: ${tile}px;
        font-family: ${fontFamily};
        color: ${c.ink};
        line-height: 1.45;
        text-align: left;
      }
      *, *::before, *::after { box-sizing: border-box; }
      p { margin: 0; padding: 0; }
      :focus-visible { outline: 3px solid ${c.focus}; outline-offset: 3px; }

      /* ---------- CARD (button) ---------- */
      .card {
        display: flex; flex-direction: column; height: 100%; width: 100%;
        background: none; border: 0; padding: 0; margin: 0; text-align: left;
        cursor: pointer; font: inherit; color: inherit;
      }
      .photo {
        width: 100%; aspect-ratio: 1 / 1;
        background: ${c.placeholder}; position: relative; overflow: hidden;
        margin-bottom: 14px;
      }
      .photo img {
        display: block; width: 100%; height: 100%; object-fit: cover; object-position: center;
      }
      .photo .initials {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; letter-spacing: .14em; color: ${c.faint};
      }
      .photo .overlay {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        text-align: center; padding: 10px;
        background: rgba(11,11,12,.7); color: #fff;
        font-size: 12px; font-weight: 700; letter-spacing: .04em;
        opacity: 0; transition: opacity .18s ease; pointer-events: none;
      }
      .card:hover .overlay, .card:focus-visible .overlay { opacity: 1; }
      .name {
        font-size: 15.5px; font-weight: 700; letter-spacing: -.01em; line-height: 1.25;
        color: ${c.ink}; margin-bottom: 3px; transition: color .15s ease;
        ${clamp(nameLines)} ${slot(nameLines, "1.25em")}
      }
      .card:hover .name { color: ${c.accent} !important; }
      .role { font-size: 13px; color: ${c.muted}; margin-bottom: 10px; line-height: 1.45; ${clamp(titleLines)} ${slot(titleLines, "1.45em")} }
      .name, .role, .tag { overflow-wrap: break-word; min-width: 0; }
      .tag {
        display: inline-block; margin-top: auto; align-self: flex-start; max-width: 100%;
        font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
        line-height: 1.4; padding: 4px 8px; border-radius: 2px;
        background: ${c.tagBg}; color: ${c.tagInk};
        ${tagLines === 1 ? "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" : clamp(tagLines)}
      }

      /* ---------- MODAL ---------- */
      .scrim {
        position: fixed; inset: 0; background: rgba(11,11,12,.72);
        z-index: 2147483000; display: none; align-items: center; justify-content: center;
        padding: 24px; font-family: ${fontFamily};
      }
      .scrim[open] { display: flex; }
      .modal {
        background: #fff; max-width: 640px; width: 100%; max-height: 90vh;
        border-radius: 4px; position: relative; border-top: 3px solid ${c.modalBar};
        display: flex; flex-direction: column; overflow: hidden; text-align: left;
        color: ${c.ink};
      }
      .mHead {
        display: grid; grid-template-columns: 180px 1fr; gap: 26px; align-items: start;
        padding: 30px 34px 0; flex: none;
      }
      .mPhoto { width: 180px; aspect-ratio: 1 / 1; background: ${c.placeholder}; overflow: hidden; position: relative; }
      .mPhoto img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }
      .mPhoto .initials {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; letter-spacing: .14em; color: ${c.faint};
      }
      .mEyebrow {
        font-size: 11px; line-height: 1.4; font-weight: 700; letter-spacing: .14em;
        text-transform: uppercase; color: ${c.accent}; margin: 0 0 12px;
      }
      .mName {
        font-size: 29px; font-weight: 700; letter-spacing: -.02em; line-height: 1.12;
        margin: 0 0 6px; color: ${c.ink};
      }
      .mRole { font-size: 15px; color: ${c.muted}; margin: 0 0 14px; }
      .mTag {
        display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: .08em;
        text-transform: uppercase; padding: 4px 8px; border-radius: 2px;
        background: ${c.tagBg}; color: ${c.tagInk};
      }
      .mRule { height: 1px; background: ${c.hair}; margin: 26px 34px 0; flex: none; }
      .mBody { padding: 22px 34px 34px; overflow: auto; flex: 1 1 auto; }
      .mBio p { font-size: 14.5px; line-height: 1.65; color: ${c.bioInk}; margin: 0 0 13px; }
      .mBio p:last-child { margin-bottom: 0; }
      .mBio > *:first-child { margin-top: 0 !important; }
      .mBio > *:last-child { margin-bottom: 0 !important; }
      .mSessions { margin-top: 22px; padding-top: 20px; border-top: 1px solid ${c.hair}; }
      .mSessionsHdr {
        font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
        color: ${c.muted}; margin: 0 0 10px;
      }
      .mSessionsList { list-style: none; margin: 0; padding: 0; }
      .mSessionsList li { padding: 8px 0; border-top: 1px solid ${c.hair}; }
      .mSessionsList li:first-child { border-top: 0; padding-top: 0; }
      .sName { display: block; font-size: 14.5px; font-weight: 700; color: ${c.ink}; line-height: 1.35; }
      .sWhen { display: block; font-size: 13px; color: ${c.muted}; margin-top: 2px; }
      .mClose {
        position: absolute; top: 12px; right: 12px; width: 36px; height: 36px;
        border: 0; border-radius: 50%; background: rgba(255,255,255,.92); color: ${c.ink};
        font-size: 22px; line-height: 1; cursor: pointer; font-family: inherit;
        display: flex; align-items: center; justify-content: center;
      }
      .mClose:hover { background: #fff; }
      .mClose:focus-visible { outline: 3px solid ${c.focus}; outline-offset: 2px; }

      @media (max-width: 560px) {
        .mHead { grid-template-columns: 1fr; gap: 18px; padding: 26px 22px 0; }
        .mPhoto { width: 160px; }
        .mRule { margin: 22px 22px 0; }
        .mBody { padding: 18px 22px 26px; }
        .mName { font-size: 24px; }
      }
    `;
    this.shadowRoot.append(style);

    // ---------- Card ----------
    const fullName = this._fullName(sp);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-label", `View bio for ${fullName || "speaker"}`);
    card.addEventListener("click", () => this.openModal());

    const photo = document.createElement("div");
    photo.className = "photo";
    const src = (sp?.profilePictureUri || "").trim();
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = fullName || "Speaker";
      img.loading = "lazy";
      photo.append(img);
    } else {
      const ini = document.createElement("span");
      ini.className = "initials";
      ini.textContent = this._initials(sp) || "TBA";
      photo.append(ini);
    }
    if (hoverPrompt) {
      const overlay = document.createElement("span");
      overlay.className = "overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.textContent = hoverPrompt;
      photo.append(overlay);
    }

    const nameEl = document.createElement("p");
    nameEl.className = "name";
    nameEl.textContent = fullName;
    nameEl.title = fullName;
    this._applyTypographyOverrides(nameEl, cfg.typography?.speakerName, true);

    const roleEl = document.createElement("p");
    roleEl.className = "role";
    roleEl.textContent = this._jobTitle(sp);
    roleEl.title = roleEl.textContent;
    this._applyTypographyOverrides(roleEl, cfg.typography?.speakerRole, true);
    roleEl.style.display = roleEl.textContent ? "" : "none";

    const tagEl = document.createElement("span");
    tagEl.className = "tag";
    tagEl.textContent = this._tagLabel(sp);
    tagEl.title = this._company(sp);
    this._applyTypographyOverrides(tagEl, cfg.typography?.speakerTag, true);
    tagEl.style.display = tagEl.textContent ? "" : "none";

    card.append(photo, nameEl, roleEl, tagEl);
    this.shadowRoot.append(card);

    // Lazy hydration — fill role/company if missing from SDK
    this._hydrateIfNeeded(sp, roleEl, tagEl);

    // Modal (built once, reused)
    this._modal = this._buildModal(cfg);
    this.shadowRoot.append(this._modal.scrim);

    this._onResize = () => this._reapplyTypography();
    window.addEventListener("resize", this._onResize);
  }

  disconnectedCallback() {
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    if (this._onKeydown) document.removeEventListener("keydown", this._onKeydown, true);
    this._typoBindings = [];
  }

  // =============================================
  // MODAL
  // =============================================

  _buildModal(cfg) {
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) this.closeModal();
    });

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "mClose";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", () => this.closeModal());

    const head = document.createElement("div");
    head.className = "mHead";

    const photo = document.createElement("div");
    photo.className = "mPhoto";

    const text = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "mEyebrow";
    eyebrow.textContent = cfg.modalEyebrowText !== undefined ? cfg.modalEyebrowText : "Speaker";
    eyebrow.style.display = eyebrow.textContent ? "" : "none";

    const nameEl = document.createElement("h2");
    nameEl.className = "mName";
    nameEl.id = "fs-modal-name";
    modal.setAttribute("aria-labelledby", "fs-modal-name");

    const roleEl = document.createElement("p");
    roleEl.className = "mRole";

    const tagEl = document.createElement("span");
    tagEl.className = "mTag";

    text.append(eyebrow, nameEl, roleEl, tagEl);
    head.append(photo, text);

    const rule = document.createElement("div");
    rule.className = "mRule";

    const body = document.createElement("div");
    body.className = "mBody";

    const bioEl = document.createElement("div");
    bioEl.className = "mBio";

    const sessionsWrap = document.createElement("div");
    sessionsWrap.className = "mSessions";
    const sessionsHdr = document.createElement("p");
    sessionsHdr.className = "mSessionsHdr";
    sessionsHdr.textContent = cfg.sessionsHeaderText || "Sessions";
    const sessionsUl = document.createElement("ul");
    sessionsUl.className = "mSessionsList";
    sessionsWrap.append(sessionsHdr, sessionsUl);

    body.append(bioEl, sessionsWrap);
    modal.append(closeBtn, head, rule, body);
    scrim.append(modal);

    return { scrim, modal, closeBtn, photo, eyebrow, nameEl, roleEl, tagEl, bioEl, body, sessionsWrap, sessionsHdr, sessionsUl };
  }

  openModal() {
    const sp = this.speaker || {};
    const cfg = this.config || {};
    const m = this._modal;
    if (!m) return;

    const fullName = this._fullName(sp);
    const jobTitle = this._jobTitle(sp);
    const company = this._company(sp);
    const bio = (sp?.biography ?? sp?.bio ?? sp?.about ?? "").toString();

    // Photo
    m.photo.innerHTML = "";
    const src = (sp?.profilePictureUri || "").trim();
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = fullName || "Speaker";
      m.photo.append(img);
    } else {
      const ini = document.createElement("span");
      ini.className = "initials";
      ini.textContent = this._initials(sp) || "TBA";
      m.photo.append(ini);
    }

    m.nameEl.textContent = fullName || "Speaker";
    m.roleEl.textContent = jobTitle || "";
    m.roleEl.style.display = jobTitle ? "" : "none";
    m.tagEl.textContent = company || "";
    m.tagEl.style.display = company ? "" : "none";
    m.bioEl.innerHTML = this._bioToHtml(bio);
    m.bioEl.style.display = bio ? "" : "none";

    // Sessions this speaker appears in
    const showSessions = cfg.showSessions !== false;
    const allSessions = Array.isArray(cfg.allSessions) ? cfg.allSessions : [];
    const speakerId = String(sp?.id || sp?.speakerId || "");
    const appearsIn = showSessions
      ? allSessions.filter((sess) => {
          const list = Array.isArray(sess.resolvedSpeakers)
            ? sess.resolvedSpeakers
            : Array.isArray(sess.speakers)
            ? sess.speakers.map((x) => (x && x.speaker ? x.speaker : x)).filter(Boolean)
            : [];
          return list.some((x) => String(x?.id || x?.speakerId || "") === speakerId);
        })
      : [];

    m.sessionsUl.innerHTML = "";
    m.sessionsWrap.style.display = appearsIn.length ? "" : "none";
    if (!bio && appearsIn.length) {
      m.sessionsWrap.style.marginTop = "0";
      m.sessionsWrap.style.paddingTop = "0";
      m.sessionsWrap.style.borderTop = "0";
    } else {
      m.sessionsWrap.style.marginTop = "";
      m.sessionsWrap.style.paddingTop = "";
      m.sessionsWrap.style.borderTop = "";
    }

    appearsIn.forEach((sess) => {
      const li = document.createElement("li");
      const nameSpan = document.createElement("span");
      nameSpan.className = "sName";
      nameSpan.textContent = sess.name || "(Untitled)";
      this._applyTypographyOverrides(nameSpan, cfg.typography?.modalSessionName, true);

      const whenSpan = document.createElement("span");
      whenSpan.className = "sWhen";
      whenSpan.textContent = this._formatSessionWhen(sess, cfg.eventTz);
      this._applyTypographyOverrides(whenSpan, cfg.typography?.modalSessionDateTime, true);
      whenSpan.style.display = whenSpan.textContent ? "" : "none";

      li.append(nameSpan, whenSpan);
      m.sessionsUl.append(li);
    });

    // Modal typography overrides
    this._applyTypographyOverrides(m.eyebrow, cfg.typography?.modalEyebrow, true);
    this._applyTypographyOverrides(m.nameEl, cfg.typography?.modalName, true);
    this._applyTypographyOverrides(m.roleEl, cfg.typography?.modalRole, true);
    this._applyTypographyOverrides(m.tagEl, cfg.typography?.modalTag, true);
    this._applyTypographyOverrides(m.bioEl, cfg.typography?.modalBio, true);
    this._applyTypographyOverrides(m.sessionsHdr, cfg.typography?.modalSessionsHeader, true);
    // Bio paragraphs inherit from the wrapper when an override is set
    if (cfg.typography?.modalBio) {
      m.bioEl.querySelectorAll("p").forEach((p) => {
        p.style.fontSize = "inherit";
        p.style.color = "inherit";
        p.style.fontWeight = "inherit";
        p.style.fontStyle = "inherit";
      });
    }

    // Open
    this._lastFocus = this.shadowRoot.querySelector(".card");
    m.body.scrollTop = 0;
    m.scrim.setAttribute("open", "");
    this._lockScroll(true);
    m.closeBtn.focus();

    this._onKeydown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); this.closeModal(); return; }
      if (e.key === "Tab") this._trapTab(e);
    };
    document.addEventListener("keydown", this._onKeydown, true);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cvent-speaker-modal-open"));
    }

    // Lazy hydration in modal if card data was incomplete
    if ((!jobTitle || !company || !bio) && speakerId) {
      const getSpeakersFn = this.config?.getSpeakers ||
        (typeof window !== "undefined" ? window.getSpeakers : undefined);
      if (typeof getSpeakersFn === "function") {
        getSpeakersFn([speakerId])
          .then((map) => {
            const full = map?.[speakerId];
            if (!full || full.failureReason) return;
            const hTitle = this._jobTitle(full);
            const hCompany = this._company(full);
            const hBio = (full.biography ?? full.bio ?? full.about ?? "").toString();
            if (hTitle && !jobTitle) { m.roleEl.textContent = hTitle; m.roleEl.style.display = ""; }
            if (hCompany && !company) { m.tagEl.textContent = hCompany; m.tagEl.style.display = ""; }
            if (hBio && !bio) { m.bioEl.innerHTML = this._bioToHtml(hBio); m.bioEl.style.display = ""; }
          })
          .catch(() => { /* noop */ });
      }
    }
  }

  closeModal() {
    const m = this._modal;
    if (!m || !m.scrim.hasAttribute("open")) return;
    m.scrim.removeAttribute("open");
    this._lockScroll(false);
    if (this._onKeydown) {
      document.removeEventListener("keydown", this._onKeydown, true);
      this._onKeydown = null;
    }
    if (this._lastFocus && this._lastFocus.focus) this._lastFocus.focus();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cvent-speaker-modal-close"));
    }
  }

  _trapTab(e) {
    const m = this._modal;
    const focusables = [m.closeBtn, m.body].filter(Boolean);
    const active = this.shadowRoot.activeElement;
    const idx = focusables.indexOf(active);
    e.preventDefault();
    if (e.shiftKey) {
      focusables[(idx - 1 + focusables.length) % focusables.length].focus();
    } else {
      focusables[(idx + 1) % focusables.length].focus();
    }
  }

  _lockScroll(lock) {
    try {
      if (lock) {
        this._prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = this._prevOverflow || "";
      }
    } catch (e) { /* noop */ }
  }

  // =============================================
  // LAZY HYDRATION (card-level role/company)
  // =============================================

  _hydrateIfNeeded(sp, roleEl, tagEl) {
    const sid = sp?.id || sp?.speakerId;
    const hasTitle = !!this._jobTitle(sp);
    const hasCompany = !!this._company(sp);
    if ((hasTitle && hasCompany) || !sid) return;

    const getSpeakersFn = this.config?.getSpeakers ||
      (typeof window !== "undefined" ? window.getSpeakers : undefined);
    if (typeof getSpeakersFn !== "function") return;

    getSpeakersFn([sid])
      .then((map) => {
        const full = map?.[String(sid)];
        if (!full || full.failureReason) return;
        // Merge so the modal benefits too
        this.speaker = { ...full, ...this.speaker, title: this.speaker.title || full.title,
          company: this.speaker.company || full.company,
          biography: this.speaker.biography || full.biography };
        const hTitle = this._jobTitle(full);
        const hCompany = this._company(full);
        if (hTitle && !hasTitle) { roleEl.textContent = hTitle; roleEl.style.display = ""; }
        if (hCompany && !hasCompany) { tagEl.textContent = this._tagLabel(full); tagEl.title = hCompany; tagEl.style.display = ""; }
      })
      .catch((err) => { console.warn("[FeaturedSpeaker] getSpeakers error", err); });
  }

  // =============================================
  // FORMATTING HELPERS
  // =============================================

  // Cvent bios are plain text with \r\n\r\n paragraph breaks (see playbook §8).
  // Convert to <p> blocks unless the string already contains block HTML.
  _bioToHtml(bio) {
    const s = (bio || "").toString().trim();
    if (!s) return "";
    if (/<(p|div|ul|ol|br|h\d|blockquote)\b/i.test(s)) return s;
    return s
      .split(/\r?\n\s*\r?\n+/)
      .map((para) => para.trim())
      .filter(Boolean)
      .map((para) => `<p>${this._escape(para).replace(/\r?\n/g, "<br>")}</p>`)
      .join("");
  }

  _escape(str) {
    return str.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  _formatSessionWhen(sess, eventTz) {
    const st = sess.startDateTime ? new Date(sess.startDateTime) : null;
    const et = sess.endDateTime ? new Date(sess.endDateTime) : null;
    if (!st || isNaN(st)) return "";
    const tzOpt = eventTz ? { timeZone: eventTz } : {};
    try {
      const date = st.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...tzOpt });
      const t1 = st.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...tzOpt });
      const t2 = et && !isNaN(et) ? et.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...tzOpt }) : "";
      const abbr = eventTz
        ? (new Intl.DateTimeFormat("en-US", { timeZoneName: "short", ...tzOpt }).formatToParts(st).find((p) => p.type === "timeZoneName") || {}).value || ""
        : "";
      return `${date} · ${t1}${t2 ? ` – ${t2}` : ""}${abbr ? ` ${abbr}` : ""}`;
    } catch (e) {
      return st.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    }
  }

  // =============================================
  // TYPOGRAPHY HELPERS (shared pattern with widget.js)
  // =============================================

  _activeFontSize(ov) {
    if (!ov) return undefined;
    const w = window.innerWidth || document.documentElement.clientWidth || 1920;
    if (w <= 600 && ov.fontSizeSm) return ov.fontSizeSm;
    if (w <= 1024 && ov.fontSizeMd) return ov.fontSizeMd;
    return ov.fontSize;
  }

  _applyTypographyNow(element, override) {
    if (!override) return;
    const { color, bold, italic, underline } = override;
    const fs = this._activeFontSize(override);
    element.style.fontSize = fs !== undefined && fs !== null && fs !== "" ? `${fs}px` : "";
    if (color) element.style.color = color;
    if (bold !== undefined) element.style.fontWeight = bold ? "700" : "400";
    if (italic !== undefined) element.style.fontStyle = italic ? "italic" : "normal";
    if (underline !== undefined) element.style.textDecoration = underline ? "underline" : "none";
  }

  _applyTypographyOverrides(element, override, track = false) {
    this._applyTypographyNow(element, override);
    if (track && override) this._typoBindings.push([element, override]);
  }

  _reapplyTypography() {
    for (const [el, ov] of this._typoBindings) this._applyTypographyNow(el, ov);
  }

  // =============================================
  // SPEAKER DATA HELPERS
  // =============================================

  _fullName(sp) {
    return `${(sp?.firstName || "").trim()} ${(sp?.lastName || "").trim()}`.trim();
  }

  _initials(sp) {
    return `${(sp?.firstName || "").trim().charAt(0)}${(sp?.lastName || "").trim().charAt(0)}`.toUpperCase();
  }

  _jobTitle(sp) {
    return (sp?.title || sp?.designation || sp?.jobTitle || sp?.position || sp?.role || "").toString().trim();
  }

  _company(sp) {
    return (sp?.company || sp?.organization || sp?.companyName || sp?.org || "").toString().trim();
  }

  // Planner-defined short labels for company tags (cfg.companyAliases: [{match, label}]).
  // Exact match (case-insensitive) wins; otherwise the first alias whose `match`
  // text appears inside the company name. Unmapped companies are shown as-is.
  _tagLabel(sp) {
    const company = this._company(sp);
    if (!company) return "";
    const aliases = Array.isArray(this.config?.companyAliases) ? this.config.companyAliases : [];
    const norm = (v) => (v || "").toString().trim().toLowerCase();
    const key = norm(company);
    const exact = aliases.find((a) => a && norm(a.match) && norm(a.match) === key);
    if (exact) return (exact.label || "").toString().trim() || company;
    const partial = aliases.find((a) => a && norm(a.match) && key.includes(norm(a.match)));
    if (partial) return (partial.label || "").toString().trim() || company;
    return company;
  }
}
