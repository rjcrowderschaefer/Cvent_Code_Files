// FeaturedSpeaker.js
// Reusable custom element used by widget.js (registered as <dev-featured-speaker-card>)
// Renders a single speaker card with click-to-open modal, mirroring AgendaItem.js patterns.

export class FeaturedSpeaker extends HTMLElement {
  constructor() {
    super();
    // Properties assigned by widget.js before append()
    this.speaker = {};
    this.theme = {};
    this.config = {};

    this._typoBindings = [];
    this._onResize = null;

    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    const sp = this.speaker || {};
    const t = this.theme || {};
    const cfg = this.config || {};

    const cardBg = cfg.cardBg || t.palette?.secondary || "#ffffff";
    const accentColor = cfg.accentColor || "#f7a325";
    const showMoreColor = cfg.showMoreColor || accentColor;
    const modalHeaderBg = cfg.modalColors?.headerBg ?? "#ffffff";
    const modalDivider = cfg.modalColors?.dividerColor ?? "#eeeeee";
    const modalContentBg = cfg.modalColors?.contentBg ?? "#ffffff";
    const cardLayout = cfg.cardLayout || "vertical"; // "vertical" | "horizontal"
    const showBio = cfg.showBio !== false;
    const showBioLimited = cfg.showBioLimited === true;
    const showSessions = cfg.showSessions !== false;

    const cardBorder = cfg.cardBorder || { width: 1, style: "solid", color: "#000000" };
    const borderCSS =
      !cardBorder.width || cardBorder.width === 0 || cardBorder.style === "none"
        ? "none"
        : `${cardBorder.width}px ${cardBorder.style} ${cardBorder.color}`;

    const isHorizontal = cardLayout === "horizontal";

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        font-family: inherit;
      }

      .card {
        display: flex;
        flex-direction: ${isHorizontal ? "row" : "column"};
        align-items: ${isHorizontal ? "flex-start" : "center"};
        background: ${cardBg};
        border: ${borderCSS};
        border-radius: 8px;
        overflow: hidden;
        width: 100%;
        box-sizing: border-box;
        cursor: pointer;
        transition: box-shadow 0.18s ease;
      }

      .card:hover {
        box-shadow: 0 4px 16px rgba(0,0,0,0.10);
      }

      .avatarWrap {
        flex-shrink: 0;
        ${isHorizontal
          ? "padding: 16px 0 16px 16px;"
          : "padding: 20px 20px 10px 20px; width: 100%; display: flex; justify-content: center;"}
      }

      .avatar {
        width: ${isHorizontal ? "80px" : "100px"};
        height: ${isHorizontal ? "80px" : "100px"};
        border-radius: 50%;
        object-fit: cover;
        display: block;
      }

