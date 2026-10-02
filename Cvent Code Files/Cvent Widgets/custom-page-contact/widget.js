// widget.js — Contact PAGE widget (Bloomberg Live event sites).
//
// Renders the whole Contact page body:
//   dark banner · contact cards · FAQ · "Request to attend" band
// Everything here is planner copy (Cvent has no contact / FAQ data in the SDK);
// the banner eyebrow and closing band still read the event (getEventInfo).
// Shared building blocks: page-kit.js. NOTE: include the file extension in imports.
import { PageWidget, PAGE_BASE_DEFAULTS, mergePageConfig, TOKENS, esc, eyebrow, safeUrl, button, paragraphs, findPlannerContact } from "./page-kit.js";

export const BUILD = "contact-2026-10-02c";

export const SECTION_LABELS = {
  banner: "Page banner",
  cards: "Contact cards",
  faq: "Questions (FAQ)",
  cta: "Request to attend band",
};

const card = (o = {}) => ({ eyebrow: "", heading: "", body: "", email: "", phone: "", buttonLabel: "", buttonUrl: "", style: "primary", ...o });
const qa = (q = "") => ({ q, a: "" });

export const CONTACT_DEFAULTS = {
  ...PAGE_BASE_DEFAULTS,
  order: ["banner", "cards", "faq", "cta"],
  // Email links and email buttons open Cvent's Contact Planner pop-up (the
  // message goes to the Event Planner email in the event details) when that
  // native widget is on the page; otherwise they open an email as before.
  plannerContact: true,
  plannerContactSelector: "",
  cards: {
    show: true,
    items: [
      card({ eyebrow: "Event team", heading: "General inquiries", body: "Questions about the program, registration, travel or accessibility.", buttonLabel: "Contact the event team" }),
      card({ eyebrow: "Bloomberg", heading: "Talk to an account manager", body: "Speak directly with a Bloomberg account manager, or arrange a personalized demo.", buttonLabel: "Schedule a conversation", style: "secondary" }),
      card(),
    ],
  },
  faq: {
    show: true,
    eyebrow: "Questions",
    heading: "Before you arrive",
    firstOpen: true,
    items: [
      qa("Is there a cost to attend?"), qa("Can I bring a colleague?"), qa("What is the dress code?"), qa("Will sessions be recorded?"),
      qa(), qa(), qa(), qa(),
    ],
  },
};

export function mergeContactConfig(incoming = {}) {
  return mergePageConfig(CONTACT_DEFAULTS, incoming, { lists: { "cards.items": 3, "faq.items": 8 } });
}

export default class extends PageWidget {
  get tag() { return "contact"; }
  get build() { return BUILD; }
  merge(cfg) { return mergeContactConfig(cfg); }
  needs() { return { sessions: false, speakers: false }; }

  bannerDefaults() {
    return { title: "Contact", intro: "" };
  }

  // A button that only opens the Contact Planner pop-up (no page link, no
  // email) does nothing when Cvent's Contact Planner widget is missing. Look
  // for the widget for a few seconds (Cvent may draw it after us); if it never
  // turns up, hide the button rather than leave a dead one on the page.
  afterRender(root, { cfg }) {
    const dead = [...root.querySelectorAll('.ct-btn a[data-planner-contact][href="#"]')];
    if (!dead.length) return;
    let tries = 0;
    const check = () => {
      if (findPlannerContact(cfg.plannerContactSelector)) { dead.forEach((a) => { a.closest(".ct-btn").hidden = false; }); return; }
      if (++tries < 8) { timer = setTimeout(check, 500); return; }
      dead.forEach((a) => { a.closest(".ct-btn").hidden = true; });
      console.warn("[contact] Cvent Contact Planner widget not found on this page: add it in Site Designer, or give the card an email address or button URL. The button is hidden until then.");
    };
    let timer = setTimeout(check, 0);
    this._cleanups.push(() => clearTimeout(timer));
  }

  sections(ctx) {
    return { cards: () => this._cards(ctx), faq: () => this._faq(ctx) };
  }

