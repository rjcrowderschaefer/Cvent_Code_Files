// widget.js — Venue PAGE widget (Bloomberg Live event sites).
//
// Renders the whole Venue page body:
//   dark banner · location (address, date, directions, calendar, photo) ·
//   getting here (lists + map) · accessibility · "Request to attend" band
// Venue name, address, date and start time come from the Cvent event
// (getEventInfo) unless the planner types an override. Getting-here lists and
// accessibility notes are planner copy (the editor can load the Bloomberg HQ
// set in one click).
// Shared building blocks: page-kit.js. NOTE: include the file extension in imports.
import {
  PageWidget, PAGE_BASE_DEFAULTS, mergePageConfig, TOKENS, esc, fixed, eyebrow, safeUrl, isExternal,
  lines, paragraphs, button, mapsDirectionsUrl, mapsEmbedUrl, downloadIcs,
} from "./page-kit.js";

export const BUILD = "venue-2026-09-26c";

export const SECTION_LABELS = {
  banner: "Page banner",
  location: "Location",
  gettingHere: "Getting here",
  accessibility: "Accessibility",
  cta: "Request to attend band",
};

const group = () => ({ title: "", items: "" });
const note = () => ({ title: "", body: "" });

export const VENUE_DEFAULTS = {
  ...PAGE_BASE_DEFAULTS,
  order: ["banner", "location", "gettingHere", "accessibility", "cta"],
  location: {
    show: true,
    eyebrow: "Location",
    heading: "",           // blank = the Cvent event location name
    address: "",           // blank = the Cvent event address (one line per line)
    showDate: true,
    dateLine: "",          // blank = event date
    dateDetail: "",        // blank = "Registration opens at <start time> <zone>"
    directionsLabel: "Get directions",
    directionsUrl: "",     // blank = Google Maps directions to the address
    showCalendar: true,
    calendarLabel: "Add to calendar",
    imageUrl: "",
    imageAlt: "",
    imageFocalX: 50,
    imageFocalY: 50,
  },
  gettingHere: {
    show: true,
    eyebrow: "Getting here",
    heading: "",
    groups: [group(), group(), group(), group()],
    map: "auto",           // "auto" (Google map of the address) | "embed" | "image" | "none"
    mapEmbedUrl: "",
    mapImageUrl: "",
    mapAlt: "",
  },
  accessibility: {
    show: true,
    eyebrow: "Accessibility",
    heading: "",
    items: [note(), note(), note(), note()],
  },
};

export function mergeVenueConfig(incoming = {}) {
  return mergePageConfig(VENUE_DEFAULTS, incoming, { lists: { "gettingHere.groups": 4, "accessibility.items": 4 } });
}

// Starter copy for Bloomberg HQ, 731 Lexington Avenue (the design artboard).
export const BLOOMBERG_HQ = {
  gettingHere: {
    heading: "Four subway stations within an eight-minute walk",
    groups: [
      { title: "Subway", items: "Lexington Ave / 59th St | 1 min · 4, 5, 6, N, R, W\nLexington Ave / 63rd St | 4 min · F, Q\n5th Ave / 53rd St | 8 min · E, M\n51st St / Lexington Ave | 8 min · 6, E" },
      { title: "Airports", items: "LaGuardia (LGA) | 9 miles / 14 km\nJohn F. Kennedy (JFK) | 17 miles / 27 km\nNewark Liberty (EWR) | 16 miles / 26 km" },
      { title: "Parking", items: "122 East 60th Street | 2 min walk\n150 East 58th Street | 2 min walk\n206 East 59th Street | 3 min walk\n135 East 57th Street | 3 min walk" },
      { title: "Bus", items: "Local MTA bus routes M101, M102, M103, M57 and M31 stop within one to two blocks of the entrance. For up-to-date service, plan your route with the MTA Trip Planner or Citymapper." },
    ],
  },
  accessibility: {
    heading: "An inclusive experience for every attendee",
    items: [
      { title: "Wheelchair access", body: "The event venue is fully wheelchair accessible, including entrances, seating areas and restrooms." },
      { title: "Closed captioning", body: "Live closed captioning will be available for all sessions." },
      { title: "Additional support", body: "If you require further accommodations, please contact us in advance so we can best support your needs." },
      { title: "", body: "" },
    ],
  },
};

