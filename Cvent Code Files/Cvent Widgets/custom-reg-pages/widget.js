// widget.js — Registration pages widget (Bloomberg Live event sites).
//
// One widget, placed several times on the registration pages. Each copy is set
// to one job in its settings:
//   banner        black header: event, "Request to attend", date · time · venue
//   panel         "Your request": date, venue, what happens next, contact
//   confirmation  "Thanks, <first name>. Your request is in." + timeline + buttons
// Every copy also styles Cvent's own registration form (fields, labels, step bar,
// buttons, errors) in the light or dark theme chosen in its settings. That
// stylesheet goes into the page <head> (it has to reach Cvent's form, outside
// this widget) and is removed again when no copy of the widget is on the page,
// so the rest of the website is never affected.
//
// Purpose "AllPages" (config.json): allowed on registration pages, the pending
// approval / confirmation pages and the default header.
// Shared building blocks: page-kit.js. NOTE: include the file extension in imports.
import { ensureBrandFont } from "./type-scale.js";
import {
  TOKENS, esc, safeUrl, isExternal, lines, fixed, resolveLang, loadEventData, eventFacts,
  kitCss, applyFullBleed, mergePageConfig,
} from "./page-kit.js";
import { REG_FORM_CSS } from "./reg-form-css.js";

export const BUILD = "reg-2026-09-26a";

export const REG_DEFAULTS = {
  mode: "banner",            // "banner" | "panel" | "confirmation"
  theme: "light",            // "light" | "dark": the form area and this widget
  styleForm: true,           // restyle Cvent's registration form on this page
  hideOldHeader: true,       // hide the old "Event registration" text box in the page header
  useBrandFont: true,
  fullBleed: true,
  banner: {
    eyebrow: "",             // blank = event name
    title: "Request to attend",
    showMeta: true,          // date · time · venue line
    bgImageUrl: "",
    bgImageData: "",         // uploaded in the editor (resized JPEG data URL)
    bgOverlay: 60,
  },
  panel: {
    eyebrow: "Your request",
    heading: "",             // blank = event name
    greeting: "Almost there, {first}.", // used once the registrant's first name is known; blank = never
    showDate: true,
    dateDetail: "",          // blank = time range · "Registration opens <time>"
    showVenue: true,
    showNext: true,
    nextHeading: "What happens next",
    nextSteps: "Send your request. It takes about two minutes.\nOur team reviews every request to attend.\nYou’ll get an email with our decision and your event details.",
    contactText: "Questions?",
    contactLabel: "Contact the event team",
    contactUrl: "",          // a page link or mailto:
  },
  confirmation: {
    heading: "Thanks, {first}. Your request is in.",
    headingNoName: "Thanks. Your request is in.",
    body: "All requests to attend are reviewed by the Bloomberg team. We’ll email you at {email} with our decision.",
    bodyNoEmail: "All requests to attend are reviewed by the Bloomberg team. We’ll email you with our decision.",
    steps: "Request received | Today\nReview by our team | We aim to reply within a few business days.\nConfirmation and event details | If approved, you’ll get your confirmation and a calendar invitation.",
    primaryLabel: "Explore the program",
    primaryUrl: "",
    secondaryLabel: "Contact the event team",
    secondaryUrl: "",
  },
  translations: {},
};

export function mergeRegConfig(incoming = {}) {
  return mergePageConfig(REG_DEFAULTS, incoming);
}

// ---------------------------------------------------------------------------
// Page-wide form styling, shared by every copy of the widget on the page.
// ---------------------------------------------------------------------------
const STYLE_ID = "bbg-reg-form-style";
const HTML_ON = "bbg-reg";
const HTML_DARK = "bbg-reg--dark";
const HTML_HIDE_OLD = "bbg-reg--hide-old";
function registry() {
  window.__bbgRegWidgets = window.__bbgRegWidgets || new Set();
  return window.__bbgRegWidgets;
}
export function syncPageStyles() {
  const set = registry();
  const html = document.documentElement;
  const active = [...set].filter((w) => w.isConnected && w._cfg?.styleForm !== false);
  let tag = document.getElementById(STYLE_ID);
  if (!active.length) {
    tag?.remove();
    html.classList.remove(HTML_ON, HTML_DARK, HTML_HIDE_OLD);
    return;
  }
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_ID;
    (document.head || html).append(tag);
  }
  if (tag.textContent !== REG_FORM_CSS) tag.textContent = REG_FORM_CSS;
  // The first copy on the page (normally the banner) decides the theme.
  const lead = active.find((w) => w._cfg.mode === "banner") || active[0];
  html.classList.add(HTML_ON);
  html.classList.toggle(HTML_DARK, lead._cfg.theme === "dark");
  html.classList.toggle(HTML_HIDE_OLD, active.some((w) => w._cfg.hideOldHeader !== false));
}

