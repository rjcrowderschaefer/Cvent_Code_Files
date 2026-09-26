// widget.js — Agenda PAGE widget (Bloomberg Live event sites).
//
// Renders the whole Agenda page body:
//   dark banner · day heading + filter chips + session list · "Request to attend" band
// Sessions are LIVE event data (SDK), grouped by day in the EVENT timezone.
//   - break rows      = sessions whose Cvent category is listed as a break
//                       category (planner-editable), or whose "Break session?"
//                       custom field is Yes (same field as the agenda widget)
//   - type badge      = the session's Cvent category
//   - filter chips    = one per category, or planner-defined groups
//   - speaker chips   = open the shared FeaturedSpeaker bio pop-up
// Shared building blocks: page-kit.js (base class, banner, band, tokens) —
// identical copy in every page widget. NOTE: include the file extension in imports.
import { FeaturedSpeaker, defaultTypography as speakerTypography } from "./FeaturedSpeaker.js";
import {
  PageWidget, PAGE_BASE_DEFAULTS, mergePageConfig, TOKENS, esc, fixed, countSessions, cleanRichText,
  fmtTime, fmtTimeRange, fmtDate, tzName, lines, isHiddenSession, fieldIsYes, sessionField,
} from "./page-kit.js";

const CARD_TAG = "bbg-agenda-speaker-card";
// Bump on every change. Shown in the editor footer and as data-build on the
// widget root, so a stale Cvent/CDN copy is obvious (Playbook §0).
export const BUILD = "agenda-2026-09-26f";

export const SECTION_LABELS = {
  banner: "Page banner",
  program: "Program",
  cta: "Request to attend band",
};

export const AGENDA_DEFAULTS = {
  ...PAGE_BASE_DEFAULTS,
  order: ["banner", "program", "cta"],
  program: {
    show: true,
    showDayHeading: true,
    showFilters: true,
    allLabel: "",             // blank = "All sessions" in the visitor’s language
    // One chip per line, "Label: Category, Category". Blank = one chip per
    // Cvent session category (break categories excluded).
    filterGroups: "",
    // Sessions in these Cvent categories render as grey break rows.
    breakCategories: "Break, Logistics, Networking, Registration, Arrivals, Meal, Lunch, Breakfast, Reception",
    // Session details (one quiet line under the title, tags after the speakers):
    showCategory: true,       // Cvent session category
    showLocation: true,       // Cvent session location
    showTags: true,           // multi-choice session custom field (tagsField), first 5 values
    tagsField: "Tags",
    locationFilter: true,     // "Location" drop-down (shown when 2+ locations are used)
    tagFilter: true,          // "Topics" drop-down (shown when 2+ tags are used)
    locationLabel: "",        // blank = "Location" in the visitor’s language
    tagsLabel: "",            // blank = "Topics" in the visitor’s language
    showDescription: true,
    descriptionLines: 2,      // lines shown before "Read more" (0 = full text)
    // "Speakers to be announced" on sessions without speakers:
    //   "field" = only sessions whose "Speakers TBA?" custom field is Yes
    //   "all"   = every non-break session without speakers
    //   "off"   = never
    tbaMode: "field",
    hiddenSessionIds: [],     // sessions hidden from this page (in addition to the custom field)
    showPhotos: true,
    // Speakers in these Cvent speaker categories are shown after the other
    // speakers, below a hairline, with an amber label above their name.
    moderatorCategories: "Moderator, Moderators",
    moderatorLabel: "",       // blank = "Moderator" in the visitor’s language
    speakerBios: true,        // speaker chips open the bio pop-up
    modalEyebrowText: "",     // blank = "Speaker" in the visitor’s language (moderators get "Moderator")
    showSessions: true,
    sessionsHeaderText: "",   // blank = "Sessions" / "Session" in the visitor’s language
    sessionHeaderText: "",
  },
};

export function mergeAgendaConfig(incoming = {}) {
  return mergePageConfig(AGENDA_DEFAULTS, incoming);
}

const norm = (s) => String(s ?? "").trim().toLowerCase();
const catName = (s) => String(s?.category?.name || "").trim();

