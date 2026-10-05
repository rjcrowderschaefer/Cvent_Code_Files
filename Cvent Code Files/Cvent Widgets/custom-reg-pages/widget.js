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
// Purpose "General" (config.json): allowed on registration pages, the pending
// approval / confirmation pages and the default header.
// Shared building blocks: page-kit.js. NOTE: include the file extension in imports.
import { ensureBrandFont } from "./type-scale.js";
import {
  TOKENS, esc, safeUrl, isExternal, lines, fixed, resolveLang, loadEventData, eventFacts,
  kitCss, applyFullBleed, mergePageConfig, LABEL_PX, holdHeight, trackScroll, noteConfig, restoreScroll,
  findPlannerContact, wirePlannerContact, ensureSiteCss,
} from "./page-kit.js";
import { REG_FORM_CSS, regFormCss } from "./reg-form-css.js";

export const BUILD = "reg-2026-10-05b";

export const REG_DEFAULTS = {
  mode: "banner",            // "banner" | "panel" | "confirmation" | "page" (all of it, for a shared header) | "styles" (page CSS only, draws nothing)
  // Which Cvent page this copy sits on. Choosing one fills in that page's
  // copy (PAGE_PRESETS) for every mode; any field can be edited after.
  pageType: "registration",
  presetFor: "",             // the page type whose copy was last filled in (set by the editor)
  // "Whole page" copies (one copy in a shared header): each page's own wording,
  // { pending: { banner, panel, confirmation }, ... } over that page's preset.
  pages: {},
  pageAddresses: "",         // "address words = page type" lines, checked before the built-in matching
  hideBody: true,            // whole-page copy on a status page: hide Cvent's own page content below it
  injectPanel: true,         // whole-page copy on a form page: put the side panel beside Cvent's form
  // Whole-page copy in a header shared with other pages: the pages it draws.
  // Everywhere else (website pages, pages with their own copies) it draws nothing.
  covers: ["pending", "denied", "cancelled", "archive", "cancelForm", "declineForm", "guest"],
  theme: "light",            // "light" | "dark": the form area and this widget
  styleForm: true,           // restyle Cvent's registration form on this page
  hideOldHeader: true,       // hide the old "Event registration" text box in the page header
  hideRegType: true,         // hide Cvent's read-only "Registration Type · …" line (one type only)
  introHeading: true,        // intro typed as plain paragraphs: show the first one as the heading
  showRequiredNote: true,    // "* Required" under the form's intro text
  requiredNote: "Required",
  hideFieldHints: true,      // hide Cvent's "Your answer can only contain…" line under text fields
  // State / region: Cvent's own display logic shows it only for countries with
  // a state list, but it renders it while Country is still empty. Keep it out
  // of view until Country has an answer; Cvent decides from there. The widget
  // only reads the Country value: it never opens or answers a dropdown.
  stateAfterCountry: true,
  countryLabel: "Country",
  stateLabel: "State / region",
  optInHelp: "You can change this later in the app.", // under the event-app networking question; blank = none
  // Fields shown side by side: one pair per line, "Label A + Label B" (Cvent's
  // field labels, any case). Both must be on the page, one right after the other.
  pairFields: "First Name + Last Name\nIndustry + Job Role\nCountry + State/Region",
  useBrandFont: true,
  fullBleed: true,
  // Review page (Cvent's Registration Summary): two cards, as in the mockup.
  review: {
    contactTitle: "Contact details",
    aboutTitle: "About you",
    nameLabel: "Name",
    emailLabel: "Work email",
    // Answer labels shown on the review page: "Cvent label = shown label", one per
    // line. Asterisks are always dropped.
    labels: "Handraiser = Talk to a representative\nJob Role = Job role\nState = State / region",
  },
  banner: {
    eyebrow: "",             // blank = event name
    title: "Request to attend",
    showMeta: true,          // date · time · venue line
    showSteps: true,         // draw the step bar under the banner (Cvent's own sits in the header, above it)
    bgImageUrl: "",
    bgImageData: "",         // uploaded in the editor (resized JPEG data URL)
    bgOverlay: 60,
  },
  panel: {
    eyebrow: "Your request",
    heading: "",             // blank = event name
    greeting: "Almost there, {first}.", // on pages after the one where the first name is entered; blank = never
    showDate: true,
    dateDetail: "",          // blank = time range · "Registration opens <time>"
    showVenue: true,
    showNext: true,
    nextHeading: "What happens next",
    nextSteps: "Share a few details. It takes about two minutes.\nPlaces are limited, so our team confirms each request personally.\nYou’ll hear from us by email soon, with your event details once your place is confirmed.",
    contactText: "Questions?",
    contactLabel: "Contact the Bloomberg Team",
    contactUrl: "",          // a page link or mailto:; blank = Cvent's Contact Planner pop-up, else the site's "Contact" menu item
    plannerContactSelector: "", // advanced: the Contact Planner widget's button, if not found automatically
  },
  confirmation: {
    heading: "Thanks, {first}. Your request is in.",
    headingNoName: "Thanks. Your request is in.",
    body: "Places are limited, so our team confirms each request personally. We’ll be in touch at {email} soon.",
    bodyNoEmail: "Places are limited, so our team confirms each request personally. We’ll be in touch by email soon.",
    steps: "Request received | Today\nConfirming places | We aim to reply within a few business days.\nYour event details | Once your place is confirmed, you’ll get your confirmation and a calendar invitation.",
    primaryLabel: "Explore the program",
    primaryUrl: "",
    secondaryLabel: "Contact the Bloomberg Team",
    secondaryUrl: "",
    // Post-registration pages (2026-10-04): approved confirmation, denied, archive.
    showTick: true,          // the amber check mark above the heading (good news only)
    stepsDone: 1,            // timeline steps marked as done, from the top
    tertiaryLabel: "",       // a quiet underlined link after the buttons (e.g. "Cancel registration")
    tertiaryUrl: "",
    calloutTitle: "",        // an outlined box above the buttons; blank title + text = none
    calloutText: "",
  },
  translations: {},
};

// ---------------------------------------------------------------------------
// Page types: one preset per Cvent registration / post-registration page.
// Tokens in the copy: {first} {email} (registrant), {event} {date} {time}
// (event). Button URLs: a page link, mailto:, or #agenda / #contact (the site's
// pages; #contact opens Cvent's Contact Planner pop-up when it is on the page)
// and #modify / #cancel (Cvent's own Modify / Cancel Registration buttons).
// ---------------------------------------------------------------------------
export const PAGE_TYPES = [
  ["auto", "Automatic: from the page address (for a shared header)"],
  ["registration", "Registration form (Request to attend)"],
  ["pending", "Pending approval (Request received)"],
  ["approved", "Confirmation (approved)"],
  ["denied", "Registration denied"],
  ["cancelForm", "Cancellation form"],
  ["cancelled", "Registration cancelled (after cancelling)"],
  ["declineForm", "Decline invitation form"],
  ["guest", "Guest registration"],
  ["archive", "Archive (event has ended)"],
];
const NO_GREETING = { greeting: "", showNext: false };
export const PAGE_PRESETS = {
  registration: {},
  pending: {
    banner: { title: "Request received", showSteps: false },
    panel: { eyebrow: "Your request", ...NO_GREETING },
    confirmation: { primaryUrl: "#agenda", secondaryUrl: "#contact" },
  },
  approved: {
    banner: { title: "You’re registered", showSteps: false },
    panel: { eyebrow: "Your registration", ...NO_GREETING },
    confirmation: {
      heading: "You’re confirmed, {first}.",
      headingNoName: "You’re confirmed.",
      body: "Your place at {event} is confirmed. We sent your confirmation and calendar invitation to {email}.",
      bodyNoEmail: "Your place at {event} is confirmed. We sent your confirmation and calendar invitation by email.",
      steps: "Request approved | Your place is saved.\nConfirmation sent | Check your inbox for the calendar invitation.\nEvent day | {date} · {time}",
      stepsDone: 2,
      primaryLabel: "Explore the program", primaryUrl: "#agenda",
      secondaryLabel: "Change my registration", secondaryUrl: "#modify",
      tertiaryLabel: "Cancel registration", tertiaryUrl: "#cancel",
    },
  },
  denied: {
    banner: { title: "An update on your registration request", showSteps: false },
    panel: { eyebrow: "The event", ...NO_GREETING },
    confirmation: {
      showTick: false,
      heading: "We can’t offer you a place this time, {first}.",
      headingNoName: "We can’t offer you a place this time.",
      body: "Thank you for your interest in {event}. Due to limited capacity, we’re unable to confirm your registration. We hope to welcome you at a future Bloomberg event.",
      bodyNoEmail: "Thank you for your interest in {event}. Due to limited capacity, we’re unable to confirm your registration. We hope to welcome you at a future Bloomberg event.",
      steps: "", stepsDone: 0,
      primaryLabel: "Contact the Bloomberg Team", primaryUrl: "#contact",
      secondaryLabel: "", secondaryUrl: "",
    },
  },
  cancelForm: {
    banner: { title: "Cancel registration", showSteps: false },
    panel: { eyebrow: "Your registration", ...NO_GREETING },
  },
  cancelled: {
    banner: { title: "Registration cancelled", showSteps: false },
    panel: { eyebrow: "The event", ...NO_GREETING },
    confirmation: {
      showTick: false,
      heading: "Your registration is cancelled, {first}.",
      headingNoName: "Your registration is cancelled.",
      body: "We’ve released your place at {event} and sent a confirmation to {email}. If your plans change, contact us and we’ll do what we can.",
      bodyNoEmail: "We’ve released your place at {event} and sent you a confirmation by email. If your plans change, contact us and we’ll do what we can.",
      steps: "", stepsDone: 0,
      primaryLabel: "Contact the Bloomberg Team", primaryUrl: "#contact",
      secondaryLabel: "", secondaryUrl: "",
    },
  },
  declineForm: {
    banner: { title: "Decline invitation", showSteps: false },
    panel: { eyebrow: "Your invitation", ...NO_GREETING },
  },
  guest: {
    banner: { title: "Add a guest" },
    panel: {
      eyebrow: "Your registration", greeting: "", showNext: true, nextHeading: "About guests",
      nextSteps: "Each guest gets their own confirmation email.\nGuests go through the same review as you.\nYou can remove a guest by changing your registration.",
    },
  },
  archive: {
    banner: { title: "This event has ended", showSteps: false },
    panel: { eyebrow: "The event", ...NO_GREETING },
    confirmation: {
      showTick: false,
      heading: "Thanks for your interest",
      headingNoName: "Thanks for your interest",
      body: "{event} took place on {date}. Registration is closed and this site is no longer updated.",
      bodyNoEmail: "{event} took place on {date}. Registration is closed and this site is no longer updated.",
      steps: "", stepsDone: 0,
      calloutTitle: "Interested in future events?",
      calloutText: "Tell us what you’d like to hear about and we’ll invite you to upcoming Bloomberg events.",
      primaryLabel: "Contact the Bloomberg Team", primaryUrl: "#contact",
      secondaryLabel: "", secondaryUrl: "",
    },
  },
};
export const STATUS_PAGES = ["pending", "approved", "denied", "cancelled", "archive"];
// The page a copy is on, from the address: Cvent names its registration pages
// in the last part of the path (".../registrationPendingApprovalPage:<id>").
// The planner's "address words = page type" lines are checked first.
export function detectPageType(path, map = "") {
  const seg = (() => { try { return decodeURIComponent(String(path || "").split("/").filter(Boolean).pop() || ""); } catch (e) { return ""; } })().split(":")[0];
  const s = seg.toLowerCase(), all = String(path || "").toLowerCase();
  for (const line of lines(map)) {
    const i = line.lastIndexOf("=");
    if (i < 0) continue;
    const frag = line.slice(0, i).trim().toLowerCase(), type = line.slice(i + 1).trim();
    if (frag && PAGE_PRESETS[type] && all.includes(frag)) return type;
  }
  if (/pending|awaitingapproval/.test(s)) return "pending";
  if (/denied|deny|reject|notapproved|disapproved/.test(s)) return "denied";
  if (/cancel/.test(s)) return /(cancelled|canceled|confirm|complete|success|done)/.test(s) ? "cancelled" : "cancelForm";
  if (/decline/.test(s)) return "declineForm";
  if (/guest/.test(s)) return "guest";
  if (/archive|closed|postevent|ended/.test(s)) return "archive";
  if (/confirmation|confirmed|approved/.test(s)) return "approved";
  if (/regprocess|register|registration|summary.*reg|reg.*summary/.test(s)) return "registration";
  return "none";               // a website page (Home, Agenda, ...): not ours
}
// One page's full settings for a whole-page copy: defaults, then the page's
// preset, then the planner's edits for that page.
export function pageConfig(cfg, type) {
  const pr = PAGE_PRESETS[type] || {};
  const own = (cfg.pages && cfg.pages[type]) || {};
  const out = { ...cfg, pageType: type, presetFor: type };
  ["banner", "panel", "confirmation"].forEach((sec) => { out[sec] = { ...REG_DEFAULTS[sec], ...(pr[sec] || {}), ...(own[sec] || {}) }; });
  return out;
}
const isBannerish = (w) => w._cfg?.mode === "banner" || (w._cfg?.mode === "page" && !w._idle);

