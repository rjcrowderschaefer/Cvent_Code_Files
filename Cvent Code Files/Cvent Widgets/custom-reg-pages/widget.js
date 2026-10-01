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
  kitCss, applyFullBleed, mergePageConfig, LABEL_PX,
} from "./page-kit.js";
import { REG_FORM_CSS, regFormCss } from "./reg-form-css.js";

export const BUILD = "reg-2026-10-01e";

export const REG_DEFAULTS = {
  mode: "banner",            // "banner" | "panel" | "confirmation"
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
    nextSteps: "Send your request. It takes about two minutes.\nOur team reviews every request to attend.\nYou’ll get an email with our decision and your event details.",
    contactText: "Questions?",
    contactLabel: "Contact the Bloomberg team",
    contactUrl: "",          // a page link or mailto:; blank = the site's "Contact" menu item
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
  const out = mergePageConfig(REG_DEFAULTS, incoming);
  // Earlier default, saved into existing copies by the editor: update it.
  if (out.panel.contactLabel === "Contact the event team") out.panel.contactLabel = REG_DEFAULTS.panel.contactLabel;
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
  const active = [...set].filter((w) => w.isConnected && w._cfg?.styleForm !== false);
  const els = stateEls(t);
  let tag = isDoc(t) ? t.getElementById(STYLE_ID) : t.querySelector(`#${STYLE_ID}`);
  if (!active.length) {
    tag?.remove();
    els.forEach((e) => { e.classList.remove(ROOT_CLASS, HTML_ON, HTML_DARK, HTML_HIDE_OLD, HTML_OWN_STEPS, HTML_READY, HTML_HIDE_REGTYPE, HTML_REQ_NOTE, HTML_INTRO_H, HTML_NO_HINTS); e.style.removeProperty("--bbg-reg-req"); e.style.removeProperty("--bbg-reg-optin-help"); ["--bbg-sum-contact", "--bbg-sum-about", "--bbg-sum-name", "--bbg-sum-email"].forEach((k) => e.style.removeProperty(k)); });
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
  const lead = active.find((w) => w._cfg.mode === "banner") || active[0];
  const dark = lead._cfg.theme === "dark";
  const hideOld = active.some((w) => w._cfg.hideOldHeader !== false);
  const ownSteps = active.some((w) => w._cfg.mode === "banner" && w._cfg.banner?.showSteps !== false && w._hasSteps);
  const ready = active.some((w) => w._rendered);
  els.forEach((e) => {
    if (!isDoc(t)) e.classList.add(ROOT_CLASS);
    e.classList.add(HTML_ON);
    e.classList.toggle(HTML_DARK, dark);
    e.classList.toggle(HTML_HIDE_OLD, hideOld);
    e.classList.toggle(HTML_OWN_STEPS, ownSteps);
    e.classList.toggle(HTML_READY, ready);
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
    this.setAttribute("data-bbg-reg", "");
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
  }

  disconnectedCallback() {
    clearTimeout(this._retry);
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
    this.configuration = newConfig || {};
    this._cfg = mergeRegConfig(this.configuration);
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
      if (root && this._rendered && this._cfg.mode !== "banner") this._renderInto(root);
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
    const check = () => {
      timer = 0;
      const steps = this._cfg.mode === "banner" && this._cfg.banner?.showSteps !== false ? this._readSteps() : null;
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
    lines(this._cfg.pairFields).forEach((line) => {
      const [a, b] = line.split("+").map(norm);
      const la = labels.get(a), lb = labels.get(b);
      if (!a || !b || !la || !lb) return;
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
  _markLayout() {
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
    const FORM_BITS = ".left-align-fields, [class*=Forms__container], [class*=ButtonGroup__buttonGroup]";
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
  _syncStateField() {
    const t = this._target || this._doc;
    const off = this._cfg.stateAfterCountry !== false;
    const country = off ? this._fieldByLabel(this._cfg.countryLabel || "Country") : null;
    const state = off ? this._fieldByLabel(this._cfg.stateLabel || "State / region") : null;
    let hide = null;
    if (country && state) {
      const answered = !!(country.querySelector("[class*=singleValue]")?.textContent || "").trim()
        || !!country.querySelector("select")?.value;
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
  }
  _observeTarget() {
    if (!this._checkSteps || typeof MutationObserver === "undefined") return;
    this._stepsObserver?.disconnect();
    const t = this._target || this._doc;
    const node = isDoc(t) ? (t.body || t.documentElement) : t;
    this._stepsObserver = new MutationObserver(this._checkSteps);
    this._stepsObserver.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-current", "class"] });
  }
  _paintSteps() {
    const slot = this.shadowRoot?.querySelector(".rg-steps-slot");
    if (!slot) return;
    const steps = this._steps;
    if (!steps || this._cfg.mode !== "banner" || this._cfg.banner?.showSteps === false) { slot.innerHTML = ""; return; }
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
    const body = cfg.mode === "panel" ? this._panel(ctx) : cfg.mode === "confirmation" ? this._confirmation(ctx) : this._banner(ctx);
    this.setAttribute("data-bbg-reg-mode", cfg.mode);
    root.className = `pk rg rg--${cfg.mode} ${dark ? "rg--dark" : ""} ${cfg.fullBleed !== false && cfg.mode === "banner" ? "pk--bleed" : ""}`;
    root.innerHTML = `${css}${body}`;
    this._cleanups.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
    this._cleanups = [];
    if (cfg.mode === "banner" && cfg.fullBleed !== false) this._cleanups.push(applyFullBleed(root));
    root.querySelectorAll("[data-site-contact]").forEach((b) => b.addEventListener("click", () => this._siteContactLink()?.click()));
    this._rendered = true;
    syncPageStyles(this._target || this._doc);
    // Draw the step bar straight away from what was last read, so a redraw
    // never leaves the banner without it (no height change, no jump).
    this._paintSteps();
    this._stepsSig = null;
    this._checkSteps?.();
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
      ${cLabel && cUrl ? `<p class="rg-ask">${esc(P("panel", "contactText", p.contactText))} <a href="${esc(cUrl)}"${isExternal(cUrl) ? ' target="_blank" rel="noopener"' : ""}>${esc(cLabel)}</a></p>`
        : cLabel && this._siteContactLink() ? `<p class="rg-ask">${esc(P("panel", "contactText", p.contactText))} <button type="button" class="rg-ask-btn" data-site-contact>${esc(cLabel)}</button></p>` : ""}
    </aside>`;
  }

  // The site menu's "Contact" item (Cvent renders menu items as role="link"
  // elements without an href, so the panel clicks the item itself).
  _siteContactLink() {
    const t = this._target || this._doc;
    return [...t.querySelectorAll("a[href], [role=link], [class*=WebsiteNavigator__menuItem] > *")].find((e) => /^\s*contact( us)?\s*$/i.test(e.textContent || "") && !this.contains(e)) || null;
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
  .rg-btns { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
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
  }
`;