export default class extends PageWidget {
  get tag() { return "venue"; }
  get build() { return BUILD; }
  merge(cfg) { return mergeVenueConfig(cfg); }
  needs() { return { sessions: false, speakers: false }; }

  bannerDefaults({ lang, facts }) {
    return { title: "Venue", intro: "" };
  }

  sections(ctx) {
    ctx.addressLines = this._addressLines(ctx);
    return {
      location: () => this._location(ctx),
      gettingHere: () => this._gettingHere(ctx),
      accessibility: () => this._accessibility(ctx),
    };
  }

  _addressLines({ cfg, facts, P }) {
    const own = lines(P("location", "address", cfg.location.address));
    if (own.length) return own;
    return [facts.address1, facts.address2, facts.cityLine].filter(Boolean);
  }

  _mapQuery({ facts, addressLines }) {
    return [facts.venueName, ...addressLines].filter(Boolean).join(", ");
  }

  // ---- LOCATION --------------------------------------------------------------
  _location(ctx) {
    const { cfg, lang, facts, P, addressLines } = ctx;
    const l = cfg.location;
    const heading = P("location", "heading", l.heading) || facts.venueName;
    const date = P("location", "dateLine", l.dateLine) || facts.dateLong;
    const detail = P("location", "dateDetail", l.dateDetail) || (facts.startTime ? fixed(lang, "regOpens", { t: facts.startTime, tz: facts.tzLong }) : "");
    const dir = safeUrl(l.directionsUrl, "") || mapsDirectionsUrl(this._mapQuery(ctx));
    const img = safeUrl(l.imageUrl, "");
    const pct = (n) => Math.max(0, Math.min(100, Number.isFinite(Number(n)) ? Number(n) : 50));
    const btns = [
      dir ? button({ label: P("location", "directionsLabel", l.directionsLabel), href: dir, variant: "primary", ground: "light", lang }) : "",
      l.showCalendar !== false && facts.startIso
        ? `<button type="button" class="pk-btn pk-btn--secondary pk-btn--on-light" data-ics>${esc(P("location", "calendarLabel", l.calendarLabel) || fixed(lang, "addToCalendar"))}</button>`
        : "",
    ].filter(Boolean).join("");
    return `
    <section class="pk-section pk-bleed pk-ground-white" aria-label="${esc(heading || l.eyebrow)}">
      <div class="pk-inner">
        <div class="vn-loc ${img ? "" : "vn-loc--noimg"}">
          <div class="vn-loc-text">
            <div>${eyebrow(P("location", "eyebrow", l.eyebrow))}${heading ? `<h2 class="pk-h2">${esc(heading)}</h2>` : ""}</div>
            ${addressLines.length ? `<address class="vn-addr">${addressLines.map(esc).join("<br>")}</address>` : ""}
            ${l.showDate !== false && (date || detail) ? `<div class="vn-date">${date ? `<span class="vn-date-d">${esc(date)}</span>` : ""}${detail ? `<span class="vn-date-t">${esc(detail)}</span>` : ""}</div>` : ""}
            ${btns ? `<div class="vn-btns">${btns}</div>` : ""}
          </div>
          ${img ? `<div class="vn-photo"><img src="${esc(img)}" alt="${esc(P("location", "imageAlt", l.imageAlt) || heading)}" style="object-position:${pct(l.imageFocalX)}% ${pct(l.imageFocalY)}%" loading="lazy"></div>` : ""}
        </div>
      </div>
    </section>`;
  }