// ---------------------------------------------------------------------------
export default class extends HTMLElement {
  constructor({ configuration, theme } = {}) {
    super();
    this.configuration = configuration || {};
    this.theme = theme || {};
    this.attachShadow({ mode: "open" });
    this._cfg = mergeRegConfig(this.configuration);
    this._dataPromise = null;
    this._renderSeq = 0;
    this._cleanups = [];
    this._unobserve = [];
    this._person = { first: "", email: "" };
  }

  async connectedCallback() {
    if (this._cfg.useBrandFont !== false) ensureBrandFont();
    registry().add(this);
    syncPageStyles();
    const root = document.createElement("div");
    root.className = "pk";
    root.dataset.build = BUILD;
    this.shadowRoot.append(root);
    this._watchPerson();
    await this._renderInto(root);
  }

  disconnectedCallback() {
    registry().delete(this);
    syncPageStyles();
    this._cleanups.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
    this._cleanups = [];
    this._unobserve.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
    this._unobserve = [];
  }

  onConfigurationUpdate(newConfig) {
    this.configuration = newConfig || {};
    this._cfg = mergeRegConfig(this.configuration);
    syncPageStyles();
    const root = this.shadowRoot?.querySelector(".pk");
    if (root) this._renderInto(root);
  }

  // ---- registrant (first name, email) via the SDK's observe/read ------------
  _sdk(name) {
    if (this.cventSdk?.[name]) return this.cventSdk[name].bind(this.cventSdk);
    if (typeof this[name] === "function" && !(name in HTMLElement.prototype)) return this[name].bind(this);
    return undefined;
  }
  _watchPerson() {
    const apply = (v) => {
      const first = String(v?.FIRSTNAME ?? "").trim();
      const email = String(v?.EMAIL_ADDRESS ?? "").trim();
      if (first === this._person.first && email === this._person.email) return;
      this._person = { first, email };
      const root = this.shadowRoot?.querySelector(".pk");
      if (root && this._rendered) this._renderInto(root);
    };
    try {
      const observe = this._sdk("observe");
      if (observe) {
        const res = observe(["FIRSTNAME", "EMAIL_ADDRESS"], apply);
        if (res?.unobserve) this._unobserve.push(res.unobserve);
        if (res?.value) this._person = { first: String(res.value.FIRSTNAME ?? "").trim(), email: String(res.value.EMAIL_ADDRESS ?? "").trim() };
        return;
      }
      const read = this._sdk("read");
      const res = read?.(["FIRSTNAME", "EMAIL_ADDRESS"]);
      if (res?.value) this._person = { first: String(res.value.FIRSTNAME ?? "").trim(), email: String(res.value.EMAIL_ADDRESS ?? "").trim() };
    } catch (e) {
      // Not in a registration context (e.g. the site designer): no name.
    }
  }

  _loadData() {
    if (!this._dataPromise) this._dataPromise = loadEventData(this, { tag: "reg", sessions: false, speakers: false });
    return this._dataPromise;
  }