// Every field any preset sets: switching page type resets these.
const PRESET_FIELDS = (() => {
  const f = {};
  Object.values(PAGE_PRESETS).forEach((pr) => Object.entries(pr).forEach(([sec, vals]) => {
    f[sec] = f[sec] || new Set();
    Object.keys(vals).forEach((k) => f[sec].add(k));
  }));
  return f;
})();
// The editor's page-type switch: that page's copy in every preset field
// (fields the preset doesn't set go back to the defaults).
export function applyPageType(cfg, type) {
  const pr = PAGE_PRESETS[type] || {};
  const out = { ...cfg, pageType: type, presetFor: type };
  Object.entries(PRESET_FIELDS).forEach(([sec, keys]) => {
    out[sec] = { ...(cfg[sec] || {}) };
    keys.forEach((k) => { out[sec][k] = pr[sec] && k in pr[sec] ? pr[sec][k] : REG_DEFAULTS[sec][k]; });
  });
  return out;
}

export function mergeRegConfig(incoming = {}) {
  const out = mergePageConfig(REG_DEFAULTS, incoming);
  // Earlier default, saved into existing copies by the editor: update it.
  if (["Contact the event team", "Contact the Bloomberg team"].includes(out.panel.contactLabel)) out.panel.contactLabel = REG_DEFAULTS.panel.contactLabel;
  if (out.confirmation.secondaryLabel === "Contact the event team") out.confirmation.secondaryLabel = REG_DEFAULTS.confirmation.secondaryLabel;
  // Softer request-to-attend copy (2026-10-02): saved copies of the old
  // defaults follow the new ones; edited copy is left alone.
  const OLD = {
    "panel.nextSteps": "Send your request. It takes about two minutes.\nOur team reviews every request to attend.\nYou’ll get an email with our decision and your event details.",
    "confirmation.body": "All requests to attend are reviewed by the Bloomberg team. We’ll email you at {email} with our decision.",
    "confirmation.bodyNoEmail": "All requests to attend are reviewed by the Bloomberg team. We’ll email you with our decision.",
    "confirmation.steps": "Request received | Today\nReview by our team | We aim to reply within a few business days.\nConfirmation and event details | If approved, you’ll get your confirmation and a calendar invitation.",
  };
  Object.entries(OLD).forEach(([k, v]) => {
    const [sec, key] = k.split(".");
    if (String(out[sec][key] || "").replace(/\r/g, "") === v) out[sec][key] = REG_DEFAULTS[sec][key];
  });
  // A page type chosen without the editor filling its copy in (or an older
  // saved copy): fields still at the general default take the page's copy.
  if (!PAGE_PRESETS[out.pageType] && out.pageType !== "auto") out.pageType = "registration";
  if (!out.pages || typeof out.pages !== "object") out.pages = {};
  if (!Array.isArray(out.covers)) out.covers = [...REG_DEFAULTS.covers];
  if (out.pageType !== "registration" && out.pageType !== "auto" && out.presetFor !== out.pageType) {
    Object.entries(PAGE_PRESETS[out.pageType]).forEach(([sec, vals]) => Object.entries(vals).forEach(([k, v]) => {
      if (out[sec][k] === undefined || out[sec][k] === REG_DEFAULTS[sec][k]) out[sec][k] = v;
    }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Page-wide form styling, shared by every copy of the widget on the page.
// ---------------------------------------------------------------------------
const STYLE_ID = "bbg-reg-form-style";
const HTML_ON = "bbg-reg";
const HTML_DARK = "bbg-reg--dark";
const HTML_HIDE_OLD = "bbg-reg--hide-old";
const HTML_OWN_STEPS = "bbg-reg--own-steps";
const HTML_READY = "bbg-reg--ready";
const HTML_HIDE_BODY = "bbg-reg--hide-body";
const HTML_HIDE_REGTYPE = "bbg-reg--hide-regtype";
const HTML_REQ_NOTE = "bbg-reg--req-note";
const HTML_INTRO_H = "bbg-reg--intro-heading";
const HTML_NO_HINTS = "bbg-reg--no-hints";
const ROOT_CLASS = "bbg-reg-root";
const SHADOW_CSS = regFormCss(`.${ROOT_CLASS}.${HTML_ON}`);

// Where Cvent's registration page lives, relative to this widget. On the live
// site: the same document. Site Designer may instead render the widget in its
// own frame or shadow root, apart from the page canvas; then the styles have to
// go to the document (or shadow root) that actually holds Cvent's form, or the
// editor shows Cvent's unstyled form while the live page is styled.
// Cvent's step bar: the older component (ProgressBar__wrapper) and the newer
// one (data-cvent-id "site-designer-ProgressBar-widget:…", utility classes).
const STEP_BAR = "[class*=ProgressBar__wrapper], [data-cvent-id*=ProgressBar-widget]";
const PAGE_MARKERS = `[class*=Forms__container], [class*=LinearNavigator__button], ${STEP_BAR}, .left-align-fields, .identity-confirmation, .bbg-reg-page`;
function frameChain(doc) {
  const out = [doc];
  try {
    let w = doc.defaultView;
    while (w && w.frameElement) {
      const p = w.frameElement.ownerDocument;
      if (!p || out.includes(p)) break;
      out.push(p);
      w = p.defaultView;
    }
  } catch (e) { /* a cross-origin parent: stop here */ }
  return out;
}
export function findPageTarget(el) {
  const root = el.getRootNode ? el.getRootNode() : null;
  const cands = [];
  if (root && root.nodeType === 11) cands.push(root); // a shadow root
  cands.push(...frameChain(el.ownerDocument || document));
  for (const c of cands) { try { if (c.querySelector(PAGE_MARKERS)) return c; } catch (e) { /* skip */ } }
  return el.ownerDocument || document;
}
const isDoc = (t) => t && t.nodeType === 9;
// Elements that carry the state classes: <html>, or a shadow root's top-level elements.
const stateEls = (t) => (isDoc(t) ? [t.documentElement] : [...t.children].filter((e) => e.tagName !== "STYLE"));

// One registry per target (document or shadow root).
const REGISTRIES = new WeakMap();
function registry(t) {
  if (!REGISTRIES.has(t)) REGISTRIES.set(t, new Set());
  return REGISTRIES.get(t);
}
export function syncPageStyles(t = document) {
  if (!t) return;
  const set = registry(t);
  const active = [...set].filter((w) => w.isConnected && w._cfg?.styleForm !== false && w._cfg?.mode !== "styles" && !(w._cfg?.mode === "page" && w._idle));
  const els = stateEls(t);
  let tag = isDoc(t) ? t.getElementById(STYLE_ID) : t.querySelector(`#${STYLE_ID}`);
  if (!active.length) {
    tag?.remove();
    els.forEach((e) => { e.classList.remove(ROOT_CLASS, HTML_ON, HTML_DARK, HTML_HIDE_OLD, HTML_OWN_STEPS, HTML_READY, HTML_HIDE_BODY, HTML_HIDE_REGTYPE, HTML_REQ_NOTE, HTML_INTRO_H, HTML_NO_HINTS); e.style.removeProperty("--bbg-reg-req"); e.style.removeProperty("--bbg-reg-optin-help"); ["--bbg-sum-contact", "--bbg-sum-about", "--bbg-sum-name", "--bbg-sum-email"].forEach((k) => e.style.removeProperty(k)); });
    return;
  }
  const css = isDoc(t) ? REG_FORM_CSS : SHADOW_CSS;
  if (!tag) {
    const doc = isDoc(t) ? t : t.ownerDocument;
    tag = doc.createElement("style");
    tag.id = STYLE_ID;
    if (isDoc(t)) (t.head || t.documentElement).append(tag); else t.prepend(tag);
  }
  if (tag.textContent !== css) tag.textContent = css;
  // The banner copy (else the first copy) decides the theme.
  const lead = active.find(isBannerish) || active[0];
  const dark = lead._cfg.theme === "dark";
  const hideOld = active.some((w) => w._cfg.hideOldHeader !== false);
  // Our step bar replaces Cvent's. Until the widget has read Cvent's bar (it
  // can draw after the widget), keep Cvent's hidden for a short grace period
  // so it never flashes; after that, a page we can't read keeps Cvent's bar.
  const ownSteps = active.some((w) => isBannerish(w) && w._cfg.banner?.showSteps !== false
    && (w._hasSteps || Date.now() < (w._stepsGraceUntil || 0)));
  const ready = active.some((w) => w._rendered);
  els.forEach((e) => {
    if (!isDoc(t)) e.classList.add(ROOT_CLASS);
    e.classList.add(HTML_ON);
    e.classList.toggle(HTML_DARK, dark);
    e.classList.toggle(HTML_HIDE_OLD, hideOld);
    e.classList.toggle(HTML_OWN_STEPS, ownSteps);
    e.classList.toggle(HTML_READY, ready);
    e.classList.toggle(HTML_HIDE_BODY, active.some((w) => w._cfg.mode === "page" && !w._idle && !w._designer && w._cfg.hideBody !== false && STATUS_PAGES.includes(w._pageKind)));
    e.classList.toggle(HTML_HIDE_REGTYPE, active.some((w) => w._cfg.hideRegType !== false));
    e.classList.toggle(HTML_REQ_NOTE, lead._cfg.showRequiredNote !== false);
    e.classList.toggle(HTML_INTRO_H, lead._cfg.introHeading !== false);
    e.classList.toggle(HTML_NO_HINTS, lead._cfg.hideFieldHints !== false);
    e.style.setProperty("--bbg-reg-req", JSON.stringify(String(lead._cfg.requiredNote || "Required")));
    const rv = lead._cfg.review || {};
    [["--bbg-sum-contact", rv.contactTitle], ["--bbg-sum-about", rv.aboutTitle], ["--bbg-sum-name", rv.nameLabel], ["--bbg-sum-email", rv.emailLabel]]
      .forEach(([k, v]) => { const x = String(v || "").trim(); if (x) e.style.setProperty(k, JSON.stringify(x)); else e.style.removeProperty(k); });
    const help = String(lead._cfg.optInHelp || "").trim();
    if (help) e.style.setProperty("--bbg-reg-optin-help", JSON.stringify(help)); else e.style.removeProperty("--bbg-reg-optin-help");
  });
  // The site CSS can hide the page until the widget has taken over (no flash of
  // Cvent's own design); it watches for this class on the marked section.
  if (ready) (isDoc(t) ? t : t).querySelectorAll(".bbg-reg-page").forEach((e) => e.classList.add("bbg-reg-ready"));
}

// Cvent's own Modify / Cancel Registration buttons (post-registration pages).
// Their links carry the attendee's details, so the widget never copies them:
// its buttons click Cvent's, and Cvent's are hidden.
const NATIVE_TEXT = {
  modify: /^\s*(modify|change|edit|update)\s+(my\s+|your\s+)?registration\s*$/i,
  cancel: /^\s*cancel\s+(my\s+|your\s+)?registration\s*$/i,
};
function nativeAction(url) {
  const m = /^#(modify|cancel)$/i.exec(String(url || "").trim());
  return m ? m[1].toLowerCase() : "";
}
function findNative(t, act) {
  const re = NATIVE_TEXT[act];
  if (!re || !t?.querySelectorAll) return null;
  const hit = [...t.querySelectorAll("a, button, [role=button]")].find((el) => re.test(el.textContent || "")
    && !el.closest("[data-bbg-reg], nav, [class*=WebsiteNavigator], [role=banner]"));
  return hit || null;
}

// ---------------------------------------------------------------------------
export default class extends HTMLElement {
  constructor({ configuration, theme } = {}) {
    super();
    this.configuration = configuration || {};
    this.theme = theme || {};
    this.attachShadow({ mode: "open" });
    this._cfg = mergeRegConfig(this.configuration);
    this._pageKind = this._cfg.pageType === "auto" ? "registration" : this._cfg.pageType;
    this._dataPromise = null;
    this._renderSeq = 0;
    this._cleanups = [];
    this._unobserve = [];
    this._person = { first: "", email: "" };
  }

  get _doc() { return this.ownerDocument || document; }
  // The document or shadow root that holds Cvent's form (see findPageTarget).
  _findTarget() {
    const t = findPageTarget(this);
    if (t !== this._target) {
      if (this._target) { registry(this._target).delete(this); syncPageStyles(this._target); }
      this._target = t;
      registry(t).add(this);
      this._observeTarget();
    }
    syncPageStyles(t);
    return t;
  }

  async connectedCallback() {
    if (this._cfg.useBrandFont !== false) ensureBrandFont();
    // "Page styles only": this widget type is the one Cvent offers on every
    // registration and post-registration page (and the default header /
    // footer), so one invisible copy brings the page CSS (CONFIRM_PAGE_CSS:
    // the bbg-confirm text-block pages) where no other widget can go. It
    // draws nothing and leaves Cvent's form alone.
    if (this._cfg.mode === "styles") { this._connectStylesOnly(); return; }
    this._resolvePage();
    this.setAttribute("data-bbg-reg", "");
    this._stepsGraceUntil = Date.now() + 2000;
    clearTimeout(this._graceTimer);
    this._graceTimer = setTimeout(() => syncPageStyles(this._target || this._doc), 2050);
    this._findTarget();
    // Site Designer can draw the page after the widget: look again for a while.
    let tries = 0;
    const again = () => { if (!this.isConnected || tries++ > 20) return; if (!this._target?.querySelector?.(PAGE_MARKERS)) this._findTarget(); this._retry = setTimeout(again, 500); };
    this._retry = setTimeout(again, 500);
    const root = document.createElement("div");
    root.className = "pk";
    root.dataset.build = BUILD;
    this.shadowRoot.append(root);
    this._watchPerson();
    this._watchSteps();
    await this._renderInto(root);
    const tag = `reg-${this._cfg.mode}`;
    restoreScroll(this, tag, this.configuration);
    this._scrollCleanup = trackScroll(this, tag, this.configuration);
  }

  _connectStylesOnly() {
    try { ensureSiteCss(this._doc); } catch (e) { /* page CSS is a nicety */ }
    this.setAttribute("data-bbg-reg", "");
    this.setAttribute("data-bbg-reg-mode", "styles");
    this.style.display = "block";
    this.style.height = "0";
    this.style.overflow = "hidden";
    if (!this.shadowRoot.querySelector(".pk")) {
      const root = document.createElement("div");
      root.className = "pk";
      root.dataset.build = BUILD;
      root.setAttribute("aria-hidden", "true");
      this.shadowRoot.append(root);
    }
  }

  disconnectedCallback() {
    this._scrollCleanup?.();
    clearTimeout(this._retry);
    clearTimeout(this._graceTimer);
    clearTimeout(this._rowRetry);
    clearTimeout(this._dropTimer);
    this._injected?.remove();
    this._injected = null;
    this._dropTimer = 0;
    this._hasSteps = false;
    if (this._target) { registry(this._target).delete(this); syncPageStyles(this._target); }
    this._target = null;
    this._stepsObserver?.disconnect();
    this._stepsObserver = null;
    this._cleanups.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
    this._cleanups = [];
    this._unobserve.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
    this._unobserve = [];
  }

  onConfigurationUpdate(newConfig) {
    const wasStyles = this._cfg?.mode === "styles";
    this.configuration = newConfig || {};
    this._cfg = mergeRegConfig(this.configuration);
    this._resolvePage();
    // Switching to or from "Page styles only": start over, as on first load.
    if (wasStyles !== (this._cfg.mode === "styles")) {
      if (!wasStyles) this.disconnectedCallback();
      this.shadowRoot.innerHTML = "";
      this.removeAttribute("style");
      if (this.isConnected) this.connectedCallback();
      return;
    }
    if (this._cfg.mode === "styles") return;
    noteConfig(this, this.configuration);
    syncPageStyles(this._target || this._doc);
    const root = this.shadowRoot?.querySelector(".pk");
    if (root) this._renderInto(root);
  }

  // ---- registrant (first name, email) via the SDK's observe/read ------------
  _sdk(name) {
    if (this.cventSdk?.[name]) return this.cventSdk[name].bind(this.cventSdk);
    if (typeof this[name] === "function" && !(name in HTMLElement.prototype)) return this[name].bind(this);
    return undefined;
  }
  // True when the page being filled in asks for the first name (step 1): the
  // panel then keeps its plain heading, as in the mockup, even once a name is
  // typed or remembered from an earlier visit.
  _nameOnPage() {
    const t = this._target || this._doc;
    if (!t?.querySelectorAll) return false;
    return [...t.querySelectorAll("[class*=QuestionText__label]")].some((l) => {
      const c = (l.querySelector("[data-cvent-id=label]") || l).cloneNode(true);
      c.querySelectorAll("[class*=visuallyhidden], [class*=visuallyHidden], [class*=sr-only], [class*=QuestionText__required]").forEach((n) => n.remove());
      return /^first\s*name$/i.test(c.textContent.replace(/[*\u00a0]/g, " ").trim());
    });
  }
  // Post-registration pages: Cvent may not hand the widget the registrant's
  // name and email. A planner can place them on the page with Cvent's own data
  // tags, in a container with the class "bbg-person" (first name, then email,
  // one text block each); the widget reads them and the CSS hides the container.
  _personFromPage() {
    const t = this._target || this._doc;
    const box = t?.querySelector?.(".bbg-person") || this._doc.querySelector(".bbg-person");
    if (!box) return null;
    const bits = [...box.querySelectorAll("p, span, div")].filter((n) => !n.children.length).map((n) => n.textContent.trim()).filter(Boolean);
    const email = bits.find((x) => /@/.test(x)) || "";
    const first = bits.find((x) => !/@/.test(x) && !/[{}\[\]]/.test(x)) || "";
    return first || email ? { first, email } : null;
  }
  _syncPersonFromPage() {
    if (!this._showsPerson()) return;
    if (this._person.first && this._person.email) return;
    const p = this._personFromPage();
    if (!p) return;
    const next = { first: this._person.first || p.first, email: this._person.email || p.email };
    if (next.first === this._person.first && next.email === this._person.email) return;
    this._person = next;
    const root = this.shadowRoot?.querySelector(".pk");
    if (root && this._rendered) this._renderInto(root);
  }
  _watchPerson() {
    const apply = (v) => {
      const first = String(v?.FIRSTNAME ?? "").trim();
      const email = String(v?.EMAIL_ADDRESS ?? "").trim();
      if (first === this._person.first && email === this._person.email) return;
      this._person = { first, email };
      const root = this.shadowRoot?.querySelector(".pk");
      // Only the panel and the confirmation show the name or email. Redrawing
      // the banner on every keystroke emptied its step bar for a moment, which
      // made the whole page jump while typing.
      if (root && this._rendered && this._showsPerson()) this._renderInto(root);
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

  // ---- step bar -------------------------------------------------------------
  // Cvent's step bar lives in the registration header, and page content can't
  // go above the header. So the banner copy reads Cvent's bar (labels, current
  // step, which steps are clickable), draws its own copy under the banner, and
  // hides the original. Clicks on a finished step are passed to Cvent's own
  // step button, so Cvent's navigation and validation still apply.
  _cventStepBar() {
    return [...(this._target || this._doc).querySelectorAll(STEP_BAR)].find((el) => !this.contains(el)) || null;
  }
  _readSteps() {
    const bar = this._cventStepBar();
    if (!bar) return null;
    // Desktop list: older "ProgressBar__progressbar", newer ul[aria-label="Progress Bar"].
    const list = bar.querySelector("ul[class*=ProgressBar__progressbar]")
      || [...bar.querySelectorAll("ul")].find((ul) => ul.querySelector(":scope > li[aria-current], :scope > li [class*=Circle]"))
      || bar.querySelector("ul");
    const lis = list ? [...list.children].filter((li) => li.tagName === "LI") : [];
    if (!lis.length) return null;
    const cur = lis.findIndex((li) => li.getAttribute("aria-current") === "step");
    const labelOf = (li) => (li.querySelector("[class*=ProgressBar__progressText], [class*=progressText]")?.textContent || "").trim();
    return lis.map((li, i) => ({
      label: labelOf(li) || `Step ${i + 1}`,
      state: i === cur ? "current" : cur >= 0 && i < cur ? "done" : "todo",
      // Cvent's clickable part of a finished step.
      target: li.querySelector("[class*=ProgressBar__cursor], a[href], button, [role=button], [class*=completedCircle][class*=cursor], [class*=completedCircle]") || null,
    }));
  }
  _watchSteps() {
    if (typeof MutationObserver === "undefined") return;
    let timer = 0;
    const check = (force) => {
      timer = 0;
      const want = isBannerish(this) && this._cfg.banner?.showSteps !== false;
      const steps = want ? this._readSteps() : null;
      // Cvent redraws its bar between pages: a bar that goes missing for a
      // moment keeps ours (and Cvent's hidden) instead of flashing Cvent's.
      if (steps) { clearTimeout(this._dropTimer); this._dropTimer = 0; }
      else if (want && this._hasSteps && force !== true) {
        if (!this._dropTimer) this._dropTimer = setTimeout(() => { this._dropTimer = 0; check(true); }, 1000);
        this._markLayout();
        return;
      }
      const sig = steps ? steps.map((s) => `${s.label}|${s.state}|${s.target ? 1 : 0}`).join("~") : "";
      const had = !!this._hasSteps;
      this._steps = steps;
      this._hasSteps = !!steps;
      if (had !== this._hasSteps) syncPageStyles(this._target || this._doc);
      if (sig !== this._stepsSig) { this._stepsSig = sig; this._paintSteps(); }
      this._markLayout();
    };
    this._checkSteps = () => { if (!timer) timer = setTimeout(check, 60); };
    this._observeTarget();
    check();
  }
  // Side panel: mark the Cvent row that holds the form column and this panel's
  // column, so the page CSS can lay them out as form + 340px panel.
  // ---- form marks ---------------------------------------------------------
  // Cvent's DOM differs between the live page and Site Designer (the designer
  // wraps things for drag and drop), so the layout is not keyed on exact
  // parent/child structure. Instead the widget finds the pieces and marks them
  // with data-bbg-* attributes that the page CSS styles:
  //   data-bbg-pairrow / data-bbg-cell  fields that share a Cvent row
  //   data-bbg-halves / data-bbg-half   fields paired by the pairFields setting
  //   data-bbg-intro-h                  the intro heading (first text above the form)
  //   data-bbg-req                      the text block that gets "* Required"
  _setMarks(root, name, want) {
    root.querySelectorAll(`[${name}]`).forEach((e) => { if (!want.has(e)) e.removeAttribute(name); });
    want.forEach((v, e) => { if (e.getAttribute(name) !== v) e.setAttribute(name, v); });
  }
  _markFields() {
    const t = this._target || this._doc;
    const lca = (a, b) => { for (let n = a; n; n = n.parentElement) if (n.contains(b)) return n; return null; };
    const childToward = (anc, el) => { let n = el; while (n && n.parentElement !== anc) n = n.parentElement; return n; };
    const fields = [...t.querySelectorAll("[class*=Forms__container]")].filter((f) => !f.parentElement?.closest("[class*=Forms__container]"));

    // 1. Fields in one Cvent row (two columns) side by side.
    const pairRows = new Map(), cells = new Map();
    const byRow = new Map();
    fields.forEach((f) => {
      const col = f.closest("[class*=Grid__column]");
      const row = col?.parentElement?.closest("[class*=Grid__row]");
      if (!col || !row) return;
      if (!byRow.has(row)) byRow.set(row, []);
      if (!byRow.get(row).includes(col)) byRow.get(row).push(col);
    });
    byRow.forEach((cols) => {
      if (cols.length < 2) return;
      const anc = cols.slice(1).reduce((acc, c) => lca(acc, c), cols[0]);
      const branches = cols.map((c) => childToward(anc, c));
      if (!anc || branches.some((b) => !b) || new Set(branches).size !== branches.length) return;
      pairRows.set(anc, "");
      branches.forEach((b) => cells.set(b, ""));
    });
    this._setMarks(t, "data-bbg-pairrow", pairRows);
    this._setMarks(t, "data-bbg-cell", cells);

    // 2. Pairs from the setting (fields in separate Cvent rows, one after the other).
    const norm = (x) => String(x || "").replace(/\*/g, "").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim().toLowerCase();
    // The label's own words: Cvent adds a visually hidden "This question is
    // required." inside the label, which would break the match.
    const labelText = (l) => {
      const c = (l.querySelector("[data-cvent-id=label]") || l).cloneNode(true);
      c.querySelectorAll("[class*=visuallyhidden], [class*=visuallyHidden], [class*=sr-only], [class*=QuestionText__required]").forEach((n) => n.remove());
      return c.textContent;
    };
    const labels = new Map();
    t.querySelectorAll("[class*=QuestionText__label]").forEach((l) => {
      const txt = norm(labelText(l));
      if (txt && !labels.has(txt)) labels.set(txt, l);
    });
    const halves = new Map(), half = new Map();
    const stateKey = this._cfg.stateAfterCountry !== false ? norm(this._cfg.stateLabel || "State / region") : "";
    lines(this._cfg.pairFields).forEach((line) => {
      const [a, b] = line.split("+").map(norm);
      const la = labels.get(a), lb = labels.get(b);
      // Country stays full width until State / region is drawn; the two are
      // paired in the same frame State arrives (see _observeTarget), so the
      // switch to halves happens once, with no in-between paint.
      if (!a || !b || !la || !lb) return;
      if (b === stateKey && !this._countryAnswered()) return; // State is still held back
      const anc = lca(la, lb);
      const ra = childToward(anc, la), rb = childToward(anc, lb);
      if (!anc || !ra || !rb || ra === rb || ra.nextElementSibling !== rb || cells.has(ra) || cells.has(rb)) return;
      halves.set(anc, ""); half.set(ra, "1"); half.set(rb, "2");
    });
    this._setMarks(t, "data-bbg-halves", halves);
    this._setMarks(t, "data-bbg-half", half);

    // Cvent's allowed-characters hint under text fields ("Your answer can only
    // contain the following special characters: …"): not in the mockup.
    const hints = new Map();
    t.querySelectorAll("[class*=Forms__additionalText]").forEach((n) => {
      const sibs = [...(n.parentElement?.children || [])].filter((c) => /Forms__additionalText/.test(c.className));
      if (sibs.some((c) => /special characters/i.test(c.textContent))) hints.set(n, "");
    });
    this._setMarks(t, "data-bbg-hint", hints);
    // Empty paragraphs in text blocks (a stray Enter in Cvent's editor) would add
    // a blank line under the intro.
    const empties = new Map();
    t.querySelectorAll("[data-cvent-id^=widget-NucleusText] :is(p, div, h1, h2, h3, h4)").forEach((n) => {
      if (!n.textContent.replace(/\u00a0/g, " ").trim() && !n.querySelector("img, svg, iframe, video")) empties.set(n, "");
    });
    this._setMarks(t, "data-bbg-empty", empties);

    // Review page: Cvent's Registration Summary. Its form box has no
    // .left-align-fields, so the widget marks it (data-bbg-form); answer labels
    // get a clean copy (no asterisks, renamed per the setting) that the CSS
    // shows in place of Cvent's text; the text block between the summary and
    // the buttons is the consent line.
    const summary = t.querySelector("[data-cvent-id^=widget-RegistrationSummary]");
    const formBox = new Map(), sumLabel = new Map(), sumValue = new Map(), consent = new Map();
    if (summary) {
      const box = summary.closest(".left-align-fields") ? null : summary.closest("[data-cvent-id=containerParent]");
      if (box) formBox.set(box, "");
      const renames = new Map(lines((this._cfg.review || {}).labels).map((l) => l.split("=").map((x) => x.trim())).filter((kv) => kv.length === 2 && kv[0] && kv[1]).map(([a, b]) => [a.toLowerCase(), b]));
      summary.querySelectorAll("[class*=RegistrationSummary__body] [class*=Grid__column]").forEach((col) => {
        const item = col.firstElementChild;
        const lab = item?.firstElementChild, val = lab?.nextElementSibling;
        if (!lab || !val || /fieldStyles/.test(lab.className)) return;
        const raw = lab.textContent.replace(/\*/g, "").replace(/\s+/g, " ").trim();
        sumLabel.set(lab, renames.get(raw.toLowerCase()) || raw);
        sumValue.set(val, "");
      });
      const nav = t.querySelector("[class*=LinearNavigator__button]");
      t.querySelectorAll("[data-cvent-id^=widget-NucleusText]").forEach((tw) => {
        if (summary.compareDocumentPosition(tw) & Node.DOCUMENT_POSITION_FOLLOWING && (!nav || tw.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING) && tw.textContent.trim()) consent.set(tw, "");
      });
    }
    this._setMarks(t, "data-bbg-form", formBox);
    this._setMarks(t, "data-bbg-sum-label", sumLabel);
    this._setMarks(t, "data-bbg-sum-value", sumValue);
    this._setMarks(t, "data-bbg-consent", consent);

    // 3. Intro text above the first field (or the review summary): heading + "* Required".
    const introH = new Map(), req = new Map();
    const f0 = fields[0] || summary;
    if (f0) {
      let scope = f0.parentElement, tws = [];
      for (let i = 0; scope && i < 12; i++, scope = scope.parentElement) {
        tws = [...scope.querySelectorAll("[data-cvent-id^=widget-NucleusText]")]
          .filter((tw) => tw.compareDocumentPosition(f0) & Node.DOCUMENT_POSITION_FOLLOWING && tw.textContent.trim());
        if (tws.length) break;
      }
      this._introTws = tws;
      if (tws.length) {
        const hasHeading = tws.some((tw) => tw.querySelector("h1, h2, h3, h4"));
        if (!hasHeading) {
          const paras = (tw) => [...tw.querySelectorAll("p")].filter((p) => p.textContent.trim());
          if (tws.length >= 2) introH.set(tws[0], "block");
          else if (paras(tws[0]).length >= 2) introH.set(paras(tws[0])[0], "line");
        }
        if (t.querySelector("[class*=QuestionText__required]")) req.set(tws[tws.length - 1], "");
      }
    }
    this._setMarks(t, "data-bbg-intro-h", introH);
    this._setMarks(t, "data-bbg-req", req);
    // Every intro text block starts on the fields' left edge. Cvent pads text
    // blocks (and Site Designer may add its own layer), so after the CSS resets
    // any leftover offset is measured and taken out.
    const introAll = new Map();
    // What the intro lines up with: the first field label, or the first review card.
    const firstLabel = fields[0] ? f0.querySelector("[class*=QuestionText__label]") : (summary && (summary.querySelector("[class*=RegistrationSummary__attendee]") || summary));
    (f0 ? this._introTws || [] : []).forEach((tw) => introAll.set(tw, ""));
    this._setMarks(t, "data-bbg-intro", introAll);
    if (firstLabel) {
      const edge = firstLabel.getBoundingClientRect().left;
      introAll.forEach((_, tw) => {
        const txt = [...tw.querySelectorAll("h1, h2, h3, h4, p, li")].find((n) => n.getClientRects().length && n.textContent.trim()) || tw;
        const cur = parseFloat(tw.style.getPropertyValue("--bbg-intro-shift")) || 0;
        const off = Math.round(txt.getBoundingClientRect().left - edge);
        const next = Math.abs(off) <= 60 ? cur - off : 0;
        if (next !== cur) tw.style.setProperty("--bbg-intro-shift", `${next}px`);
      });
      // Vertical rhythm from the mockup, measured the same way (Cvent and Site
      // Designer add their own padding between blocks): 8px from the heading
      // to the intro line, and 28px from the intro / "* Required" to the first
      // field label.
      const textBox = (tw, last) => {
        const nodes = [...tw.querySelectorAll("h1, h2, h3, h4, p, li")].filter((n) => n.getClientRects().length && n.textContent.trim());
        const n = last ? nodes[nodes.length - 1] : nodes[0];
        return (n || tw).getBoundingClientRect();
      };
      const adjust = (el, prop, want, have) => {
        const cur = parseFloat(el.style.getPropertyValue(prop)) || 0;
        const next = Math.round(cur + (want - have));
        if (Math.abs(next - cur) >= 1 && Math.abs(next) <= 120) el.style.setProperty(prop, `${next}px`);
      };
      const list = [...introAll.keys()];
      for (let i = 1; i < list.length; i++) {
        const gap = textBox(list[i], false).top - textBox(list[i - 1], true).bottom;
        adjust(list[i], "--bbg-intro-gap", 8, gap);
      }
      const lastTw = list[list.length - 1];
      if (lastTw) {
        const bottom = lastTw.getBoundingClientRect().bottom; // includes the "* Required" line
        const gap = firstLabel.getBoundingClientRect().top - bottom;
        adjust(lastTw, "--bbg-intro-after", fields[0] ? 28 : 26, gap);
      }
    }
  }
  // Hide Cvent's own Modify / Cancel buttons that this copy's buttons stand in for
  // (their Site Designer column when it holds nothing else).
  _hideNatives() {
    const t = this._target || this._doc;
    const c = this._cfg.confirmation || {};
    const acts = new Set([c.primaryUrl, c.secondaryUrl, c.tertiaryUrl].map(nativeAction).filter(Boolean));
    acts.forEach((act) => {
      const el = findNative(t, act);
      if (!el) return;
      let box = el;
      while (box.parentElement && !box.parentElement.matches("[class*=Grid__row], [data-cvent-id=containerChild], body")
        && box.parentElement.querySelectorAll("a, button, [role=button], input, img, p").length <= 1) box = box.parentElement;
      if (!box.hasAttribute("data-bbg-native-hidden")) { box.setAttribute("data-bbg-native-hidden", act); box.style.setProperty("display", "none", "important"); }
    });
  }
  // ---- whole-page copy (one copy in a shared header) ---------------------------
  // _pageKind: the page this copy is on. A whole-page copy draws that page's
  // settings (pageConfig); other copies keep their own settings.
  _pagePath() { try { return (this._doc.defaultView || window).location.pathname || ""; } catch (e) { return ""; } }
  _resolvePage() {
    const base = mergeRegConfig(this.configuration);
    this._pathSeen = this._pagePath();
    const found = base.pageType === "auto" ? detectPageType(this._pathSeen, base.pageAddresses) : base.pageType;
    const covers = Array.isArray(base.covers) ? base.covers : [];
    // Site Designer (and its preview) isn't on a live ".../event/<site>/<page>"
    // address, so the page can't be read from it: a whole-page copy shows the
    // page picked in "Edit the wording for" there, as a preview.
    this._designer = base.mode === "page" && base.pageType === "auto" && !/\/event\/[^/]+\/[^/]+/.test(this._pathSeen);
    const preview = PAGE_PRESETS[base.editPage] && base.editPage !== "registration" ? base.editPage : "pending";
    // "?bbg-preview=denied" on any live page: that page exactly as it will
    // look (for pages only a registrant in that state can reach).
    let forced = "";
    try { forced = new URLSearchParams((this._doc.defaultView || window).location.search).get("bbg-preview") || ""; } catch (e) { /* none */ }
    if (base.mode === "page" && PAGE_PRESETS[forced] && forced !== "registration") { this._designer = false; this._forced = forced; } else this._forced = "";
    // A whole-page copy set to Automatic draws only the pages it covers.
    this._pageKind = this._forced || (this._designer ? preview
      : base.mode === "page" && base.pageType === "auto" && !covers.includes(found) ? "none" : found);
    if (this.isConnected) { this.setAttribute("data-bbg-page", this._pageKind); this.setAttribute("data-bbg-page-found", found); }
    this._idle = this._computeIdle(base);
    this._cfg = base.mode === "page" ? pageConfig(base, this._pageKind) : base;
  }
  // A whole-page copy steps aside on pages it doesn't cover, and on pages that
  // already have their own banner copy (the registration pages' page sections).
  _computeIdle(base = this._cfg) {
    if (base.mode !== "page") return false;
    if (this._designer || this._forced) return false;
    if (!PAGE_PRESETS[this._pageKind]) return true;
    const t = this._target || this._doc;
    return [...registry(t)].some((w) => w !== this && w.isConnected && w._cfg?.mode === "banner" && !w.hasAttribute("data-bbg-injected"));
  }
  _syncIdle() {
    const idle = this._computeIdle();
    if (idle === this._idle) return;
    this._idle = idle;
    if (idle) { this._injected?.remove(); this._injected = null; }
    const root = this.shadowRoot?.querySelector(".pk");
    this._newPage = true;
    if (root) this._renderInto(root);
    syncPageStyles(this._target || this._doc);
  }
  // Cvent moves between registration pages without reloading: follow it.
  _checkPageChange() {
    if (this._pagePath() === this._pathSeen) return;
    const was = this._pageKind;
    this._resolvePage();
    this._person = this._person || { first: "", email: "" };
    this._injected?.remove();
    this._injected = null;
    const root = this.shadowRoot?.querySelector(".pk");
    this._newPage = true;
    if (root && (was !== this._pageKind || this._rendered)) this._renderInto(root);
    syncPageStyles(this._target || this._doc);
  }
  // Form pages: a side panel copy beside Cvent's form, made by this copy.
  _syncInjectedPanel() {
    const t = this._target || this._doc;
    const want = this._cfg.mode === "page" && !this._idle && !this._designer && this._cfg.injectPanel !== false && !STATUS_PAGES.includes(this._pageKind);
    const form = want ? t.querySelector?.(".left-align-fields, [class*=Forms__container]") : null;
    if (!form) { this._injected?.remove(); this._injected = null; return; }
    // The form's outermost Cvent column inside its section: the panel goes next to it.
    let col = null;
    for (let n = form; n && !n.matches?.("[class*=Grid__sectionContainer], [role=main], body"); n = n.parentElement) if (n.matches?.("[class*=Grid__column]")) col = n;
    if (!col || !col.parentElement) return;
    if (this._injected?.isConnected && this._injected.previousElementSibling === col) return;
    if (!this._injected) {
      const cfg = { ...this._cfg, mode: "panel", pageType: this._pageKind, presetFor: this._pageKind, pages: {} };
      const el = new this.constructor({ configuration: cfg, theme: this.theme });
      const names = ["getEventInfo", "getSessionGenerator", "getSpeakers", "observe", "read"];
      el.cventSdk = this.cventSdk || Object.fromEntries(names.map((n) => [n, this._sdk(n)]).filter(([, f]) => f));
      el.setAttribute("data-bbg-injected", "");
      this._injected = el;
    }
    col.after(this._injected);
  }

  // Copies that show the registrant's name or email.
  _showsPerson() {
    const m = this._cfg.mode;
    return m === "panel" || m === "confirmation" || (m === "page" && !this._idle && STATUS_PAGES.includes(this._pageKind));
  }
  _markLayout() {
    if (this._cfg.mode === "page") { this._checkPageChange(); this._syncIdle(); }
    if (this._cfg.mode === "confirmation" || (this._cfg.mode === "page" && !this._idle && STATUS_PAGES.includes(this._pageKind))) this._hideNatives();
    if (this._cfg.mode === "page") this._syncInjectedPanel();
    this._syncPersonFromPage();
    this._markFields();
    this._syncStateField();
    if (this._cfg.mode !== "panel") return;
    if (this._rendered && this._person.first && this._greetBlocked !== undefined && this._greetBlocked !== this._nameOnPage()) {
      const root = this.shadowRoot.querySelector(".pk");
      if (root) this._renderInto(root);
    }
    // The site menu can appear after the panel first draws (Site Designer).
    if (this._rendered && !this._askRetried && !safeUrl(this._cfg.panel.contactUrl, "") && !this.shadowRoot.querySelector(".rg-ask") && this._siteContactLink()) {
      this._askRetried = true;
      const root = this.shadowRoot.querySelector(".pk");
      if (root) this._renderInto(root);
    }
    const FORM_BITS = ".left-align-fields, [class*=Forms__container], [class*=ButtonGroup__buttonGroup], [data-bbg-reg-mode=confirmation]";
    // Cvent may draw the other column after this one: look again for a while.
    clearTimeout(this._rowRetry);
    this._rowRetry = setTimeout(() => { if (this.isConnected && !this.closest("[data-bbg-reg-panelcol]") && (this._rowTries = (this._rowTries || 0) + 1) < 20) this._checkSteps?.(); }, 300);
    // The nearest ancestor whose parent also holds the form in another child:
    // that parent is the row, this ancestor the panel's column (wrappers allowed).
    for (let el = this; el && el.parentElement; el = el.parentElement) {
      const row = el.parentElement;
      const formCol = [...row.children].find((c) => c !== el && c.querySelector(FORM_BITS));
      if (!formCol) continue;
      this._setMarks(this._target || this._doc, "data-bbg-reg-row", new Map([[row, ""]]));
      this._setMarks(this._target || this._doc, "data-bbg-reg-panelcol", new Map([[el, ""]]));
      this._setMarks(this._target || this._doc, "data-bbg-reg-formcol", new Map([[formCol, ""]]));
      // Line the panel's top up with the top of the form's first text (the
      // heading), as in the mockup. Measured, since Cvent adds its own spacing.
      // The intro can also sit in its own row above the form's row (page 2):
      // then the panel moves up to it.
      const textIn = (scope) => [...scope.querySelectorAll("[data-bbg-intro-h], :is(h1, h2, h3, h4, p), [class*=QuestionText__label]")]
        .find((n) => n.getClientRects().length && n.textContent.trim());
      const intro0 = (this._introTws || [])[0];
      const first = (intro0 && intro0.isConnected && textIn(intro0)) || textIn(formCol);
      const rowTop = row.getBoundingClientRect().top;
      const delta = first ? Math.max(-600, Math.round(first.getBoundingClientRect().top - rowTop)) : 0;
      const val = `${delta}px`;
      if (el.style.getPropertyValue("--bbg-reg-panel-top") !== val) el.style.setProperty("--bbg-reg-panel-top", val);
      if (!this._rowRO && typeof ResizeObserver !== "undefined") {
        this._rowRO = new ResizeObserver(() => this._checkSteps?.());
        this._rowRO.observe(formCol);
        this._cleanups.push(() => { this._rowRO?.disconnect(); this._rowRO = null; });
      }
      return;
    }
  }
  // ---- State / region waits for Country (see stateAfterCountry) ----------
  // A field by its Cvent label: any case, asterisks, spacing around "/" and the
  // "This question is required." message ignored.
  _fieldByLabel(label) {
    const t = this._target || this._doc;
    const norm = (s) => String(s || "").replace(/\*/g, "").replace(/this question is required\.?/i, "").replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim().toLowerCase();
    const want = norm(label);
    if (!want) return null;
    return [...t.querySelectorAll("[class*=Forms__container]")].find((f) => {
      const l = f.querySelector("[data-cvent-id=label]") || f.querySelector("[class*=QuestionText__label], legend, label");
      return l && norm(l.textContent) === want;
    }) || null;
  }
  _countryAnswered(country = this._fieldByLabel(this._cfg.countryLabel || "Country")) {
    if (!country) return true;
    return !!(country.querySelector("[class*=singleValue]")?.textContent || "").trim() || !!country.querySelector("select")?.value;
  }
  _syncStateField() {
    const t = this._target || this._doc;
    const off = this._cfg.stateAfterCountry !== false;
    const country = off ? this._fieldByLabel(this._cfg.countryLabel || "Country") : null;
    const state = off ? this._fieldByLabel(this._cfg.stateLabel || "State / region") : null;
    let hide = null;
    if (country && state) {
      const answered = this._countryAnswered(country);
      // Hide the field's own slot: its half of a paired row, else the largest
      // wrapper that holds nothing but this field.
      if (!answered) {
        hide = state.closest("[data-bbg-half], [data-bbg-cell]");
        if (!hide) {
          hide = state;
          while (hide.parentElement && hide.parentElement.querySelectorAll("[class*=Forms__container]").length === 1
            && !hide.parentElement.matches("[data-bbg-reg-formcol], [class*=Container__childContainer]")) hide = hide.parentElement;
        }
      }
    }
    t.querySelectorAll("[data-bbg-state-wait]").forEach((e) => { if (e !== hide) { e.removeAttribute("data-bbg-state-wait"); e.removeAttribute("aria-hidden"); } });
    if (hide && !hide.hasAttribute("data-bbg-state-wait")) { hide.setAttribute("data-bbg-state-wait", ""); hide.setAttribute("aria-hidden", "true"); }
    // State / region fades in when it first shows (no pop).
    const shown = !!(state && !hide);
    if (shown && this._stateShown === false) {
      const slot = state.closest("[data-bbg-half], [data-bbg-cell]") || state;
      slot.setAttribute("data-bbg-fadein", "");
      setTimeout(() => slot.removeAttribute("data-bbg-fadein"), 400);
    }
    if (off) this._stateShown = shown;
  }
  _observeTarget() {
    if (!this._checkSteps || typeof MutationObserver === "undefined") return;
    this._stepsObserver?.disconnect();
    const t = this._target || this._doc;
    const node = isDoc(t) ? (t.body || t.documentElement) : t;
    // Fields Cvent adds (State / region after Country, other display logic)
    // are paired and marked in the same frame they arrive, before the browser
    // paints them, so nothing jumps; the rest waits for the debounced check.
    const isField = (n) => n.nodeType === 1 && (n.matches?.("[class*=Forms__container]") || !!n.querySelector?.("[class*=Forms__container]"));
    this._stepsObserver = new MutationObserver((muts) => {
      if (muts.some((m) => m.type === "childList" && ([...m.addedNodes].some(isField) || [...m.removedNodes].some(isField)))) {
        try { this._markFields(); this._syncStateField(); } catch (e) { /* the debounced pass retries */ }
      }
      this._checkSteps();
    });
    this._stepsObserver.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-current", "class"] });
  }
  _paintSteps() {
    const slot = this.shadowRoot?.querySelector(".rg-steps-slot");
    if (!slot) return;
    const steps = this._steps;
    if (!steps || !isBannerish(this) || this._cfg.banner?.showSteps === false) { slot.innerHTML = ""; return; }
    const cur = Math.max(0, steps.findIndex((s) => s.state === "current"));
    const tick = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
    slot.innerHTML = `
      <nav class="rg-steps pk-bleed" aria-label="Registration steps"><div class="pk-inner">
        <ol>${steps.map((s, i) => {
          const inner = `<span class="rg-n">${s.state === "done" ? tick : i + 1}</span><span class="rg-t">${esc(s.label)}</span>`;
          const bar = i ? `<li class="rg-bar${s.state !== "todo" ? " is-done" : ""}" aria-hidden="true"></li>` : "";
          return `${bar}<li class="rg-st is-${s.state}"${s.state === "current" ? ' aria-current="step"' : ""}>${s.target
            ? `<button type="button" data-step="${i}">${inner}<span class="pk-sr"> (completed, go back to this step)</span></button>`
            : `<span class="rg-s">${inner}</span>`}</li>`;
        }).join("")}</ol>
        <div class="rg-steps-m" aria-hidden="true"><p><b>${esc(steps[cur]?.label || "")}</b><span>Step ${cur + 1} of ${steps.length}</span></p><div class="rg-track"><i style="width:${Math.round(((cur + 1) / steps.length) * 100)}%"></i></div></div>
      </div></nav>`;
    slot.querySelectorAll("button[data-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = this._steps?.[Number(btn.dataset.step)];
        if (s?.target?.isConnected) s.target.click();
      });
    });
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
    const body = cfg.mode === "panel" ? this._panel(ctx) : cfg.mode === "confirmation" ? this._confirmation(ctx) : cfg.mode === "page" ? this._wholePage(ctx) : this._banner(ctx);
    this.setAttribute("data-bbg-reg-mode", cfg.mode);
    // A new page (whole-page copy) has its own height: don't hold the old one.
    const release = this._newPage ? (() => {}) : holdHeight(root);
    if (this._newPage) { root._pkHold = (root._pkHold || 0) + 1; root.style.minHeight = ""; this._newPage = false; }
    const bannerish = cfg.mode === "banner" || (cfg.mode === "page" && !this._idle);
    this.style.display = cfg.mode === "page" && this._idle ? "none" : "";
    root.className = `pk rg rg--${cfg.mode} ${dark ? "rg--dark" : ""} ${cfg.fullBleed !== false && bannerish ? "pk--bleed" : ""}`;
    root.innerHTML = `${css}${body}`;
    this._cleanups.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
    this._cleanups = [];
    if (bannerish && cfg.fullBleed !== false) this._cleanups.push(applyFullBleed(root));
    // Contact: Cvent's Contact Planner pop-up when that widget is on the page,
    // else the site menu's Contact page.
    this._cleanups.push(wirePlannerContact(root, { selector: cfg.panel.plannerContactSelector }));
    root.querySelectorAll("[data-site-contact]").forEach((b) => b.addEventListener("click", () => { if (!findPlannerContact(cfg.panel.plannerContactSelector)) this._siteContactLink()?.click(); }));
    this._rendered = true;
    syncPageStyles(this._target || this._doc);
    root.querySelectorAll("[data-site-page]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const want = a.dataset.sitePage === "agenda" ? /^\s*(agenda|program(me)?)\s*$/i : new RegExp(`^\\s*${a.dataset.sitePage}\\s*$`, "i");
      const t = this._target || this._doc;
      const link = [...t.querySelectorAll("[class*=WebsiteNavigator] [role=link], [class*=WebsiteNavigator__menuItem] > *, nav a[href], a[href]")].find((n) => want.test(n.textContent || "") && !this.contains(n));
      if (link) link.click(); else console.warn(`[reg-pages] No “${a.dataset.sitePage}” page in the site menu.`);
    }));
    root.querySelectorAll("[data-cvent-action]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const native = findNative(this._target || this._doc, a.dataset.cventAction);
      if (native) native.click();
      else console.warn(`[reg-pages] Cvent's ${a.dataset.cventAction === "cancel" ? "Cancel" : "Modify"} Registration button isn't on this page; add it in Site Designer.`);
    }));
    if (cfg.mode === "confirmation" || (cfg.mode === "page" && !this._idle && STATUS_PAGES.includes(this._pageKind))) this._hideNatives();
    if (cfg.mode === "page") this._syncInjectedPanel();
    // A side panel copy pairs with this copy's column once it exists: let it look again.
    if (cfg.mode === "confirmation") registry(this._target || this._doc).forEach((w) => { if (w !== this) w._checkSteps?.(); });
    // Draw the step bar straight away from what was last read, so a redraw
    // never leaves the banner without it (no height change, no jump).
    this._paintSteps();
    this._stepsSig = null;
    this._checkSteps?.();
    release();
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
    </section>
    <div class="rg-steps-slot"></div>`;
  }

  // ---- WHOLE PAGE (shared header copy) -----------------------------------------
  _wholePage(ctx) {
    if (this._idle) return "";
    const status = STATUS_PAGES.includes(this._pageKind);
    const label = (PAGE_TYPES.find(([k]) => k === this._pageKind) || [, this._pageKind])[1];
    const note = this._designer || this._forced ? `<p class="rg-designer-note" title="On the live site this copy shows only on its own pages. In Site Designer, pick the page to preview in “Edit the wording for”; on the live site add ?bbg-preview=<page> to any address.">Preview: ${esc(label)}</p>` : "";
    return `${note}${this._banner(ctx)}${status ? `
    <section class="pk-bleed rg-pagebody"><div class="pk-inner rg-pagegrid">
      <div class="rg-pagemain">${this._confirmation(ctx)}</div>
      ${this._panel(ctx)}
    </div></section>` : ""}`;
  }

  // ---- PANEL ------------------------------------------------------------------
  _panel({ cfg, facts, P, person }) {
    const p = cfg.panel;
    const greet = P("panel", "greeting", p.greeting);
    this._greetBlocked = this._nameOnPage();
    const heading = person.first && greet && !this._greetBlocked ? greet.replace(/\{first\}/g, person.first) : (P("panel", "heading", p.heading) || facts.title);
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
      ${cLabel && cUrl ? `<p class="rg-ask">${esc(P("panel", "contactText", p.contactText))} <a href="${esc(cUrl)}"${/^mailto:/i.test(cUrl) ? " data-planner-contact" : ""}${isExternal(cUrl) ? ' target="_blank" rel="noopener"' : ""}>${esc(cLabel)}</a></p>`
        : cLabel && (this._siteContactLink() || findPlannerContact(p.plannerContactSelector)) ? `<p class="rg-ask">${esc(P("panel", "contactText", p.contactText))} <button type="button" class="rg-ask-btn" data-site-contact data-planner-contact>${esc(cLabel)}</button></p>` : ""}
    </aside>`;
  }

  // The site menu's "Contact" item (Cvent renders menu items as role="link"
  // elements without an href, so the panel clicks the item itself).
  _siteContactLink() {
    const t = this._target || this._doc;
    return [...t.querySelectorAll("a[href], [role=link], [class*=WebsiteNavigator__menuItem] > *")].find((e) => /^\s*contact( us)?\s*$/i.test(e.textContent || "") && !this.contains(e)) || null;
  }

  // ---- CONFIRMATION -------------------------------------------------------------
  _confirmation({ cfg, P, person, lang, facts }) {
    const c = cfg.confirmation;
    const ev = (x) => String(x || "").replace(/\{event\}/g, facts?.title || "").replace(/\{date\}/g, facts?.dateLong || "").replace(/\{time\}/g, [facts?.timeRange, facts?.tzShort].filter(Boolean).join(" "));
    const heading = ev(person.first
      ? P("confirmation", "heading", c.heading).replace(/\{first\}/g, person.first)
      : P("confirmation", "headingNoName", c.headingNoName));
    // The email is set in bold; everything else is escaped text.
    const rawBody = ev(person.email ? P("confirmation", "body", c.body) : P("confirmation", "bodyNoEmail", c.bodyNoEmail));
    const body = esc(rawBody).replace(/\{email\}/g, `<b>${esc(person.email)}</b>`).replace(/\{first\}/g, esc(person.first));
    const steps = lines(ev(P("confirmation", "steps", c.steps))).map((l) => {
      const i = l.indexOf("|");
      return i < 0 ? { t: l, d: "" } : { t: l.slice(0, i).trim(), d: l.slice(i + 1).trim() };
    });
    const btn = (label, url, primary) => {
      // "#modify" / "#cancel": Cvent's own Modify / Cancel Registration button
      // on this page does the work (its link is per attendee); ours stands in.
      const act = nativeAction(url);
      const cls = `pk-btn pk-btn--lg ${primary ? "pk-btn--primary" : "pk-btn--secondary"} ${cfg.theme === "dark" ? "pk-btn--on-dark" : "pk-btn--on-light"}`;
      if (/^#contact$/i.test(String(url || "").trim())) return label ? `<a class="${cls}" href="#" data-planner-contact>${esc(label)}</a>` : "";
      if (/^#(agenda|home|speakers|venue)$/i.test(String(url || "").trim())) return label ? `<a class="${cls}" href="#" data-site-page="${esc(String(url).trim().slice(1).toLowerCase())}">${esc(label)}</a>` : "";
      if (act) return label ? `<a class="pk-btn pk-btn--lg ${primary ? "pk-btn--primary" : "pk-btn--secondary"} ${cfg.theme === "dark" ? "pk-btn--on-dark" : "pk-btn--on-light"}" href="#" role="button" data-cvent-action="${act}">${esc(label)}</a>` : "";
      const u = safeUrl(url, "");
      if (!label || !u) return "";
      const ext = isExternal(u);
      return `<a${/^mailto:/i.test(u) ? " data-planner-contact" : ""} class="pk-btn pk-btn--lg ${primary ? "pk-btn--primary" : "pk-btn--secondary"} ${cfg.theme === "dark" ? "pk-btn--on-dark" : "pk-btn--on-light"}" href="${esc(u)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(label)}${ext ? `<span class="pk-sr"> ${esc(fixed(lang, "opensNewTab"))}</span>` : ""}</a>`;
    };
    const btns = btn(P("confirmation", "primaryLabel", c.primaryLabel), c.primaryUrl, true) + btn(P("confirmation", "secondaryLabel", c.secondaryLabel), c.secondaryUrl, false);
    const qLabel = P("confirmation", "tertiaryLabel", c.tertiaryLabel), qAct = nativeAction(c.tertiaryUrl), qUrl = qAct ? "#" : safeUrl(c.tertiaryUrl, "");
    const quiet = qLabel && qUrl ? `<a class="rg-quiet" href="${esc(qUrl)}"${qAct ? ` role="button" data-cvent-action="${qAct}"` : isExternal(qUrl) ? ' target="_blank" rel="noopener"' : ""}>${esc(qLabel)}</a>` : "";
    const cTitle = ev(P("confirmation", "calloutTitle", c.calloutTitle)).trim();
    const cText = ev(P("confirmation", "calloutText", c.calloutText)).trim();
    const done = Math.max(0, Math.min(steps.length, Math.round(Number(c.stepsDone ?? 1)) || 0));
    return `
    <section class="rg-done" aria-label="${esc(heading)}">
      ${c.showTick !== false ? '<div class="rg-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' : ""}
      <h2 class="rg-dh">${esc(heading)}</h2>
      ${rawBody ? `<p class="rg-dp">${body}</p>` : ""}
      ${steps.length ? `<ol class="rg-tl">${steps.map((s, i) => `<li><i class="${i < done ? "on" : ""}" aria-hidden="true"></i><div><b>${esc(s.t)}</b>${s.d ? `<span>${esc(s.d)}</span>` : ""}</div></li>`).join("")}</ol>` : ""}
      ${cTitle || cText ? `<div class="rg-callout">${cTitle ? `<b>${esc(cTitle)}</b>` : ""}${cText ? `<span>${esc(cText)}</span>` : ""}</div>` : ""}
      ${btns || quiet ? `<div class="rg-btns">${btns}${quiet}</div>` : ""}
    </section>`;
  }
}

// ---------------------------------------------------------------------------
// This widget's own (shadow) CSS. Light is the default; .rg--dark flips it.
// ---------------------------------------------------------------------------
const t = TOKENS;
const WIDGET_CSS = `
  .rg { --rg-ink: ${t.ink}; --rg-body: ${t.body}; --rg-muted: ${t.muted}; --rg-hair: ${t.hair}; --rg-panel: ${t.tint}; --rg-accent: ${t.amber}; --rg-link: ${t.action}; --rg-label: ${t.amber}; --rg-dot-bg: #fff; --rg-ground: #FFFFFF; --rg-ctl: #8A8A86; --rg-accent-ink: #0B0B0C; --rg-faint: #6F6F6D; }
  .rg--dark { --rg-ink: #fff; --rg-body: rgba(255,255,255,.78); --rg-muted: rgba(255,255,255,.66); --rg-hair: rgba(255,255,255,.14); --rg-panel: ${t.panel}; --rg-accent: ${t.amberOnDark}; --rg-link: ${t.linkOnDark}; --rg-label: ${t.amber}; --rg-dot-bg: transparent; --rg-ground: #0B0B0C; --rg-ctl: rgba(255,255,255,.38); --rg-accent-ink: #0B0B0C; --rg-faint: rgba(255,255,255,.55); }
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
  .rg-panel { max-width: 420px; box-sizing: border-box; background: var(--rg-panel); border-top: 3px solid ${t.amberOnDark}; padding: 28px; }
  .rg-eb { font-size: ${LABEL_PX.small}px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--rg-label); }
  .rg-ph { margin-top: 8px; font-size: 21px; line-height: 1.25; font-weight: 700; letter-spacing: -0.01em; color: var(--rg-ink); }
  .rg-dl { margin: 18px 0 0; display: grid; gap: 14px; }
  .rg-dl dt { font-size: ${LABEL_PX.small}px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--rg-label); }
  .rg-dl dd { margin: 2px 0 0; font-size: 15.5px; color: var(--rg-ink); }
  .rg-dl dd span { display: block; font-size: 14px; color: var(--rg-body); }
  .rg-next { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--rg-hair); }
  .rg-next ol { list-style: none; margin: 10px 0 0; padding: 0; counter-reset: n; display: grid; gap: 10px; }
  .rg-next li { counter-increment: n; display: grid; grid-template-columns: 24px 1fr; gap: 8px; font-size: 14.5px; line-height: 1.45; color: var(--rg-body); }
  .rg-next li::before { content: counter(n); width: 22px; height: 22px; border-radius: 50%; background: var(--rg-dot-bg); border: 1px solid var(--rg-hair); display: grid; place-items: center; font-size: 12px; font-weight: 700; color: var(--rg-ink); }
  .rg-ask { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--rg-hair); font-size: 14.5px; color: var(--rg-body); }
  .rg-ask a { color: var(--rg-link); font-weight: 700; text-decoration: none; }
  .rg-ask a:hover, .rg-ask-btn:hover { text-decoration: underline; }
  .rg-ask-btn { font: inherit; font-weight: 700; color: var(--rg-link); background: none; border: 0; padding: 0; cursor: pointer; }

  /* confirmation */
  .rg-done { max-width: 680px; padding: 8px 0; }
  .rg-tick { width: 52px; height: 52px; border-radius: 50%; background: rgba(255,157,0,.16); display: grid; place-items: center; margin-bottom: 18px; }
  .rg--dark .rg-tick { background: rgba(255,157,0,.16); }
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
  .rg-btns { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 28px; }
  .rg-quiet { margin-left: auto; font-size: 14px; font-weight: 600; color: var(--rg-muted); text-decoration: underline; text-underline-offset: 3px; }
  .rg-quiet:hover { color: var(--rg-link); }
  .rg-quiet:focus-visible { outline: 3px solid rgba(43,108,232,.45); outline-offset: 2px; }
  .rg-callout { margin-top: 26px; padding: 20px 22px; border: 1px solid var(--rg-hair); border-radius: 2px; display: grid; gap: 4px; }
  .rg-callout b { font-size: 16px; color: var(--rg-ink); }
  .rg-callout span { font-size: 15px; line-height: 1.5; color: var(--rg-body); }
  /* Preview label: floats over the banner's corner so the layout is exactly the live one. */
  .rg--page { position: relative; }
  .rg-designer-note { position: absolute; z-index: 5; top: 8px; right: 8px; margin: 0; padding: 4px 10px; border-radius: 2px; background: #FF9D00; color: #0B0B0C; font-size: 12px; font-weight: 700; line-height: 1.4; pointer-events: auto; }
  /* whole page: status copy + side panel under the banner */
  .rg-pagebody { background: var(--rg-ground); }
  .rg-pagegrid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; column-gap: 56px; align-items: start; padding-top: 48px; padding-bottom: 72px; }
  .rg-pagegrid > .rg-panel { position: sticky; top: 96px; }
  @media (max-width: 1023px) { .rg-pagegrid { grid-template-columns: minmax(0, 1fr); row-gap: 32px; padding-top: 32px; padding-bottom: 48px; } .rg-pagegrid > .rg-panel { position: static; } }
  /* step bar under the banner (drawn from Cvent's own, which is hidden) */
  .rg-steps { background: var(--rg-ground); border-bottom: 1px solid var(--rg-hair); }
  .rg--dark .rg-steps { border-top: 1px solid var(--rg-hair); }
  /* mockup: circle + label side by side, a thin line between steps */
  .rg-steps .pk-inner { padding-top: 20px; padding-bottom: 20px; }
  .rg-steps ol { list-style: none; margin: 0; padding: 0; display: flex; align-items: center; }
  .rg-st { flex: none; }
  .rg-bar { flex: 1; min-width: 40px; height: 1.5px; margin: 0 16px; background: var(--rg-hair); }
  .rg-bar.is-done { background: var(--rg-ink); }
  .rg-steps .rg-s, .rg-steps button { display: inline-flex; align-items: center; gap: 10px; padding: 0; background: none; border: 0; font: inherit; color: inherit; white-space: nowrap; }
  .rg-steps button { cursor: pointer; }
  .rg-steps button:hover .rg-t { text-decoration: underline; text-underline-offset: 3px; }
  .rg-steps button:focus-visible { outline: 3px solid #2B6CE8; outline-offset: 3px; border-radius: 2px; }
  .rg-n { width: 28px; height: 28px; border-radius: 50%; box-sizing: border-box; flex-shrink: 0; display: grid; place-items: center; font-size: 13px; font-weight: 700; border: 1.5px solid #C9C9C4; background: var(--rg-ground); color: var(--rg-faint); }
  .rg--dark .rg-n { border-color: rgba(255,255,255,.3); background: transparent; }
  .rg-n svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2.6; }
  .is-current .rg-n { background: var(--rg-accent); border-color: var(--rg-accent); color: var(--rg-accent-ink); }
  .is-done .rg-n { background: var(--rg-ink); border-color: var(--rg-ink); color: var(--rg-ground); }
  .rg-t { font-size: 14px; font-weight: 600; color: var(--rg-faint); }
  .is-current .rg-t, .is-done .rg-t { color: var(--rg-ink); }
  .rg-steps-m { display: none; }
  .rg-steps-m p { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 14px; }
  .rg-steps-m b { font-weight: 700; color: var(--rg-ink); }
  .rg-steps-m span { font-size: 13px; color: var(--rg-muted); }
  .rg-track { margin-top: 8px; height: 4px; border-radius: 2px; background: var(--rg-hair); overflow: hidden; }
  .rg-track i { display: block; height: 100%; background: var(--rg-accent); }
  @media (max-width: 767px) {
    .rg-steps .pk-inner { padding-top: 14px; padding-bottom: 14px; }
    .rg-steps ol { display: none; }
    .rg-steps-m { display: block; }
  }
  @media (max-width: 600px) {
    .rg-meta { flex-direction: column; align-items: flex-start; gap: 2px; font-size: 15px; }
    .rg-meta i { display: none; }
    .rg-panel { padding: 22px 20px; }
    .rg-btns .pk-btn { width: 100%; }
    .rg-quiet { margin: 6px auto 0; }
  }
`;