  // ---- GETTING HERE ----------------------------------------------------------
  _gettingHere(ctx) {
    const { cfg, lang, facts, P } = ctx;
    const g = cfg.gettingHere;
    const groups = g.groups
      .map((it, i) => ({ title: P("gettingHere", `groups.${i}.title`, it.title), items: lines(P("gettingHere", `groups.${i}.items`, it.items)) }))
      .filter((it) => it.title || it.items.length);
    const heading = P("gettingHere", "heading", g.heading);
    const q = this._mapQuery(ctx);
    let map = "";
    const mode = ["auto", "embed", "image", "none"].includes(g.map) ? g.map : "auto";
    const title = fixed(lang, "mapTitle", { place: facts.venueName || q });
    const embed = mode === "embed" ? safeUrl(g.mapEmbedUrl, "") : mode === "auto" ? mapsEmbedUrl(q) : "";
    if (embed && /^https:\/\//i.test(embed)) {
      map = `<div class="vn-map"><iframe src="${esc(embed)}" title="${esc(title)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`;
    } else if (mode === "image" && safeUrl(g.mapImageUrl, "")) {
      map = `<div class="vn-map"><img src="${esc(safeUrl(g.mapImageUrl, ""))}" alt="${esc(P("gettingHere", "mapAlt", g.mapAlt) || title)}" loading="lazy"></div>`;
    }
    const body = groups.length
      ? `<div class="vn-groups">${groups.map((gr) => `
          <div class="vn-group">
            ${eyebrow(gr.title, "vn-group-h")}
            ${this._groupBody(gr.items)}
          </div>`).join("")}</div>`
      : map ? "" : `<div class="pk-placeholder"><strong>Getting here</strong>Add transit, airport and parking details in the widget settings (or load the Bloomberg HQ set), or switch this section off.</div>`;
    return `
    <section class="pk-section pk-bleed pk-ground-white" aria-label="${esc(heading || g.eyebrow)}">
      <div class="pk-inner">
        <div class="pk-head-text${heading ? "" : " vn-head--bare"}">${eyebrow(P("gettingHere", "eyebrow", g.eyebrow))}${heading ? `<h2 class="pk-h2">${esc(heading)}</h2>` : ""}</div>
        ${body}
        ${map}
      </div>
    </section>`;
  }

  // "Name | detail" lines = a two-column list; anything else = paragraph text.
  _groupBody(items) {
    const rows = items.filter((l) => l.includes("|"));
    if (!rows.length) return `<div class="vn-group-p">${paragraphs(items.join("\n\n"))}</div>`;
    return `<ul class="vn-list">${items.map((l) => {
      const i = l.indexOf("|");
      if (i < 0) return `<li class="vn-li vn-li--note">${esc(l)}</li>`;
      return `<li class="vn-li"><span class="vn-li-n">${esc(l.slice(0, i).trim())}</span><span class="vn-li-d">${esc(l.slice(i + 1).trim())}</span></li>`;
    }).join("")}</ul>`;
  }

  // ---- ACCESSIBILITY ---------------------------------------------------------
  _accessibility({ cfg, P }) {
    const a = cfg.accessibility;
    const items = a.items
      .map((it, i) => ({ title: P("accessibility", `items.${i}.title`, it.title), body: P("accessibility", `items.${i}.body`, it.body) }))
      .filter((it) => it.title || it.body);
    const heading = P("accessibility", "heading", a.heading);
    const list = items.length
      ? `<div class="vn-notes">${items.map((it) => `<div class="vn-note">${it.title ? `<h3 class="vn-note-h">${esc(it.title)}</h3>` : ""}${it.body ? `<p class="vn-note-p">${esc(it.body)}</p>` : ""}</div>`).join("")}</div>`
      : `<div class="pk-placeholder"><strong>Accessibility</strong>Add accessibility notes in the widget settings, or switch this section off.</div>`;
    return `
    <section class="pk-section pk-bleed pk-ground-tint" aria-label="${esc(heading || a.eyebrow)}">
      <div class="pk-inner">
        <div class="vn-split">
          <div>${eyebrow(P("accessibility", "eyebrow", a.eyebrow))}${heading ? `<h2 class="pk-h2">${esc(heading)}</h2>` : ""}</div>
          ${list}
        </div>
      </div>
    </section>`;
  }

