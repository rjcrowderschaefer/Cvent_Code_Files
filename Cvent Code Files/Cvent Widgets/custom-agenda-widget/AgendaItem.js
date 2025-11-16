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
    const s = this.session || {};
    const t = this.theme || {};
    const cfg = this.config || {};

    const gutterBg = cfg.gutterBg || t.palette?.accent || "#e8eef9";
    const cardBg   = cfg.cardBg   || t.palette?.secondary || "#ffffff";

    const modalHeaderBg  = cfg.modalColors?.headerBg      ?? "#ffffff";
    const modalDivider   = cfg.modalColors?.dividerColor  ?? "#eeeeee";
    const modalContentBg = cfg.modalColors?.contentBg     ?? "#ffffff";

    const style = document.createElement("style");
    style.textContent = `
      :host { 
        display: block;
        font-family: inherit;
      }
      
      .card {
        display: grid;
        grid-template-columns: 75px 1fr;
        background: ${cardBg};
        border-radius: 8px;
        overflow: hidden;
        width: calc(100% - 40px); /* 20px on each side */
        max-width: 1210px;
        margin: 0 auto;  /* centers it on any screen */
        box-sizing: border-box;
      }


      @media (max-width: 1024px) {
        .card {
          grid-template-columns: 84px 1fr;
          width: calc(100% - 50px);
        }
      }

      @media (max-width: 600px) {
        .card {
          grid-template-columns: 70px 1fr;
          width: calc(100% - 30px);

        }
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
      .timePart { line-height: 1.1; white-space: nowrap; }

      .content {
        display: flex;
        flex-direction: column;
        padding: 10px 12px;
        gap: 8px;
        min-width: 0;
      }

      .speakersWrap { display: flex; flex-direction: column; gap: 8px; }
      .speakerLine {
        display: flex; align-items: center; gap: 10px; min-width: 0;
        cursor: pointer;
      }
      .avatar {
        width: 50px; height: 50px; border-radius: 50%; border: 1px solid #FFFFFF;
        box-shadow: rgb(165, 165, 165) 2px 3px 5px -1px; object-fit: cover; flex-shrink: 0;
      }
      .info { display: flex; flex-direction: column; justify-content: center; line-height: 1.2; min-width: 0; }
      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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

      /* ===== Modal ===== */
      .backdrop {
        position: fixed; inset: 0;
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
        background: #fff; /* container background */
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
      }
      .modalHeader {
        display:flex; align-items:center; justify-content:space-between;
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
        display: grid; grid-template-columns: 96px 1fr; gap: 14px;
        background: ${modalContentBg};
      }
      .modalAvatar { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; }
      .kv { margin: 2px 0; }
      .bio { margin: 10px 0 0 0; line-height: 1.45; }
      .sessionsHeader { margin-top: 10px; }
      .sessionsList { margin: 8px 0 12px 18px; padding: 0; }
      .sessionsList li { margin: 4px 0; }
    `;
    this.shadowRoot.append(style);

    // Root card
    const card = document.createElement("div");
    card.classList.add("card");
    this.shadowRoot.append(card);

    // Time gutter
    const start = s.startDateTime ? new Date(s.startDateTime) : null;
    const end   = s.endDateTime   ? new Date(s.endDateTime)   : null;
    const startText = start ? start.toLocaleString("en-US", { timeStyle: "short" }) : "";
    const endText   = end   ? end.toLocaleString("en-US",   { timeStyle: "short" }) : "";

    const gutter = document.createElement("div");
    gutter.classList.add("timeGutter");

    const timeStartEl = document.createElement("div");
    timeStartEl.classList.add("timePart", "timeStart");
    timeStartEl.textContent = startText || "";
    this.applyThemeStyle(timeStartEl, t.paragraph);
    this.applyTypographyOverrides(timeStartEl, cfg.typography?.sessionTime, true);

    const timeEndEl = document.createElement("div");
    timeEndEl.classList.add("timePart", "timeEnd");
    timeEndEl.textContent = endText || "";
    this.applyThemeStyle(timeEndEl, t.paragraph);
    this.applyTypographyOverrides(timeEndEl, cfg.typography?.sessionTime, true);

    gutter.append(timeStartEl, timeEndEl);

    // Content
    const content = document.createElement("div");
    content.classList.add("content");

    // Title
    const titleEl = document.createElement("h1");
    titleEl.textContent = s.name || "";
    this.applyThemeStyle(titleEl, t.header2, { margin: "0" });
    this.applyTypographyOverrides(titleEl, cfg.typography?.sessionName, true);
    content.append(titleEl);

    // Description
    if (cfg.showDescription && s.description) {
      const desc = document.createElement("div");
      // NOTE: description is treated as HTML by Cvent; ensure it’s trusted or sanitize upstream as needed.
      desc.innerHTML = s.description;
      this.applyThemeStyle(desc, t.mainText);
      this.applyTypographyOverrides(desc, cfg.typography?.sessionDescription, true);
      content.append(desc);
    }

    // Speakers
    const speakersWrap = document.createElement("div");
    speakersWrap.classList.add("speakersWrap");

    const speakers = this.getSpeakersArray(s);
    speakers.forEach(sp => speakersWrap.append(this.renderSpeakerLine(sp)));
    content.append(speakersWrap);

    // Assemble
    card.append(gutter, content);

    // Modal element (single, reused)
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

  disconnectedCallback() {
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    this._typoBindings = [];
  }

  renderSpeakerLine(spRaw) {
    const t = this.theme || {};
    const cfg = this.config || {};
  
    // 0) unwrap if you were passed { speaker, role }
    const sp = (spRaw && spRaw.speaker) ? spRaw.speaker : spRaw;
  
    const sid = sp?.id || sp?.speakerId || "";
    const firstName = (sp?.firstName || "").trim();
    const lastName  = (sp?.lastName  || "").trim();
  
    // 1) local values (may be empty pre-hydration)
    let jobTitle = (
      sp?.title ||
      sp?.designation ||   // Cvent commonly uses this for job title
      sp?.jobTitle ||
      sp?.position ||
      sp?.role ||
      ""
    ).toString().trim();
  
    let company = (
      sp?.company ||
      sp?.organization ||
      sp?.companyName ||
      sp?.org ||
      ""
    ).toString().trim();
  
    const pic = (sp?.profilePictureUri || "").trim();
  
    const line = document.createElement("div");
    line.classList.add("speakerLine");
    line.setAttribute("role", "button");
    line.setAttribute("tabindex", "0");
    if (sid) line.dataset.speakerId = sid;
    line.addEventListener("click", () => this.openModalForSpeaker(sp));
    line.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.openModalForSpeaker(sp); }
    });
  
    const img = document.createElement("img");
    img.src = pic || "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
    img.alt = `${firstName} ${lastName}`.trim() || "Speaker";
    img.classList.add("avatar");
  
    const info = document.createElement("div");
    info.classList.add("info");
  
    const nameSpan = document.createElement("span");
    nameSpan.classList.add("speakerName");
    nameSpan.textContent = `${firstName} ${lastName}`.trim();
    this.applyThemeStyle(nameSpan, t.paragraph);
    this.applyTypographyOverrides(nameSpan, cfg.typography?.speakerName, true);
  
    const meta = document.createElement("span");
    meta.style.display = "block";
    meta.classList.add("truncate");
  
    const titleSpan = document.createElement("span");
    titleSpan.classList.add("speakerTitle", "truncate");
    titleSpan.textContent = jobTitle;
    this.applyThemeStyle(titleSpan, t.paragraph);
    this.applyTypographyOverrides(titleSpan, cfg.typography?.speakerTitle, true);
  
    const comma = document.createTextNode(jobTitle && company ? ", " : "");
  
    const companySpan = document.createElement("span");
    companySpan.classList.add("speakerCompany", "truncate");
    companySpan.textContent = company;
    this.applyThemeStyle(companySpan, t.paragraph);
    this.applyTypographyOverrides(companySpan, cfg.typography?.speakerCompany, true);
  
    // TEMP: make sure styles can't hide them while testing
    titleSpan.style.fontSize = titleSpan.style.fontSize || "16px";
    titleSpan.style.color = titleSpan.style.color || "inherit";
    companySpan.style.fontSize = companySpan.style.fontSize || "16px";
    companySpan.style.color = companySpan.style.color || "inherit";
  
    meta.append(titleSpan, comma, companySpan);
    info.append(nameSpan, meta);
    line.append(img, info);
  
    // 2) Lazy hydration- if missing, fetch from SDK and patch DOM
    const getSpeakersFn = this.config?.getSpeakers || (typeof window !== "undefined" ? window.getSpeakers : undefined);
    if ((!jobTitle || !company) && typeof getSpeakersFn === "function" && sid) {
      // log once per line so you can see it fire
      console.debug("Hydrating speaker", { sid, hadTitle: !!jobTitle, hadCompany: !!company });
  
      getSpeakersFn([sid]).then((map) => {
        const key = String(sid);
        const full = map?.[key];
        if (!full || full.failureReason) {
          console.warn("getSpeakers returned failure for", key, full?.failureReason);
          return;
        }
  
        const hydratedTitle = (
          full.title ||
          full.designation || // per docs
          ""
        ).toString().trim();
  
        const hydratedCompany = (
          full.company ||
          full.organization ||
          full.companyName ||
          ""
        ).toString().trim();
  
        // Patch the DOM if we gained data
        if (hydratedTitle && !jobTitle) {
          jobTitle = hydratedTitle;
          titleSpan.textContent = hydratedTitle;
        }
        if (hydratedCompany && !company) {
          company = hydratedCompany;
          companySpan.textContent = hydratedCompany;
        }
        comma.nodeValue = (jobTitle && company) ? ", " : "";
  
        console.debug("Hydrated speaker result", {
          sid: key,
          title: hydratedTitle,
          company: hydratedCompany
        });
      }).catch((err) => {
        console.warn("getSpeakers error", err);
      });
    } else {
      // Diagnostics when hydration didn't run:
      if (!getSpeakersFn) console.warn("getSpeakers not available on config/window");
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

    // right: details
    const details = document.createElement("div");

    const nameEl = document.createElement("div");
    const titleEl = document.createElement("div"); titleEl.classList.add("kv");
    const companyEl = document.createElement("div"); companyEl.classList.add("kv");

    const bioEl = document.createElement("div"); bioEl.classList.add("bio");

    const sessionsHdr = document.createElement("div");
    sessionsHdr.classList.add("sessionsHeader");
    sessionsHdr.textContent = "Sessions";

    const sessionsUl = document.createElement("ul"); sessionsUl.classList.add("sessionsList");

    details.append(nameEl, titleEl, companyEl, bioEl, sessionsHdr, sessionsUl);
    body.append(avatar, details);

    modal.append(header, body);

    return {
      backdrop,
      title,
      avatar,
      nameEl,
      titleEl,
      companyEl,
      bioEl,
      sessionsHdr,
      sessionsUl
    };
  }

  applyModalTypography(cfg) {
    this.applyTypographyOverrides(this.modal.title,       cfg.typography?.modalName, true);
    this.applyTypographyOverrides(this.modal.nameEl,      cfg.typography?.modalSpeakerName, true);
    this.applyTypographyOverrides(this.modal.titleEl,     cfg.typography?.modalSpeakerTitle, true);
    this.applyTypographyOverrides(this.modal.companyEl,   cfg.typography?.modalSpeakerCompany, true);
    this.applyTypographyOverrides(this.modal.bioEl,       cfg.typography?.modalSpeakerBio, true);
    this.applyTypographyOverrides(this.modal.sessionsHdr, cfg.typography?.modalSessionsHeader, true);
  }

  openModalForSpeaker(spRaw) {
    if (!this.modal) {
      this.modal = this.buildModal();
      this.shadowRoot.append(this.modal.backdrop);
    }
    const cfg = this.config || {};
    const allSessions = Array.isArray(cfg.allSessions) ? cfg.allSessions : [this.session];

    // unwrap if needed
    const sp = (spRaw && spRaw.speaker) ? spRaw.speaker : spRaw;

    const fullName = `${(sp?.firstName||"").trim()} ${(sp?.lastName||"").trim()}`.trim();
    let jobTitle = (
      sp?.title || sp?.designation || sp?.jobTitle || sp?.position || sp?.role || ""
    ).toString().trim();
    let company  = (
      sp?.company || sp?.organization || sp?.companyName || sp?.org || ""
    ).toString().trim();
    let bio      = (sp?.biography ?? sp?.bio ?? sp?.about ?? "").toString();

    this.modal.title.textContent = fullName || "Speaker";
    this.modal.avatar.src = (sp?.profilePictureUri || "").trim() || "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
    this.modal.nameEl.textContent = fullName || "";
    this.modal.titleEl.textContent = jobTitle || "";
    this.modal.companyEl.textContent = company || "";
    this.modal.bioEl.innerHTML = bio || "";

    this.applyModalTypography(cfg);

    // Show/hide blocks when empty
    this.modal.titleEl.style.display   = jobTitle ? "" : "none";
    this.modal.companyEl.style.display = company  ? "" : "none";
    this.modal.bioEl.style.display     = bio      ? "" : "none";

    const speakerId = sp?.id || sp?.speakerId;
    const appearsIn = allSessions.filter(sess => {
      const list = Array.isArray(sess.resolvedSpeakers) ? sess.resolvedSpeakers
               : Array.isArray(sess.speakers) ? sess.speakers.map(x => (x && x.speaker) ? x.speaker : x).filter(Boolean)
               : [];
      return list.some(x => (x?.id || x?.speakerId) === speakerId);
    });

    this.modal.sessionsUl.innerHTML = "";
    if (appearsIn.length) {
      appearsIn.forEach(sess => {
        const li = document.createElement("li");

        const nameSpan = document.createElement("span");
        nameSpan.textContent = sess.name || "(Untitled)";
        this.applyTypographyOverrides(nameSpan, cfg.typography?.modalSessionName, true);

        const dtSpan = document.createElement("span");
        const st = sess.startDateTime ? new Date(sess.startDateTime) : null;
        const et = sess.endDateTime ? new Date(sess.endDateTime) : null;
        const stTxt = st ? st.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
        const etTxt = et ? et.toLocaleString("en-US", { timeStyle: "short" }) : "";
        dtSpan.textContent = stTxt ? (etTxt ? ` — ${stTxt} – ${etTxt}` : ` — ${stTxt}`) : "";
        this.applyTypographyOverrides(dtSpan, cfg.typography?.modalSessionDateTime, true);

        li.append(nameSpan, dtSpan);
        this.modal.sessionsUl.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "No other sessions found.";
      this.modal.sessionsUl.appendChild(li);
    }

    // OPEN modal
    this.modal.backdrop.setAttribute("open", "");
    this.modal.backdrop.querySelector(".closeBtn")?.focus();

    // ===== Optional lazy hydration for modal (title/company/bio) =====
    if ((!jobTitle || !company || !bio) && speakerId) {
      const getSpeakersFn = this.config?.getSpeakers || (typeof window !== "undefined" ? window.getSpeakers : undefined);
      if (typeof getSpeakersFn === "function") {
        getSpeakersFn([speakerId]).then(map => {
          const full = map?.[String(speakerId)];
          if (!full || full.failureReason) return;

          const hTitle = (full.title || full.designation || "").toString().trim();
          const hCompany = (full.company || full.organization || full.companyName || "").toString().trim();
          const hBio = (full.biography ?? full.bio ?? full.about ?? "").toString();

          if (hTitle && !jobTitle) {
            jobTitle = hTitle;
            this.modal.titleEl.textContent = hTitle;
            this.modal.titleEl.style.display = "";
          }
          if (hCompany && !company) {
            company = hCompany;
            this.modal.companyEl.textContent = hCompany;
            this.modal.companyEl.style.display = "";
          }
          if (hBio && !bio) {
            bio = hBio;
            this.modal.bioEl.innerHTML = hBio;
            this.modal.bioEl.style.display = "";
          }
        }).catch(() => {/* noop */});
      }
    }
  }

  closeModal() {
    this.modal?.backdrop?.removeAttribute("open");
  }

  reapplyTypography() {
    for (const [el, override] of this._typoBindings) {
      this._applyTypographyNow(el, override);
    }
  }

  // === helpers ===
  getSpeakersArray(session) {
    if (Array.isArray(session?.resolvedSpeakers) && session.resolvedSpeakers.length) return session.resolvedSpeakers;
    if (Array.isArray(session?.speakers) && session.speakers.length) {
      return session.speakers.map(x => (x && x.speaker) ? x.speaker : x).filter(Boolean);
    }
    return [];
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
    element.style.fontSize = (fs !== undefined && fs !== null && fs !== "") ? `${fs}px` : "";
    if (color !== undefined) element.style.color = color || "";
    if (bold !== undefined) element.style.fontWeight = bold ? "700" : "";
    if (italic !== undefined) element.style.fontStyle = italic ? "italic" : "";
    if (underline !== undefined) {
      const existing = getComputedStyle(element).textDecorationLine;
      const parts = new Set((existing || "").split(" ").filter(Boolean));
      if (underline) parts.add("underline"); else parts.delete("underline");
      element.style.textDecorationLine = parts.size ? Array.from(parts).join(" ") : "";

    }
  }

  applyTypographyOverrides(element, override, track = false) {
    this._applyTypographyNow(element, override);
    if (track) this._typoBindings.push([element, override || {}]);
  }
}