      .info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: ${isHorizontal ? "16px 16px 16px 12px" : "0 16px 16px 16px"};
        min-width: 0;
        ${isHorizontal ? "" : "width: 100%; box-sizing: border-box; text-align: center;"}
      }

      .speakerName {
        line-height: 1.2;
        margin: 0;
      }

      .speakerTitle {
        white-space: normal;
        word-break: break-word;
        margin: 0;
      }

      .speakerCompany {
        white-space: normal;
        word-break: break-word;
        margin: 0;
      }

      .bioWrap {
        position: relative;
        margin-top: 6px;
      }

      .bio-text {
        margin: 0;
        line-height: 1.5;
      }

      .bio-text p { margin: 0; padding: 0; }
      .bio-text > *:first-child { margin-top: 0 !important; }
      .bio-text > *:last-child { margin-bottom: 0 !important; }

      .bio-limited {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .show-more-toggle {
        cursor: pointer;
        font-size: 13px;
        margin-top: 4px;
        text-decoration: underline;
        color: ${showMoreColor};
        display: inline-block;
      }

      .show-more-toggle:hover { opacity: 0.75; }

      /* ===== Modal ===== */
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.45);
        display: none;
        place-items: center;
        z-index: 999999;
      }

      .backdrop[open] { display: grid; }

      .modal {
        width: min(720px, 92vw);
        max-height: 90vh;
        overflow: auto;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
      }

      .modalHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: ${modalHeaderBg};
        border-bottom: 1px solid ${modalDivider};
      }

      .modalTitle { /* styled via cfg.typography.modalSpeakerName */ }

      .closeBtn {
        appearance: none;
        border: none;
        background: transparent;
        font-size: 20px;
        cursor: pointer;
        line-height: 1;
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

      .modalAvatar {
        width: 125px;
        height: 125px;
        object-fit: cover;
        border-radius: 50%;
        grid-column: 1;
        grid-row: 1;
      }

      .modalDetails {
        grid-column: 2;
        grid-row: 1;
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .kv { margin: 2px 0; }

      .modalBio {
        margin: 5px 0 0 0;
        line-height: 1.45;
        grid-column: 1 / -1;
        grid-row: 2;
      }

      .sessionsHeader {
        margin-top: 10px;
        grid-column: 1 / -1;
        grid-row: 3;
      }

      .sessionsList {
        margin: 4px 0 0 18px;
        padding: 0;
        grid-column: 1 / -1;
        grid-row: 4;
      }

      .sessionsList li { margin: 2px 0; }

      @media (max-width: 600px) {
        .card { flex-direction: column; align-items: center; }
        .avatarWrap { padding: 16px 16px 8px 16px; }
        .info { text-align: center; padding: 0 16px 16px 16px; }
        .avatar { width: 80px; height: 80px; }
        .modalBody { grid-template-columns: 1fr; }
        .modalAvatar { width: 90px; height: 90px; grid-column: 1; }
        .modalDetails { grid-column: 1; grid-row: 2; margin-top: 8px; }
        .modalBio { grid-row: 3; }
        .sessionsHeader { grid-row: 4; }
        .sessionsList { grid-row: 5; }
      }
    `;
    this.shadowRoot.append(style);

    // Root card — clicking anywhere opens the modal
    const card = document.createElement("div");
    card.classList.add("card");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `View details for ${this._fullName(sp)}`);
    card.addEventListener("click", () => this.openModal());
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.openModal();
      }
    });
    this.shadowRoot.append(card);

    // Avatar
    const avatarWrap = document.createElement("div");
    avatarWrap.classList.add("avatarWrap");
    const img = document.createElement("img");
    img.classList.add("avatar");
    img.src =
      (sp?.profilePictureUri || "").trim() ||
      "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
    img.alt = this._fullName(sp) || "Speaker";
    avatarWrap.append(img);
    card.append(avatarWrap);

    // Info block
    const info = document.createElement("div");
    info.classList.add("info");

    // Name
    const nameEl = document.createElement("div");
    nameEl.classList.add("speakerName");
    nameEl.textContent = this._fullName(sp);
    this._applyThemeStyle(nameEl, t.paragraph);
    this._applyTypographyOverrides(nameEl, cfg.typography?.speakerName, true);

    // Title
    const titleEl = document.createElement("div");
    titleEl.classList.add("speakerTitle");
    titleEl.textContent = this._jobTitle(sp);
    this._applyThemeStyle(titleEl, t.paragraph);
    this._applyTypographyOverrides(titleEl, cfg.typography?.speakerTitle, true);
    titleEl.style.display = titleEl.textContent ? "" : "none";

    // Company
    const companyEl = document.createElement("div");
    companyEl.classList.add("speakerCompany");
    companyEl.textContent = this._company(sp);
    this._applyThemeStyle(companyEl, t.paragraph);
    this._applyTypographyOverrides(companyEl, cfg.typography?.speakerCompany, true);
    companyEl.style.display = companyEl.textContent ? "" : "none";

    info.append(nameEl, titleEl, companyEl);

    // Bio on card (optional)
    if (showBio && sp?.biography) {
      const bioWrap = document.createElement("div");
      bioWrap.classList.add("bioWrap");

      const bioText = document.createElement("div");
      bioText.classList.add("bio-text");
      bioText.innerHTML = sp.biography;
      this._applyTypographyOverrides(bioText, cfg.typography?.speakerBio, true);

      bioWrap.append(bioText);

      if (showBioLimited) {
        bioText.classList.add("bio-limited");

        const toggle = document.createElement("div");
        toggle.classList.add("show-more-toggle");
        toggle.textContent = "Show more";
        let expanded = false;
        toggle.onclick = (e) => {
          e.stopPropagation(); // don't open modal
          expanded = !expanded;
          if (expanded) {
            bioText.classList.remove("bio-limited");
            toggle.textContent = "Show less";
          } else {
            bioText.classList.add("bio-limited");
            toggle.textContent = "Show more";
          }
        };
        bioWrap.append(toggle);
      }

      info.append(bioWrap);
    }

    card.append(info);

    // Lazy hydration — fill title/company if missing from SDK
    this._hydrateIfNeeded(sp, titleEl, companyEl);

    // Modal (built once, reused)
    this._modal = this._buildModal(cfg, t);
    this.shadowRoot.append(this._modal.backdrop);

    // Keyboard escape closes modal
    this.shadowRoot.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeModal();
    }, { capture: true });

    this._onResize = () => this._reapplyTypography();
    window.addEventListener("resize", this._onResize);
  }

  disconnectedCallback() {
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    this._typoBindings = [];
  }

  // =============================================
  // MODAL
  // =============================================

  _buildModal(cfg, t) {
    const backdrop = document.createElement("div");
    backdrop.classList.add("backdrop");
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this.closeModal();
    });

    const modal = document.createElement("div");
    modal.classList.add("modal");
    backdrop.append(modal);

    // Header
    const header = document.createElement("div");
    header.classList.add("modalHeader");

    const titleEl = document.createElement("div");
    titleEl.classList.add("modalTitle");

    const closeBtn = document.createElement("button");
    closeBtn.classList.add("closeBtn");
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => this.closeModal());
    header.append(titleEl, closeBtn);

    // Body
    const body = document.createElement("div");
    body.classList.add("modalBody");

    const avatar = document.createElement("img");
    avatar.classList.add("modalAvatar");
    avatar.alt = "Speaker photo";

    const details = document.createElement("div");
    details.classList.add("modalDetails");

    const nameEl = document.createElement("div");
    const jobTitleEl = document.createElement("div");
    jobTitleEl.classList.add("kv");
    const companyEl = document.createElement("div");
    companyEl.classList.add("kv");
    details.append(nameEl, jobTitleEl, companyEl);

    const bioEl = document.createElement("div");
    bioEl.classList.add("modalBio");

    const sessionsHdr = document.createElement("div");
    sessionsHdr.classList.add("sessionsHeader");
    sessionsHdr.textContent = "Sessions";

    const sessionsUl = document.createElement("ul");
    sessionsUl.classList.add("sessionsList");

    body.append(avatar, details, bioEl, sessionsHdr, sessionsUl);
    modal.append(header, body);

    return { backdrop, titleEl, avatar, nameEl, jobTitleEl, companyEl, bioEl, sessionsHdr, sessionsUl };
  }

  openModal() {
    const sp = this.speaker || {};
    const cfg = this.config || {};
    const t = this.theme || {};

    if (!this._modal) {
      this._modal = this._buildModal(cfg, t);
      this.shadowRoot.append(this._modal.backdrop);
    }

    const fullName = this._fullName(sp);
    let jobTitle = this._jobTitle(sp);
    let company = this._company(sp);
    let bio = (sp?.biography ?? sp?.bio ?? sp?.about ?? "").toString();

    this._modal.titleEl.textContent = fullName || "Speaker";
    this._modal.avatar.src =
      (sp?.profilePictureUri || "").trim() ||
      "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
    this._modal.nameEl.textContent = fullName || "";
    this._modal.jobTitleEl.textContent = jobTitle || "";
    this._modal.companyEl.textContent = company || "";
    this._modal.bioEl.innerHTML = bio || "";

    this._modal.jobTitleEl.style.display = jobTitle ? "" : "none";
    this._modal.companyEl.style.display = company ? "" : "none";
    this._modal.bioEl.style.display = bio ? "" : "none";

    // Sessions this speaker appears in
    const allSessions = Array.isArray(cfg.allSessions) ? cfg.allSessions : [];
    const speakerId = sp?.id || sp?.speakerId;
    const appearsIn = allSessions.filter((sess) => {
      const list = Array.isArray(sess.resolvedSpeakers)
        ? sess.resolvedSpeakers
        : Array.isArray(sess.speakers)
        ? sess.speakers.map((x) => (x && x.speaker ? x.speaker : x)).filter(Boolean)
        : [];
      return list.some((x) => (x?.id || x?.speakerId) === speakerId);
    });

    const showSessions = cfg.showSessions !== false;
    this._modal.sessionsHdr.style.display = showSessions && appearsIn.length ? "" : "none";
    this._modal.sessionsUl.innerHTML = "";

    if (showSessions && appearsIn.length) {
      appearsIn.forEach((sess) => {
        const li = document.createElement("li");

        const nameSpan = document.createElement("span");
        nameSpan.textContent = sess.name || "(Untitled)";
        this._applyTypographyOverrides(nameSpan, cfg.typography?.modalSessionName, true);

        const dtSpan = document.createElement("span");
        const st = sess.startDateTime ? new Date(sess.startDateTime) : null;
        const et = sess.endDateTime ? new Date(sess.endDateTime) : null;
        const stTxt = st ? st.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
        const etTxt = et ? et.toLocaleString("en-US", { timeStyle: "short" }) : "";
        dtSpan.textContent = stTxt ? (etTxt ? ` — ${stTxt} – ${etTxt}` : ` — ${stTxt}`) : "";
        this._applyTypographyOverrides(dtSpan, cfg.typography?.modalSessionDateTime, true);

        li.append(nameSpan, dtSpan);
        this._modal.sessionsUl.append(li);
      });
    }

    // Modal typography
    this._applyTypographyOverrides(this._modal.titleEl, cfg.typography?.modalSpeakerName, true);
    this._applyTypographyOverrides(this._modal.nameEl, cfg.typography?.modalSpeakerName, true);
    this._applyTypographyOverrides(this._modal.jobTitleEl, cfg.typography?.modalSpeakerTitle, true);
    this._applyTypographyOverrides(this._modal.companyEl, cfg.typography?.modalSpeakerCompany, true);
    this._applyTypographyOverrides(this._modal.bioEl, cfg.typography?.modalSpeakerBio, true);
    this._applyTypographyOverrides(this._modal.sessionsHdr, cfg.typography?.modalSessionsHeader, true);

    this._modal.backdrop.setAttribute("open", "");
    this._modal.backdrop.querySelector(".closeBtn")?.focus();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cvent-speaker-modal-open"));
    }

    // Lazy hydration in modal if card data was incomplete
    if ((!jobTitle || !company || !bio) && speakerId) {
      const getSpeakersFn =
        this.config?.getSpeakers ||
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
              this._modal.jobTitleEl.textContent = hTitle;
              this._modal.jobTitleEl.style.display = "";
            }
            if (hCompany && !company) {
              this._modal.companyEl.textContent = hCompany;
              this._modal.companyEl.style.display = "";
            }
            if (hBio && !bio) {
              this._modal.bioEl.innerHTML = hBio;
              this._modal.bioEl.style.display = "";
            }
          })
          .catch(() => { /* noop */ });
      }
    }
  }

  closeModal() {
    this._modal?.backdrop?.removeAttribute("open");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cvent-speaker-modal-close"));
    }
  }

  // =============================================
  // LAZY HYDRATION (card-level title/company)
  // =============================================

  _hydrateIfNeeded(sp, titleEl, companyEl) {
    const sid = sp?.id || sp?.speakerId;
    const hasTitle = !!this._jobTitle(sp);
    const hasCompany = !!this._company(sp);
    if ((hasTitle && hasCompany) || !sid) return;

    const getSpeakersFn =
      this.config?.getSpeakers ||
      (typeof window !== "undefined" ? window.getSpeakers : undefined);
    if (typeof getSpeakersFn !== "function") return;

    getSpeakersFn([sid])
      .then((map) => {
        const full = map?.[String(sid)];
        if (!full || full.failureReason) return;

        const hTitle = (full.title || full.designation || "").toString().trim();
        const hCompany = (full.company || full.organization || full.companyName || "").toString().trim();

        if (hTitle && !hasTitle) {
          titleEl.textContent = hTitle;
          titleEl.style.display = "";
        }
        if (hCompany && !hasCompany) {
          companyEl.textContent = hCompany;
          companyEl.style.display = "";
        }
      })
      .catch((err) => { console.warn("[FeaturedSpeaker] getSpeakers error", err); });
  }

  // =============================================
  // TYPOGRAPHY HELPERS (mirrors AgendaItem.js)
  // =============================================

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
    element.style.fontSize = fs !== undefined && fs !== null && fs !== "" ? `${fs}px` : "";
    if (color !== undefined) element.style.color = color || "";
    if (bold !== undefined) element.style.fontWeight = bold ? "700" : "";
    if (italic !== undefined) element.style.fontStyle = italic ? "italic" : "";
    if (underline !== undefined) element.style.textDecoration = underline ? "underline" : "none";
  }

  _applyTypographyOverrides(element, override, track = false) {
    this._applyTypographyNow(element, override);
    if (track) this._typoBindings.push([element, override || {}]);
  }

  _reapplyTypography() {
    for (const [el, ov] of this._typoBindings) this._applyTypographyNow(el, ov);
  }

  _applyThemeStyle(el, themeStyleObj = {}, extra = {}) {
    const { customClasses, ...styles } = themeStyleObj || {};
    Object.assign(el.style, styles, extra);
    if (Array.isArray(customClasses) && customClasses.length) el.classList.add(...customClasses);
  }

  // =============================================
  // SPEAKER DATA HELPERS
  // =============================================

  _fullName(sp) {
    return `${(sp?.firstName || "").trim()} ${(sp?.lastName || "").trim()}`.trim();
  }

  _jobTitle(sp) {
    return (sp?.title || sp?.designation || sp?.jobTitle || sp?.position || sp?.role || "").toString().trim();
  }

  _company(sp) {
    return (sp?.company || sp?.organization || sp?.companyName || sp?.org || "").toString().trim();
  }
}