// Parse "Label: Cat A, Cat B" lines into chip groups.
export function parseGroups(text) {
  return lines(text).map((l) => {
    const i = l.indexOf(":");
    const label = (i > -1 ? l.slice(0, i) : l).trim();
    const cats = (i > -1 ? l.slice(i + 1) : l).split(",").map(norm).filter(Boolean);
    return { label, cats };
  }).filter((g) => g.label && g.cats.length);
}

export function isBreakSession(s, breakCats) {
  const f = (s?.sessionCustomFields || []).find((x) => norm(x?.name) === "break session?");
  if (f && (Array.isArray(f.value) ? f.value : [f.value]).some((v) => norm(v) === "yes")) return true;
  const c = norm(catName(s));
  if (c) return breakCats.includes(c);
  // No category (common): a session with no speakers and no description whose
  // title contains one of the break words ("Break", "Networking Reception",
  // "Arrivals & Registration") is a break too.
  if ((s?.speakers || []).length || String(s?.description || "").replace(/<[^>]*>/g, "").trim()) return false;
  const name = norm(s?.name);
  return breakCats.some((w) => w && new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(name));
}

// YYYY-MM-DD in the event timezone (Playbook §2).
const dayKey = (iso, tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export default class extends PageWidget {
  constructor(args) {
    super(args);
    if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, FeaturedSpeaker);
    this._filterIdx = 0;          // selected chip survives re-renders
    this._locSel = new Set();     // selected locations (names)
    this._tagSel = new Set();     // selected tags
  }

  get tag() { return "agenda"; }
  get build() { return BUILD; }
  merge(cfg) { return mergeAgendaConfig(cfg); }

  bannerDefaults({ lang, facts, sessions, eventTz }) {
    const n = countSessions(lang, sessions.length);
    const tz = tzName(sessions[0]?.startDateTime || facts.startIso, eventTz, "longGeneric") || facts.tzLong;
    const intro = !sessions.length ? "" : facts.venueName
      ? fixed(lang, "agendaIntro", { n, place: facts.venueName, tz })
      : fixed(lang, "agendaIntroNoPlace", { n, tz });
    return { title: "Program", intro };
  }

  sections(ctx) {
    // Sessions hidden from the agenda (custom field or the editor's list) are
    // dropped everywhere on this page: rows, counts, filters, bio pop-ups.
    ctx.allSessionsRaw = ctx.sessions;
    ctx.sessions = ctx.sessions.filter((s) => !isHiddenSession(s, ctx.cfg.program.hiddenSessionIds || []));
    return { program: () => this._program(ctx) };
  }

  // ---- model ----------------------------------------------------------------
  _model({ cfg, sessions, eventTz }) {
    const p = cfg.program;
    const breakCats = String(p.breakCategories || "").split(",").map(norm).filter(Boolean);
    const rows = [...sessions]
      .filter((s) => s?.startDateTime)
      .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime) || new Date(a.endDateTime) - new Date(b.endDateTime))
      .map((s) => ({
        s,
        isBreak: isBreakSession(s, breakCats),
        cat: catName(s),
        loc: String(s?.location?.name || "").trim(),
        tags: sessionField(s, p.tagsField || "Tags").slice(0, 5),
      }));
    const locations = [];
    const tags = [];
    rows.forEach((r) => {
      if (r.loc && !locations.includes(r.loc)) locations.push(r.loc);
      r.tags.forEach((t) => { if (!tags.includes(t)) tags.push(t); });
    });
    let groups = parseGroups(p.filterGroups);
    if (!groups.length) {
      const seen = [];
      rows.forEach((r) => { if (!r.isBreak && r.cat && !seen.includes(r.cat)) seen.push(r.cat); });
      groups = seen.map((c) => ({ label: c, cats: [norm(c)] }));
    }
    // Only chips that match at least one session.
    groups = groups.filter((g) => rows.some((r) => g.cats.includes(norm(r.cat))));
    rows.forEach((r) => { r.groups = groups.map((g, i) => (g.cats.includes(norm(r.cat)) ? i : -1)).filter((i) => i > -1); });
    const days = [];
    rows.forEach((r) => {
      const k = dayKey(r.s.startDateTime, eventTz);
      let d = days.find((x) => x.key === k);
      if (!d) { d = { key: k, rows: [] }; days.push(d); }
      d.rows.push(r);
    });
    return { days, groups, locations, tags };
  }

  // ---- render -----------------------------------------------------------------
  _program(ctx) {
    const { cfg, lang, P, eventTz, speakers } = ctx;
    const p = cfg.program;
    const { days, groups, locations, tags } = this._model(ctx);
    ctx.model = { days, groups, locations, tags };
    if (!days.length) {
      return `<section class="pk-section pk-bleed pk-ground-white" aria-label="${esc(fixed(lang, "allSessions"))}"><div class="pk-inner"><p class="pk-empty">${esc(fixed(lang, "noSessions"))}</p></div></section>`;
    }
    if (this._filterIdx > groups.length) this._filterIdx = 0;
    const on = p.showFilters !== false;
    const catChips = on && groups.length > 1
      ? `<div class="ag-chips" role="group" aria-label="${esc(fixed(lang, "filterSessions"))}">
          ${[P("program", "allLabel", p.allLabel) || fixed(lang, "allSessions"), ...groups.map((g, i) => P("program", `group.${i}`, g.label))]
            .map((label, i) => `<button type="button" class="ag-chip" data-filter="${i}" aria-pressed="${i === this._filterIdx}">${esc(label)}</button>`).join("")}
        </div>`
      : "";
    // Keep only selections that still exist (config / data may have changed).
    this._locSel = new Set([...this._locSel].filter((x) => locations.includes(x)));
    this._tagSel = new Set([...this._tagSel].filter((x) => tags.includes(x)));
    const drop = (key, label, values, sel) => `
        <div class="ag-drop" data-drop="${key}">
          <button type="button" class="ag-chip ag-drop-btn" aria-expanded="false" aria-haspopup="true" data-label="${esc(label)}">${esc(label)}${sel.size ? ` · ${sel.size}` : ""}<span class="ag-caret" aria-hidden="true"></span></button>
          <div class="ag-menu" hidden role="group" aria-label="${esc(label)}">
            ${values.map((v) => `<label class="ag-opt"><input type="checkbox" value="${esc(v)}"${sel.has(v) ? " checked" : ""}><span>${esc(v)}</span></label>`).join("")}
          </div>
        </div>`;
    const drops = [
      on && p.showLocation !== false && p.locationFilter !== false && locations.length > 1 ? drop("loc", P("program", "locationLabel", p.locationLabel) || fixed(lang, "filterLocation"), locations, this._locSel) : "",
      on && p.showTags !== false && p.tagFilter !== false && tags.length > 1 ? drop("tag", P("program", "tagsLabel", p.tagsLabel) || fixed(lang, "filterTopics"), tags, this._tagSel) : "",
    ].join("");
    const chips = catChips || drops
      ? `<div class="ag-filters">${catChips}${drops ? `<div class="ag-drops">${drops}</div>` : ""}</div>`
      : "";
    const dayHead = (d) => {
      const first = d.rows[0].s;
      const last = d.rows.reduce((m, r) => (new Date(r.s.endDateTime || r.s.startDateTime) > new Date(m) ? (r.s.endDateTime || r.s.startDateTime) : m), first.endDateTime || first.startDateTime);
      const range = `${fmtTimeRange(first.startDateTime, last, eventTz)} ${tzName(first.startDateTime, eventTz, "shortGeneric")}`.trim();
      return `<div class="ag-day-text">
          <h2 class="ag-day-h">${esc(fmtDate(first.startDateTime, eventTz, lang, { weekday: "long", month: "long", day: "numeric" }))}</h2>
          <p class="ag-day-meta" data-day-meta>${esc(countSessions(lang, d.rows.length))} · ${esc(range)}</p>
        </div>`;
    };
    const single = days.length === 1;
    const showDay = p.showDayHeading !== false;
    const top = single
      ? (showDay || chips ? `<div class="ag-top">${showDay ? dayHead(days[0]) : "<div></div>"}${chips}</div>` : "")
      : (chips ? `<div class="ag-top ag-top--chips">${chips}</div>` : "");
    const body = days.map((d) => `
        <div class="ag-day" data-day>
          ${!single && showDay ? `<div class="ag-top ag-top--day">${dayHead(d)}</div>` : ""}
          <div class="ag-list">${d.rows.map((r) => (r.isBreak ? this._breakRow(r, ctx) : this._sessionRow(r, ctx))).join("")}</div>
        </div>`).join("");
    return `
    <section class="pk-section pk-bleed pk-ground-white ag" aria-label="${esc(P("banner", "title", cfg.banner.title) || "Program")}">
      <div class="pk-inner">
        ${top}
        ${body}
        <p class="pk-empty ag-nomatch" data-nomatch hidden>${esc(fixed(lang, "noMatch"))}</p>
      </div>
    </section>`;
  }

  _rowData({ groups, loc, tags }) {
    return `data-groups="${groups.join(" ")}" data-loc="${esc(loc)}" data-tags="${esc(JSON.stringify(tags))}"`;
  }

  _breakRow(r, { eventTz }) {
    const { s } = r;
    return `<div class="ag-break" ${this._rowData(r)} data-break>
        <span class="ag-break-t">${esc(fmtTime(s.startDateTime, eventTz))}${s.endDateTime ? ` – ${esc(fmtTime(s.endDateTime, eventTz))}` : ""}</span>
        <span class="ag-break-l">${esc(s.name || "")}</span>
      </div>`;
  }

  _sessionRow(r, { cfg, lang, speakers, eventTz, P }) {
    const { s, cat, loc, tags } = r;
    const p = cfg.program;
    const desc = p.showDescription !== false ? cleanRichText(s.description) : "";
    const clamp = Math.max(0, Math.min(12, Number(p.descriptionLines) || 0));
    const list = (s.speakers || [])
      .map((sp) => {
        const id = String(sp?.id || sp?.speakerId || "");
        return { id, ...(sp || {}), ...(speakers[id] || {}) };
      })
      .filter((sp) => sp.displayOnWebsite !== false && (sp.firstName || sp.lastName));
    const name = (sp) => [sp.firstName, sp.lastName].filter(Boolean).join(" ");
    const initials = (sp) => [sp.firstName, sp.lastName].filter(Boolean).map((x) => x.charAt(0)).join("").toUpperCase();
    const modCats = String(p.moderatorCategories || "").split(",").map(norm).filter(Boolean);
    const isMod = (sp) => modCats.includes(norm(sp?.category?.name || sp?.categoryName || ""));
    const modLabel = P("program", "moderatorLabel", p.moderatorLabel) || fixed(lang, "moderator");
    const chip = (sp) => {
      const img = p.showPhotos !== false
        ? `<span class="ag-av" aria-hidden="true" data-initials="${esc(initials(sp))}">${sp.profilePictureUri ? `<img src="${esc(sp.profilePictureUri)}" alt="" loading="lazy">` : `<span>${esc(initials(sp))}</span>`}</span>`
        : "";
      const inner = `${img}<span class="ag-spk-t">${isMod(sp) ? `<span class="ag-spk-eb">${esc(modLabel)}</span>` : ""}<span class="ag-spk-n">${esc(name(sp))}</span>${sp.title ? `<span class="ag-spk-r">${esc(sp.title)}</span>` : ""}${sp.company ? `<span class="ag-spk-c">${esc(sp.company)}</span>` : ""}</span>`;
      return p.speakerBios !== false && sp.id
        ? `<button type="button" class="ag-spk" data-spk="${esc(sp.id)}" aria-haspopup="dialog" aria-label="${esc(fixed(lang, "viewBio", { name: name(sp) }))}">${inner}</button>`
        : `<span class="ag-spk">${inner}</span>`;
    };
    // Panelists keep the session's speaker order; moderators follow them,
    // set off below a hairline (only when there are panelists above).
    const panel = list.filter((sp) => !isMod(sp));
    const mods = list.filter(isMod);
    const who = list.length
      ? `${panel.length ? `<div class="ag-spks">${panel.map(chip).join("")}</div>` : ""}${mods.length ? `<div class="ag-spks${panel.length ? " ag-mods" : ""}">${mods.map(chip).join("")}</div>` : ""}`
      : this._showTba(p, s) ? `<p class="ag-tba">${esc(fixed(lang, "tba"))}</p>` : "";
    const tz = tzName(s.startDateTime, eventTz, "shortGeneric");
    const showCat = p.showCategory !== false;
    const meta = [showCat && cat ? `<b>${esc(cat)}</b>` : "", p.showLocation !== false && loc ? `<span>${esc(loc)}</span>` : ""].filter(Boolean);
    const tagLine = p.showTags !== false && tags.length
      ? `<p class="ag-tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>`
      : "";
    return `<article class="ag-row" ${this._rowData(r)}>
        <div class="ag-when">
          <span class="ag-start">${esc(fmtTime(s.startDateTime, eventTz))}</span>
          ${s.endDateTime ? `<span class="ag-end">${esc(fixed(lang, "toTime", { t: `${fmtTime(s.endDateTime, eventTz)} ${tz}`.trim() }))}</span>` : ""}
        </div>
        <div class="ag-main">
          <h3 class="ag-title">${esc(s.name || "")}</h3>
          ${meta.length ? `<p class="ag-meta">${meta.join('<span class="ag-dot" aria-hidden="true"> · </span>')}</p>` : ""}
          ${desc ? `<div class="ag-desc-wrap"><div class="ag-desc${clamp ? " ag-desc--clamp" : ""}" style="--lines:${clamp || 99}">${desc}</div>${clamp ? `<button type="button" class="ag-more" data-more hidden aria-expanded="false">${esc(fixed(lang, "readMore"))}</button>` : ""}</div>` : ""}
          ${who}
          ${tagLine}
        </div>
      </article>`;
  }

  _showTba(p, s) {
    const mode = ["field", "all", "off"].includes(p.tbaMode) ? p.tbaMode : "field";
    if (mode === "off") return false;
    if (fieldIsYes(s, "Speakers TBA") || fieldIsYes(s, "Speakers to be announced")) return true;
    return mode === "all";
  }

  // ---- behaviour ----------------------------------------------------------------
  afterRender(root, ctx) {
    const { lang } = ctx;
    // "Read more" only where the clamp actually hides text.
    const checkClamp = () => root.querySelectorAll(".ag-desc--clamp").forEach((d) => {
      const btn = d.parentElement.querySelector("[data-more]");
      if (!btn || btn.getAttribute("aria-expanded") === "true") return;
      btn.hidden = d.scrollHeight <= d.clientHeight + 2;
    });
    requestAnimationFrame(checkClamp);
    // A photo that fails to load falls back to the speaker's initials.
    root.querySelectorAll(".ag-av img").forEach((img) => {
      img.addEventListener("error", () => {
        const box = img.parentElement;
        box.innerHTML = `<span>${esc(box.dataset.initials || "")}</span>`;
      }, { once: true });
    });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => checkClamp()) : null;
    ro?.observe(root);
    this._cleanups.push(() => ro?.disconnect());

    // Category chip AND location AND topics; any of the ticked values within one.
    const applyFilter = (idx = this._filterIdx) => {
      this._filterIdx = idx;
      root.querySelectorAll(".ag-chip[data-filter]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.filter) === idx)));
      const locs = this._locSel;
      const tgs = this._tagSel;
      root.querySelectorAll("[data-drop]").forEach((d) => {
        const n = (d.dataset.drop === "loc" ? locs : tgs).size;
        const b = d.querySelector(".ag-drop-btn");
        b.firstChild.textContent = `${b.dataset.label}${n ? ` · ${n}` : ""}`;
        b.classList.toggle("is-on", n > 0);
      });
      let shown = 0;
      root.querySelectorAll("[data-day]").forEach((day) => {
        let n = 0;
        day.querySelectorAll("[data-groups]").forEach((row) => {
          const g = row.dataset.groups.split(" ").filter(Boolean).map(Number);
          let rowTags = [];
          try { rowTags = JSON.parse(row.dataset.tags || "[]"); } catch (e) { /* noop */ }
          const on = (idx === 0 || g.includes(idx - 1))
            && (!locs.size || locs.has(row.dataset.loc))
            && (!tgs.size || rowTags.some((t) => tgs.has(t)));
          row.hidden = !on;
          if (on) n += 1;
        });
        day.hidden = n === 0;
        shown += n;
      });
      const none = root.querySelector("[data-nomatch]");
      if (none) none.hidden = shown > 0;
    };

    const closeMenus = (except) => root.querySelectorAll("[data-drop]").forEach((d) => {
      if (d === except) return;
      d.querySelector(".ag-menu").hidden = true;
      d.querySelector(".ag-drop-btn").setAttribute("aria-expanded", "false");
    });
    const onChange = (e) => {
      const box = e.target.closest?.(".ag-menu input");
      if (!box) return;
      const set = box.closest("[data-drop]").dataset.drop === "loc" ? this._locSel : this._tagSel;
      box.checked ? set.add(box.value) : set.delete(box.value);
      applyFilter();
    };
    root.addEventListener("change", onChange);
    this._cleanups.push(() => root.removeEventListener("change", onChange));
    const onDocClick = (e) => { if (!e.composedPath().some((n) => n?.dataset?.drop)) closeMenus(); };
    const onKey = (e) => { if (e.key === "Escape") closeMenus(); };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    this._cleanups.push(() => { document.removeEventListener("click", onDocClick); document.removeEventListener("keydown", onKey); });

    const onClick = (e) => {
      const dropBtn = e.target.closest?.(".ag-drop-btn");
      if (dropBtn) {
        const d = dropBtn.closest("[data-drop]");
        const menu = d.querySelector(".ag-menu");
        closeMenus(d);
        menu.hidden = !menu.hidden;
        dropBtn.setAttribute("aria-expanded", String(!menu.hidden));
        return;
      }
      const chip = e.target.closest?.(".ag-chip[data-filter]");
      if (chip) { applyFilter(Number(chip.dataset.filter) || 0); return; }
      const more = e.target.closest?.("[data-more]");
      if (more) {
        const open = more.getAttribute("aria-expanded") !== "true";
        more.setAttribute("aria-expanded", String(open));
        more.textContent = fixed(lang, open ? "readLess" : "readMore");
        more.parentElement.querySelector(".ag-desc")?.classList.toggle("is-open", open);
        return;
      }
      const spk = e.target.closest?.("[data-spk]");
      if (spk) this._openBio(root, ctx, spk.dataset.spk, spk);
    };
    root.addEventListener("click", onClick);
    this._cleanups.push(() => root.removeEventListener("click", onClick));
    if (this._filterIdx || this._locSel.size || this._tagSel.size) applyFilter();
  }

  // One hidden FeaturedSpeaker card per speaker, created on first click, whose
  // pop-up is reused. The card itself is clipped away (its modal is
  // position:fixed, so it escapes the clip) and removed from the tab order.
  _openBio(root, ctx, id, trigger) {
    const { cfg, sessions, speakers, getSpeakers, eventTz, P } = ctx;
    let host = root.querySelector(".ag-modal-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "ag-modal-host";
      root.append(host);
    }
    let card = host.querySelector(`[data-for="${CSS.escape(id)}"]`);
    if (!card) {
      const sp = speakers[id] || (sessions.flatMap((s) => s.speakers || []).find((x) => String(x?.id) === id)) || { id };
      card = document.createElement(CARD_TAG);
      card.dataset.for = id;
      card.speaker = sp;
      card.theme = this.theme || {};
      card.config = {
        colors: {
          ink: TOKENS.ink, muted: TOKENS.muted, faint: TOKENS.faint, hair: TOKENS.hair, placeholder: TOKENS.placeholder,
          accent: TOKENS.amberInk, tagBg: TOKENS.tagBg, tagInk: TOKENS.tagInk, modalBar: TOKENS.amberOnDark,
          mainAccent: TOKENS.amberInk, accentRule: TOKENS.amberOnDark, bioInk: TOKENS.body, focus: TOKENS.focus,
        },
        typography: speakerTypography(),
        tileSize: 120,
        allSessions: sessions,
        getSpeakers,
        eventTz,
        modalEyebrowText: P("program", "modalEyebrowText", cfg.program.modalEyebrowText) || fixed(ctx.lang, "speakerOne"),
        showSessions: cfg.program.showSessions !== false,
        sessionsHeaderText: P("program", "sessionsHeaderText", cfg.program.sessionsHeaderText) || fixed(ctx.lang, "sessionHdrN"),
        sessionHeaderText: P("program", "sessionHeaderText", cfg.program.sessionHeaderText) || fixed(ctx.lang, "sessionHdr1"),
        moderatorLabel: fixed(ctx.lang, "moderator"),
      };
      host.append(card);
      card.shadowRoot?.querySelector(".card")?.setAttribute("tabindex", "-1");
    }
    card.openModal();
    // Return focus to the chip the visitor clicked, not the hidden card.
    const onClose = () => { trigger?.focus?.(); window.removeEventListener("cvent-speaker-modal-close", onClose); };
    window.addEventListener("cvent-speaker-modal-close", onClose);
  }

  // ---- CSS --------------------------------------------------------------------
  pageCss() {
    const t = TOKENS;
    return `
    .ag-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px 40px; flex-wrap: wrap; padding-bottom: 24px; }
    .ag-top--chips { justify-content: flex-start; }
    .ag-top--day { padding-top: 48px; }
    .ag-day:first-of-type .ag-top--day { padding-top: 8px; }
    .ag-day-h { font-size: 28px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; }
    .ag-day-meta { margin-top: 6px; font-size: 15px; color: ${t.body}; font-variant-numeric: tabular-nums; }
    .ag-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .ag-chip { font-family: inherit; min-height: 38px; padding: 0 16px; border-radius: 100px; border: 1px solid ${t.hair}; background: #fff; color: ${t.ink};
      font-size: 14px; font-weight: 600; cursor: pointer; transition: border-color .15s ease, background-color .15s ease, color .15s ease; }
    .ag-chip:hover { border-color: ${t.ink}; }
    .ag-chip[aria-pressed="true"] { background: ${t.ink}; border-color: ${t.ink}; color: #fff; }
    .ag-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .ag-drops { display: flex; flex-wrap: wrap; gap: 8px; }
    .ag-chips + .ag-drops { padding-left: 14px; border-left: 1px solid ${t.hair}; }
    .ag-drop { position: relative; }
    .ag-drop-btn { display: inline-flex; align-items: center; gap: 8px; }
    .ag-drop-btn.is-on { border-color: ${t.ink}; }
    .ag-caret { width: 7px; height: 7px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: translateY(-2px) rotate(45deg); }
    .ag-drop-btn[aria-expanded="true"] .ag-caret { transform: translateY(2px) rotate(-135deg); }
    .ag-menu { position: absolute; top: calc(100% + 6px); right: 0; z-index: 5; min-width: 220px; max-width: min(320px, 86vw); max-height: 320px; overflow: auto;
      background: #fff; border: 1px solid ${t.hair}; box-shadow: 0 14px 32px rgba(11,11,12,.14); padding: 8px 0; }
    .ag-opt { display: flex; align-items: flex-start; gap: 10px; padding: 8px 16px; font-size: 15px; line-height: 1.35; cursor: pointer; }
    .ag-opt:hover { background: ${t.tint}; }
    .ag-opt input { margin: 2px 0 0; accent-color: ${t.ink}; width: 16px; height: 16px; flex-shrink: 0; }
    .ag-meta { margin-top: -4px; font-size: 15px; line-height: 1.5; color: ${t.muted}; }
    .ag-meta b { color: ${t.ink}; font-weight: 600; }
    .ag-dot { color: ${t.faint}; }
    .ag-tags { font-size: 14.5px; line-height: 1.6; font-weight: 600; color: ${t.amberInk}; }
    .ag-tags span + span::before { content: " · "; color: ${t.faint}; font-weight: 400; }

    .ag-list { border-bottom: 1px solid ${t.hair}; }
    .ag-row, .ag-break { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 32px; border-top: 1px solid ${t.hair}; }
    .ag-row { padding: 32px 24px; }
    .ag-break { padding: 18px 24px; background: ${t.tint}; align-items: center; }
    .ag-break-t { font-size: 15px; font-weight: 600; color: ${t.muted}; font-variant-numeric: tabular-nums; }
    .ag-break-l { font-size: 17px; font-weight: 600; color: ${t.body}; }
    [hidden] { display: none !important; }

    .ag-when { display: flex; flex-direction: column; gap: 2px; font-variant-numeric: tabular-nums; }
    .ag-start { font-size: 18px; font-weight: 700; }
    .ag-end { font-size: 15px; color: ${t.muted}; }
    .ag-main { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; min-width: 0; }
    .ag-title { font-size: 23px; line-height: 1.25; font-weight: 700; letter-spacing: -0.01em; }
    .ag-desc-wrap { max-width: 74ch; }
    .ag-desc { font-size: 16px; line-height: 1.6; color: ${t.body}; }
    .ag-desc p + p, .ag-desc ul, .ag-desc ol { margin-top: 10px; }
    .ag-desc ul, .ag-desc ol { padding-left: 20px; }
    .ag-desc a { color: ${t.amberInk}; font-weight: 600; }
    .ag-desc--clamp:not(.is-open) { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--lines, 2); line-clamp: var(--lines, 2); overflow: hidden; }
    .ag-desc--clamp:not(.is-open) > * { display: inline; }
    .ag-desc--clamp:not(.is-open) > * + *::before { content: " "; }
    .ag-more { font-family: inherit; margin-top: 6px; padding: 0; border: 0; background: none; cursor: pointer; font-size: 15px; font-weight: 700; color: ${t.amberInk}; }
    .ag-more:hover { text-decoration: underline; }

    .ag-spks { display: flex; flex-wrap: wrap; gap: 20px 32px; margin-top: 4px; }
    .ag-spk { display: flex; gap: 12px; align-items: flex-start; max-width: 300px; text-align: left; color: ${t.ink};
      font-family: inherit; background: none; border: 0; padding: 0; margin: 0; }
    button.ag-spk { cursor: pointer; }
    button.ag-spk:hover .ag-spk-n { color: ${t.amberInk}; }
    .ag-av { width: 52px; height: 52px; flex-shrink: 0; background: ${t.placeholder}; overflow: hidden; display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: ${t.faint}; }
    .ag-av img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ag-spk-t { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .ag-spk-n { font-size: 16px; font-weight: 700; line-height: 1.3; transition: color .15s ease; }
    .ag-spk-r { font-size: 14px; line-height: 1.4; color: ${t.body}; }
    .ag-spk-c { font-size: 14px; font-weight: 600; line-height: 1.4; }
    .ag-spk-eb { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${t.amberInk}; margin-bottom: 1px; }
    .ag-mods { align-self: stretch; margin-top: 4px; padding-top: 18px; border-top: 1px solid ${t.hair}; }
    .ag-tba { font-size: 15px; font-style: italic; color: ${t.faint}; }
    .ag-nomatch { padding: 32px 0; }
    .ag-modal-host { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: none; left: 0; top: 0; }

    @media (max-width: 1024px) {
      .ag-row, .ag-break { grid-template-columns: 130px minmax(0, 1fr); gap: 24px; }
      .ag-row { padding: 28px 16px; }
      .ag-break { padding: 16px; }
    }
    @media (max-width: 600px) {
      .ag-top { display: block; }
      .ag-top .ag-chips { margin-top: 18px; }
      .ag-day-h { font-size: 24px; }
      .ag-filters { display: block; }
      .ag-chips { flex-wrap: nowrap; overflow-x: auto; margin: 0 -20px; padding: 0 20px 4px; scrollbar-width: none; }
      .ag-chips + .ag-drops { padding-left: 0; border-left: 0; margin-top: 10px; }
      .ag-drop:first-child .ag-menu { left: 0; right: auto; }
      .ag-chips::-webkit-scrollbar { display: none; }
      .ag-chip { flex-shrink: 0; }
      .ag-row, .ag-break { grid-template-columns: minmax(0, 1fr); gap: 10px; }
      .ag-row { padding: 24px 0; }
      .ag-break { padding: 14px 16px; margin: 0 -20px; padding-left: 20px; padding-right: 20px; }
      .ag-when { flex-direction: row; align-items: baseline; gap: 6px; }
      .ag-start { font-size: 16px; }
      .ag-end { font-size: 14px; }
      .ag-title { font-size: 20px; }
      .ag-desc { font-size: 15.5px; }
      .ag-spks { flex-direction: column; gap: 16px; }
      .ag-spk { max-width: none; }
    }
    `;
  }
}