  _cards({ cfg, lang, P }) {
    const pc = cfg.plannerContact !== false;
    const items = cfg.cards.items
      .map((it, i) => {
        const T = (k) => P("cards", `items.${i}.${k}`, it[k]);
        return { ...it, eyebrow: T("eyebrow"), heading: T("heading"), body: T("body"), buttonLabel: T("buttonLabel") };
      })
      .filter((it) => it.heading);
    if (!items.length) return "";
    return `
    <section class="pk-section pk-bleed pk-ground-tint" aria-label="${esc(items[0].heading)}">
      <div class="pk-inner">
        <div class="ct-cards" style="--cols:${items.length}">
          ${items.map((it) => {
            const email = String(it.email || "").trim();
            const phone = String(it.phone || "").trim();
            const own = safeUrl(it.buttonUrl, "");
            const href = own || (email ? `mailto:${email}` : "");
            // The button goes to the planner pop-up unless it links to a page.
            const toPlanner = pc && (!own || /^mailto:/i.test(own));
            return `<article class="ct-card">
              ${eyebrow(it.eyebrow)}
              <h2 class="ct-h">${esc(it.heading)}</h2>
              ${it.body ? `<p class="ct-p">${esc(it.body)}</p>` : ""}
              ${email || phone ? `<p class="ct-contact">${email ? `<a href="mailto:${esc(email)}"${pc ? " data-planner-contact" : ""}>${esc(email)}</a>` : ""}${phone ? `<a href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">${esc(phone)}</a>` : ""}</p>` : ""}
              ${it.buttonLabel && (href || toPlanner) ? `<div class="ct-btn">${button({ label: it.buttonLabel, href: href || "#", variant: it.style === "secondary" ? "secondary" : "primary", ground: "light", lang }).replace("<a ", toPlanner ? "<a data-planner-contact " : "<a ")}</div>` : ""}
            </article>`;
          }).join("")}
        </div>
      </div>
    </section>`;
  }

  _faq({ cfg, P }) {
    const f = cfg.faq;
    const items = f.items
      .map((it, i) => ({ q: P("faq", `items.${i}.q`, it.q), a: P("faq", `items.${i}.a`, it.a) }))
      .filter((it) => String(it.q).trim() && String(it.a).trim());
    const heading = P("faq", "heading", f.heading);
    const list = items.length
      ? `<div class="ct-faq">${items.map((it, i) => `
          <details class="ct-q"${i === 0 && f.firstOpen !== false ? " open" : ""}>
            <summary><span>${esc(it.q)}</span><span class="ct-arrow" aria-hidden="true"></span></summary>
            <div class="ct-a">${paragraphs(it.a)}</div>
          </details>`).join("")}</div>`
      : `<div class="pk-placeholder"><strong>Questions</strong>Write an answer for at least one question in the widget settings (questions without an answer are hidden), or switch this section off.</div>`;
    return `
    <section class="pk-section pk-bleed pk-ground-white" aria-label="${esc(heading || f.eyebrow)}">
      <div class="pk-inner">
        <div class="ct-split">
          <div>${eyebrow(P("faq", "eyebrow", f.eyebrow))}${heading ? `<h2 class="pk-h2">${esc(heading)}</h2>` : ""}</div>
          ${list}
        </div>
      </div>
    </section>`;
  }

  pageCss() {
    const t = TOKENS;
    return `
    .ct-cards { display: grid; grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr)); gap: 24px; }
    .ct-card { background: #fff; border: 1px solid ${t.hair}; border-radius: 2px; padding: 40px; display: flex; flex-direction: column; align-items: flex-start; }
    .ct-h { font-size: 28px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; }
    .ct-p { margin-top: 12px; font-size: 17px; line-height: 1.6; color: ${t.body}; max-width: 46ch; }
    .ct-contact { margin-top: 16px; display: flex; flex-direction: column; gap: 4px; font-size: 17px; font-weight: 700; }
    .ct-contact a { color: ${t.action}; text-decoration: none; overflow-wrap: anywhere; }
    .ct-contact a:hover { color: ${t.actionH}; text-decoration: underline; }
    .ct-btn { margin-top: auto; padding-top: 28px; }

    .ct-split { display: grid; grid-template-columns: .87fr 1.13fr; column-gap: clamp(40px, 7vw, 96px); align-items: start; }
    .ct-faq { border-bottom: 1px solid ${t.hair}; }
    .ct-q { border-top: 1px solid ${t.hair}; }
    .ct-q summary { list-style: none; cursor: pointer; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
      padding: 22px 0; font-size: 19px; line-height: 1.35; font-weight: 700; }
    .ct-q summary::-webkit-details-marker { display: none; }
    .ct-q summary:hover { color: ${t.action}; }
    .ct-arrow::before { content: "↓"; color: ${t.action}; font-weight: 700; }
    .ct-q[open] .ct-arrow::before { content: "↑"; }
    .ct-a { padding: 0 0 24px; font-size: 17px; line-height: 1.65; color: ${t.body}; max-width: 64ch; }
    .ct-a p + p { margin-top: 12px; }

    @media (max-width: 1024px) {
      .ct-split { grid-template-columns: minmax(0, 1fr); row-gap: 32px; }
    }
    @media (max-width: 760px) {
      .ct-cards { grid-template-columns: minmax(0, 1fr); gap: 16px; }
      .ct-card { padding: 28px 24px; }
      .ct-h { font-size: 24px; }
      .ct-btn { width: 100%; }
      .ct-btn .pk-btn { width: 100%; }
      .ct-q summary { font-size: 17px; padding: 18px 0; }
    }
    `;
  }
}