  async _renderInto(root) {
    const seq = ++this._renderSeq;
    const cfg = this._cfg;
    const css = `<style>${kitCss()}${WIDGET_CSS}</style>`;
    const data = await this._loadData();
    if (seq !== this._renderSeq) return;
    const lang = resolveLang(data.eventInfo);
    const facts = eventFacts(data, lang);
    const P = (sec, key, base) => {
      const tr = cfg.translations?.[lang]?.[`${sec}.${key}`];
      return tr !== undefined && String(tr).trim() !== "" ? tr : base;
    };
    const ctx = { cfg, lang, facts, P, person: this._person };
    const dark = cfg.theme === "dark";
    const body = cfg.mode === "panel" ? this._panel(ctx) : cfg.mode === "confirmation" ? this._confirmation(ctx) : this._banner(ctx);
    root.className = `pk rg rg--${cfg.mode} ${dark ? "rg--dark" : ""} ${cfg.fullBleed !== false && cfg.mode === "banner" ? "pk--bleed" : ""}`;
    root.innerHTML = `${css}${body}`;
    this._cleanups.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
    this._cleanups = [];
    if (cfg.mode === "banner" && cfg.fullBleed !== false) this._cleanups.push(applyFullBleed(root));
    this._rendered = true;
  }

  // ---- BANNER -----------------------------------------------------------------
  _banner({ cfg, facts, P }) {
    const b = cfg.banner;
    const eb = P("banner", "eyebrow", b.eyebrow) || facts.title;
    const title = P("banner", "title", b.title);
    const meta = b.showMeta !== false
      ? [facts.dateLong, facts.timeRange && `${facts.timeRange} ${facts.tzShort}`.trim(), [facts.venueName, facts.city].filter(Boolean).join(", ")].filter(Boolean)
      : [];
    let src = safeUrl(b.bgImageUrl, "");
    if (!src || src.startsWith("#")) src = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.bgImageData || "") ? b.bgImageData : "";
    const bg = src
      ? `<div class="rg-bg" aria-hidden="true" style="--rg-bg: url(&quot;${esc(src.replace(/["\\\n\r]/g, encodeURIComponent))}&quot;)"></div><div class="rg-shade" aria-hidden="true" style="--rg-shade:${Math.max(0, Math.min(90, Number(b.bgOverlay) || 60)) / 100}"></div>`
      : "";
    return `
    <section class="pk-banner pk-bleed rg-banner${bg ? " rg-banner--photo" : ""}" aria-label="${esc(title || eb)}">
      ${bg}
      <div class="pk-inner">
        ${eb ? `<p class="pk-eyebrow pk-on-dark">${esc(eb)}</p>` : ""}
        ${title ? `<h1 class="pk-banner-h">${esc(title)}</h1>` : ""}
        ${meta.length ? `<p class="rg-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('<i aria-hidden="true"></i>')}</p>` : ""}
      </div>
    </section>`;
  }

  // ---- PANEL ------------------------------------------------------------------
  _panel({ cfg, facts, P, person }) {
    const p = cfg.panel;
    const greet = P("panel", "greeting", p.greeting);
    const heading = person.first && greet ? greet.replace(/\{first\}/g, person.first) : (P("panel", "heading", p.heading) || facts.title);
    const dateDetail = P("panel", "dateDetail", p.dateDetail)
      || [facts.timeRange && `${facts.timeRange} ${facts.tzShort}`.trim(), facts.startTime && `Registration opens ${facts.startTime}`].filter(Boolean).join(" · ");
    const addr = [facts.address1, facts.cityLine].filter(Boolean).join(", ");
    const steps = lines(P("panel", "nextSteps", p.nextSteps));
    const cUrl = safeUrl(p.contactUrl, "");
    const cLabel = P("panel", "contactLabel", p.contactLabel);
    return `
    <aside class="rg-panel" aria-label="${esc(P("panel", "eyebrow", p.eyebrow) || facts.title)}">
      ${p.eyebrow ? `<p class="rg-eb">${esc(P("panel", "eyebrow", p.eyebrow))}</p>` : ""}
      ${heading ? `<h2 class="rg-ph">${esc(heading)}</h2>` : ""}
      ${p.showDate !== false || p.showVenue !== false ? `<dl class="rg-dl">
        ${p.showDate !== false && facts.dateLong ? `<div><dt>Date</dt><dd>${esc(facts.dateLong)}${dateDetail ? `<span>${esc(dateDetail)}</span>` : ""}</dd></div>` : ""}
        ${p.showVenue !== false && (facts.venueName || addr) ? `<div><dt>Venue</dt><dd>${esc(facts.venueName || addr)}${facts.venueName && addr ? `<span>${esc(addr)}</span>` : ""}</dd></div>` : ""}
      </dl>` : ""}
      ${p.showNext !== false && steps.length ? `<div class="rg-next"><p class="rg-eb">${esc(P("panel", "nextHeading", p.nextHeading))}</p><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>` : ""}
      ${cLabel && cUrl ? `<p class="rg-ask">${esc(P("panel", "contactText", p.contactText))} <a href="${esc(cUrl)}"${isExternal(cUrl) ? ' target="_blank" rel="noopener"' : ""}>${esc(cLabel)}</a></p>` : ""}
    </aside>`;
  }

  // ---- CONFIRMATION -------------------------------------------------------------
  _confirmation({ cfg, P, person, lang }) {
    const c = cfg.confirmation;
    const heading = person.first
      ? P("confirmation", "heading", c.heading).replace(/\{first\}/g, person.first)
      : P("confirmation", "headingNoName", c.headingNoName);
    // The email is set in bold; everything else is escaped text.
    const rawBody = person.email ? P("confirmation", "body", c.body) : P("confirmation", "bodyNoEmail", c.bodyNoEmail);
    const body = esc(rawBody).replace(/\{email\}/g, `<b>${esc(person.email)}</b>`).replace(/\{first\}/g, esc(person.first));
    const steps = lines(P("confirmation", "steps", c.steps)).map((l) => {
      const i = l.indexOf("|");
      return i < 0 ? { t: l, d: "" } : { t: l.slice(0, i).trim(), d: l.slice(i + 1).trim() };
    });
    const btn = (label, url, primary) => {
      const u = safeUrl(url, "");
      if (!label || !u) return "";
      const ext = isExternal(u);
      return `<a class="pk-btn pk-btn--lg ${primary ? "pk-btn--primary" : "pk-btn--secondary"} ${cfg.theme === "dark" ? "pk-btn--on-dark" : "pk-btn--on-light"}" href="${esc(u)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(label)}${ext ? `<span class="pk-sr"> ${esc(fixed(lang, "opensNewTab"))}</span>` : ""}</a>`;
    };
    const btns = btn(P("confirmation", "primaryLabel", c.primaryLabel), c.primaryUrl, true) + btn(P("confirmation", "secondaryLabel", c.secondaryLabel), c.secondaryUrl, false);
    return `
    <section class="rg-done" aria-label="${esc(heading)}">
      <div class="rg-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h2 class="rg-dh">${esc(heading)}</h2>
      ${rawBody ? `<p class="rg-dp">${body}</p>` : ""}
      ${steps.length ? `<ol class="rg-tl">${steps.map((s, i) => `<li><i class="${i === 0 ? "on" : ""}" aria-hidden="true"></i><div><b>${esc(s.t)}</b>${s.d ? `<span>${esc(s.d)}</span>` : ""}</div></li>`).join("")}</ol>` : ""}
      ${btns ? `<div class="rg-btns">${btns}</div>` : ""}
    </section>`;
  }
}