  afterRender(root, ctx) {
    const btn = root.querySelector("[data-ics]");
    if (!btn) return;
    const { facts } = ctx;
    const onClick = () => downloadIcs({
      title: facts.title,
      start: facts.startIso,
      end: facts.endIso,
      location: this._mapQuery(ctx),
      url: window.location.href.split("#")[0],
    });
    btn.addEventListener("click", onClick);
    this._cleanups.push(() => btn.removeEventListener("click", onClick));
  }

  pageCss() {
    const t = TOKENS;
    return `
    .vn-loc { display: grid; grid-template-columns: .87fr 1.13fr; column-gap: clamp(40px, 7vw, 96px); align-items: start; }
    .vn-loc--noimg { grid-template-columns: minmax(0, 1fr); max-width: 720px; }
    .vn-loc-text { display: flex; flex-direction: column; gap: 24px; }
    .vn-addr { font-style: normal; font-size: 19px; line-height: 1.5; color: ${t.ink}; }
    .vn-date { display: flex; flex-direction: column; gap: 4px; padding: 20px 0; border-top: 1px solid ${t.hair}; border-bottom: 1px solid ${t.hair}; }
    .vn-date-d { font-size: 17px; font-weight: 700; }
    .vn-date-t { font-size: 16px; color: ${t.body}; }
    .vn-btns { display: flex; flex-wrap: wrap; gap: 12px; }
    .vn-photo { height: 420px; background: ${t.placeholder}; overflow: hidden; }
    .vn-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .vn-groups { margin-top: 48px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 56px 64px; }
    .vn-group .vn-group-h { color: ${t.muted}; }
    .vn-list { list-style: none; margin: 0; padding: 0; border-bottom: 1px solid ${t.hair}; }
    .vn-li { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid ${t.hair}; font-size: 16px; }
    .vn-li-n { font-weight: 700; }
    .vn-li-d { color: ${t.body}; text-align: right; }
    .vn-li--note { color: ${t.body}; }
    .vn-group-p { padding-top: 14px; border-top: 1px solid ${t.hair}; font-size: 16px; line-height: 1.6; color: ${t.body}; }
    .vn-group-p p + p { margin-top: 10px; }
    .pk-head-text + .vn-map { margin-top: 32px; }
    /* Eyebrow with no heading: content follows at the standard eyebrow gap
       (the eyebrow's own 14px), like every other eyebrow/content block. */
    .vn-head--bare + .vn-groups, .vn-head--bare + .vn-map, .vn-head--bare + .pk-placeholder { margin-top: 0; }
    .vn-map { margin-top: 56px; height: 360px; background: ${t.placeholder}; overflow: hidden; }
    .vn-map iframe { width: 100%; height: 100%; border: 0; display: block; }
    .vn-map img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .vn-split { display: grid; grid-template-columns: .87fr 1.13fr; column-gap: clamp(40px, 7vw, 96px); align-items: start; }
    .vn-notes { border-bottom: 1px solid ${t.hair}; }
    .vn-note { padding: 22px 0; border-top: 1px solid ${t.hair}; display: flex; flex-direction: column; gap: 6px; }
    .vn-note-h { font-size: 18px; font-weight: 700; }
    .vn-note-p { font-size: 16px; line-height: 1.6; color: ${t.body}; }

    @media (max-width: 1024px) {
      .vn-loc, .vn-split { grid-template-columns: minmax(0, 1fr); row-gap: 40px; }
      .vn-photo { height: 360px; }
      .vn-groups { gap: 40px 40px; }
    }
    @media (max-width: 600px) {
      .vn-addr { font-size: 17px; }
      .vn-btns .pk-btn { flex: 1 1 100%; }
      .vn-photo { height: 240px; }
      .vn-groups { grid-template-columns: minmax(0, 1fr); margin-top: 32px; gap: 32px; }
      .vn-li { font-size: 15px; flex-direction: column; gap: 2px; }
      .vn-li-d { text-align: left; }
      .vn-map { margin-top: 36px; height: 280px; }
    }
    `;
  }
}