// ---------------------------------------------------------------------------
// This widget's own (shadow) CSS. Light is the default; .rg--dark flips it.
// ---------------------------------------------------------------------------
const t = TOKENS;
const WIDGET_CSS = `
  .rg { --rg-ink: ${t.ink}; --rg-body: ${t.body}; --rg-muted: ${t.muted}; --rg-hair: ${t.hair}; --rg-panel: ${t.tint}; --rg-accent: ${t.amberInk}; --rg-dot-bg: #fff; }
  .rg--dark { --rg-ink: #fff; --rg-body: rgba(255,255,255,.78); --rg-muted: rgba(255,255,255,.66); --rg-hair: rgba(255,255,255,.14); --rg-panel: ${t.panel}; --rg-accent: ${t.amberOnDark}; --rg-dot-bg: transparent; }
  .rg { color: var(--rg-ink); }

  /* banner */
  .rg-banner { position: relative; overflow: hidden; isolation: isolate; padding: clamp(32px, 4vw, 44px) 0 clamp(28px, 3.5vw, 38px); }
  .rg-banner .pk-inner { position: relative; z-index: 1; }
  .rg-banner .pk-eyebrow { margin-bottom: 12px; }
  .rg-meta { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font-size: 16px; color: rgba(255,255,255,.8); }
  .rg-meta i { width: 4px; height: 4px; border-radius: 50%; background: ${t.amberOnDark}; }
  .rg-bg { position: absolute; inset: 0; z-index: 0; background-image: var(--rg-bg); background-size: cover; background-position: center; }
  .rg-shade { position: absolute; inset: 0; z-index: 0; background: rgba(11,11,12,var(--rg-shade, .6)); }

  /* panel */
  .rg-panel { background: var(--rg-panel); border-top: 3px solid ${t.amberOnDark}; padding: 28px; }
  .rg-eb { font-size: 11.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--rg-accent); }
  .rg-ph { margin-top: 8px; font-size: 21px; line-height: 1.25; font-weight: 700; letter-spacing: -0.01em; color: var(--rg-ink); }
  .rg-dl { margin: 18px 0 0; display: grid; gap: 14px; }
  .rg-dl dt { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--rg-muted); }
  .rg-dl dd { margin: 2px 0 0; font-size: 15.5px; color: var(--rg-ink); }
  .rg-dl dd span { display: block; font-size: 14px; color: var(--rg-body); }
  .rg-next { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--rg-hair); }
  .rg-next ol { list-style: none; margin: 10px 0 0; padding: 0; counter-reset: n; display: grid; gap: 10px; }
  .rg-next li { counter-increment: n; display: grid; grid-template-columns: 24px 1fr; gap: 8px; font-size: 14.5px; line-height: 1.45; color: var(--rg-body); }
  .rg-next li::before { content: counter(n); width: 22px; height: 22px; border-radius: 50%; background: var(--rg-dot-bg); border: 1px solid var(--rg-hair); display: grid; place-items: center; font-size: 12px; font-weight: 700; color: var(--rg-ink); }
  .rg-ask { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--rg-hair); font-size: 14.5px; color: var(--rg-body); }
  .rg-ask a { color: var(--rg-accent); font-weight: 700; text-decoration: none; }
  .rg-ask a:hover { text-decoration: underline; }

  /* confirmation */
  .rg-done { max-width: 680px; padding: 8px 0; }
  .rg-tick { width: 52px; height: 52px; border-radius: 50%; background: rgba(156,95,0,.12); display: grid; place-items: center; margin-bottom: 18px; }
  .rg--dark .rg-tick { background: rgba(247,163,37,.16); }
  .rg-tick svg { width: 24px; height: 24px; stroke: var(--rg-accent); stroke-width: 2.5; fill: none; }
  .rg-dh { font-size: clamp(26px, 3vw, 34px); line-height: 1.15; font-weight: 700; letter-spacing: -0.02em; color: var(--rg-ink); }
  .rg-dp { margin-top: 12px; font-size: 17px; line-height: 1.6; color: var(--rg-body); }
  .rg-dp b { color: var(--rg-ink); overflow-wrap: anywhere; }
  .rg-tl { list-style: none; margin: 28px 0 0; padding: 0; border-top: 1px solid var(--rg-hair); }
  .rg-tl li { display: grid; grid-template-columns: 28px 1fr; gap: 12px; padding: 16px 0; border-bottom: 1px solid var(--rg-hair); }
  .rg-tl i { width: 14px; height: 14px; border-radius: 50%; margin-top: 5px; border: 2px solid var(--rg-hair); }
  .rg-tl i.on { border-color: var(--rg-accent); background: var(--rg-accent); }
  .rg-tl b { display: block; font-size: 16.5px; color: var(--rg-ink); }
  .rg-tl span { font-size: 15px; color: var(--rg-body); }
  .rg-btns { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
  @media (max-width: 600px) {
    .rg-meta { flex-direction: column; align-items: flex-start; gap: 2px; font-size: 15px; }
    .rg-meta i { display: none; }
    .rg-panel { padding: 22px 20px; }
    .rg-btns .pk-btn { width: 100%; }
  }
`;
