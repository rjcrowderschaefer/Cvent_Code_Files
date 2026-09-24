// Editor UI shown to the Cvent planner in Site Designer when they add or
// select this widget.
//
// Option 1's link is ASSEMBLED HERE, not pasted. The planner supplies the
// base form URL plus the Hive9 taxonomy inputs, and this file writes the
// finished URL into configuration.demoUrl, which is the only thing widget.js
// reads. If the inputs are incomplete or a code is missing, demoUrl is set to
// "" on purpose, and widget.js then falls back to the untracked base URL so
// the button still works. Partial tracking is never emitted - the link is
// either fully tagged or not tagged at all, never mis-tagged.
//
// "Contact Us" links out to Bloomberg's own form (it cannot be embedded - see
// the header of widget.js). "Submit a question" is still mocked: it validates
// and confirms but posts nowhere.

// ---------------------------------------------------------------------------
// HIVE9 TAXONOMY. These are the only values that decide campaign attribution.
// ---------------------------------------------------------------------------

// utm_source and utm_medium are fixed for this widget: it is always a Cvent
// event page, always general promotion. Shown to the planner, not editable.
const PROMO_WHERE = { label: "Cvent", code: "cvnt" };
const PROMO_HOW = { label: "General / External Promotion", code: "genpro" };

// utm_campaign. Supplied by RJ; "comp" was already confirmed by the example
// URL. A null code here blocks URL generation rather than guessing, because a
// wrong code is invisible until someone reads a campaign report - so any plan
// added later must arrive with its code.
const PLAN_CODES = [
  { label: "BNEF", code: "bnef" },
  { label: "BQuant", code: "bquant" },
  { label: "Buy-side Products", code: "bside" },
  { label: "Corporations", code: "corp" },
  { label: "Electronic Trading", code: "elctrd" },
  { label: "Enterprise Data & Tech", code: "tchdat" },
  { label: "Indices", code: "indices" },
  { label: "Reg & Compliance", code: "comp" },
  { label: "Sell-side Products", code: "sside" },
  { label: "Terminal", code: "trmnl" },
];

// utm_content is this code, an underscore, then the free-text description.
// "livepro" is confirmed from the example; "virtpro" mirrors it.
const CONTENT_TYPES = [
  { label: "Promotion During Event (In-Person Event)", code: "livepro" },
  { label: "Promotion During Event (Virtual Event)", code: "virtpro" },
];

// The "Already a customer?" destination. Constant across every event, so the
// planner sees it but cannot edit it.
const SUPPORT_URL = "https://professional.bloomberg.com/support/customer-support/";

const DESC_MAX = 30;
const DESC_RE = /^[a-z0-9-]+$/;
const TACTIC_RE = /^[0-9]{7}$/;

// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    title: "Option 1 - Contact / Request a demo",
    open: true,
    preview: "_urlBox",
    fields: [
      {
        key: "demoBaseUrl",
        label: "Form URL",
        placeholder: "https://professional.bloomberg.com/...#contact-us",
        multiline: true,
        hint: "The page to open, including its #contact-us anchor. Tracking parameters are added automatically from the fields below - do not paste them here.",
      },
      {
        key: "promoWhere",
        type: "fixed",
        label: "Where will you be promoting this link?",
        value: PROMO_WHERE.label,
        hint: "Fixed for this widget. Sets utm_source=" + PROMO_WHERE.code + ".",
      },
      {
        key: "promoHow",
        type: "fixed",
        label: "How will you be promoting this link?",
        value: PROMO_HOW.label,
        hint: "Fixed for this widget. Sets utm_medium=" + PROMO_HOW.code + ".",
      },
      {
        key: "planCode",
        type: "select",
        label: "What plan is this campaign aligned to?",
        options: PLAN_CODES.map((p) => p.label),
        hint: "Sets utm_campaign.",
      },
      {
        key: "contentType",
        type: "select",
        label: "What type of content will this be?",
        options: CONTENT_TYPES.map((t) => t.label),
        hint: "Sets the first half of utm_content.",
      },
      {
        key: "contentDesc",
        label: "How would you describe this content?",
        placeholder: "reg-contact-form",
        maxlength: DESC_MAX,
        hint:
          "Up to " + DESC_MAX + " characters. Lowercase letters, numbers and dashes only. " +
          "Becomes the second half of utm_content.",
      },
      {
        key: "tacticId",
        label: "What is the Hive9 tactic ID?",
        placeholder: "1065635",
        maxlength: 7,
        numeric: true,
        hint: "Exactly 7 digits. Sets tactic.",
      },
      { subhead: "Wording" },
      { key: "demoLabel", label: "Menu label", placeholder: "Contact Us" },
      {
        key: "demoIntro",
        label: "Intro copy",
        placeholder: "To learn how Bloomberg's global policy and regulatory team...",
        multiline: true,
      },
      { key: "demoCtaText", label: "Button text", placeholder: "Open the contact form" },
    ],
  },
  {
    title: "Option 2 - Contact Bloomberg",
    open: false,
    preview: "_supportBox",
    fields: [
      {
        key: "showContact",
        type: "checkbox",
        default: true,
        label: "Show Option 2",
        hint: "Untick to remove the phone and email panel from the menu.",
      },
      { key: "contactLabel", label: "Menu label", placeholder: "Contact Bloomberg" },
      { key: "phoneAmericas", label: "Americas phone", placeholder: "+1 212 318 2000" },
      { key: "phoneEmea", label: "EMEA phone", placeholder: "+44 20 7330 7500" },
      { key: "phoneApac", label: "Asia Pacific phone", placeholder: "+65 6212 1000" },
      { key: "eventEmail", label: "Event team email", placeholder: "events@bloomberg.net" },
      {
        key: "supportUrl",
        type: "fixed",
        label: "Customer support URL",
        value: SUPPORT_URL,
        hint:
          "Behind the 'Already a customer?' card. The same for every event, so it is not " +
          "editable. It picks up the same tracking as Option 1.",
      },
    ],
  },
  {
    title: "Option 3 - Submit a question",
    open: false,
    fields: [
      {
        key: "showQuestion",
        type: "checkbox",
        default: true,
        label: "Show Option 3",
        hint:
          "Untick to remove it. Its form is still a preview and posts nowhere, so leave " +
          "this off unless a destination has been connected.",
      },
      { key: "questionLabel", label: "Menu label", placeholder: "Submit a question" },
      {
        key: "questionTopics",
        label: "Question topics",
        placeholder: "Fixed income, Macro & policy",
        multiline: true,
        hint: "Comma-separated. Should mirror this event's themes so questions route to the right moderator.",
      },
    ],
  },
  {
    title: "Button",
    open: false,
    fields: [
      {
        key: "hintText",
        label: "Hover hint",
        placeholder: "Connect with Bloomberg",
        hint: "Appears above the button on hover, and is the button's screen-reader label.",
      },
    ],
  },
  {
    title: "Attention nudge",
    open: false,
    fields: [
      {
        key: "nudgeEnabled",
        type: "checkbox",
        default: true,
        label: "Nudge visitors",
        hint: "The button pings and expands to show its CTA. Stops for good once they hover or open it.",
      },
      {
        key: "nudgeDelaySeconds",
        label: "Seconds before the first nudge",
        placeholder: "5",
        hint: "Counted from when the page finishes loading.",
      },
      { key: "nudgeCount", label: "How many times", placeholder: "3", hint: "Set to 0 to disable." },
      { key: "nudgeIntervalSeconds", label: "Seconds between nudges", placeholder: "12", hint: "Minimum 3." },
      {
        key: "nudgeCtaText",
        label: "Nudge CTA text",
        placeholder: "Want to learn more?",
        hint: "Revealed when the button expands leftwards during a nudge.",
      },
    ],
  },
];

// Widgets configured before the taxonomy fields existed carry a finished
// demoUrl and nothing else. Recover the base from it so the planner keeps
// their page and only has to answer the new questions - otherwise their first
// edit to any unrelated field would rebuild demoUrl from nothing and silently
// drop the button off a live page.
function baseFromLegacyUrl(url) {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "tactic"].forEach((k) =>
      u.searchParams.delete(k)
    );
    return u.href;
  } catch (err) {
    return "";
  }
}

// The five tracking parameters, shared by both outbound links. Returns no
// params at all unless every input is valid - there is no partial answer.
function taxonomy(cfg) {
  const problems = [];
  const plan = PLAN_CODES.find((p) => p.label === cfg.planCode);
  const type = CONTENT_TYPES.find((t) => t.label === cfg.contentType);
  const desc = String(cfg.contentDesc == null ? "" : cfg.contentDesc).trim();
  const tactic = String(cfg.tacticId == null ? "" : cfg.tacticId).trim();

  if (!plan) problems.push("Choose a plan.");
  else if (!plan.code) {
    problems.push(
      'No utm_campaign code on file for "' + plan.label + '". Add it to PLAN_CODES in editor.js.'
    );
  }
  if (!type) problems.push("Choose a content type.");
  if (!desc) problems.push("Describe the content.");
  else if (!DESC_RE.test(desc)) problems.push("Description: lowercase letters, numbers and dashes only.");
  else if (desc.length > DESC_MAX) problems.push("Description: " + DESC_MAX + " characters maximum.");
  if (!tactic) problems.push("Tactic ID is required.");
  else if (!TACTIC_RE.test(tactic)) problems.push("Tactic ID must be exactly 7 digits.");

  if (problems.length) return { problems, params: [] };
  return {
    problems,
    params: [
      ["utm_source", PROMO_WHERE.code],
      ["utm_medium", PROMO_HOW.code],
      ["utm_campaign", plan.code],
      ["utm_content", type.code + "_" + desc],
      ["tactic", tactic],
    ],
  };
}

// Stamp params onto a URL, clearing any tracking already on it so the
// generated set is the only one present and lands in the documented order.
// Returns "" for anything that is not a real http(s) link.
function applyParams(url, params) {
  let u;
  try {
    u = new URL(String(url == null ? "" : url).trim());
  } catch (err) {
    return "";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "tactic"].forEach((k) =>
    u.searchParams.delete(k)
  );
  params.forEach((pair) => u.searchParams.set(pair[0], pair[1]));
  return u.href;
}

// Assemble Option 1's link, or explain why it cannot be assembled yet.
function buildDemoUrl(cfg) {
  const base = String(cfg.demoBaseUrl == null ? "" : cfg.demoBaseUrl).trim();
  const t = taxonomy(cfg);
  const problems = t.problems.slice();
  if (!base) problems.unshift("Form URL is required.");
  if (problems.length) return { url: "", problems };

  const url = applyParams(base, t.params);
  if (!url) return { url: "", problems: ["Form URL must be a full link starting https://"] };
  return { url, problems: [] };
}

// The support link carries the same tracking as Option 1, per RJ. It degrades
// differently though: an untracked support link still takes a customer to the
// help they wanted, so incomplete tracking falls back to the plain URL rather
// than removing the link. Option 1 is the opposite - an untracked lead form
// would file leads wrongly, so that one refuses to render.
function buildSupportUrl(cfg) {
  const t = taxonomy(cfg);
  if (t.problems.length) return { url: SUPPORT_URL, tracked: false };
  return { url: applyParams(SUPPORT_URL, t.params) || SUPPORT_URL, tracked: true };
}

const EDITOR_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .editor { padding: 4px 2px; }
  .banner {
    margin: 0 0 16px; padding: 10px 12px; border-radius: 6px;
    background: #fff4f2; border: 1px solid #f0c3bc;
    font-size: 12px; line-height: 1.45; color: #8a2b1d;
  }

  /* --- collapsible sections -------------------------------------------- */
  .sec { border: 1px solid #e6e9ee; border-radius: 6px; margin-bottom: 10px; background: #fff; }
  .sec > summary {
    list-style: none; cursor: pointer; user-select: none;
    display: flex; align-items: center; gap: 8px;
    padding: 11px 12px;
    font-size: 11px; font-weight: 700; letter-spacing: .06em;
    text-transform: uppercase; color: #3b3f46;
    border-radius: 6px;
  }
  .sec > summary::-webkit-details-marker { display: none; }
  .sec > summary:hover { background: #f6f8fa; }
  .sec > summary:focus-visible { outline: 2px solid #0062dd; outline-offset: -2px; }
  .sec > summary .chev {
    flex: 0 0 auto; width: 9px; height: 9px;
    border-right: 2px solid #8b9099; border-bottom: 2px solid #8b9099;
    transform: rotate(-45deg); margin-left: 2px;
    transition: transform 120ms ease;
  }
  .sec[open] > summary .chev { transform: rotate(45deg); }
  .sec[open] > summary { border-bottom: 1px solid #e6e9ee; border-radius: 6px 6px 0 0; }
  .sec .body { padding: 14px 12px 4px; }

  .subhead {
    margin: 4px 0 12px; padding-top: 12px; border-top: 1px solid #eef0f3;
    font-size: 11px; font-weight: 700; letter-spacing: .06em;
    text-transform: uppercase; color: #8b9099;
  }

  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 13px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
  .field input, .field textarea, .field select {
    width: 100%; padding: 8px 10px; font-size: 14px; color: #1a1a1a; font-family: inherit;
    border: 1px solid #ccced1; border-radius: 6px; outline: none; background: #fff;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .field textarea { min-height: 62px; resize: vertical; line-height: 1.45; }
  .field input:focus, .field textarea:focus, .field select:focus {
    border-color: #0062dd; box-shadow: 0 0 0 3px rgba(0, 98, 221, 0.15);
  }
  .field input:disabled, .field select:disabled {
    background: #f1f2f4; color: #6b6f76; cursor: not-allowed; border-color: #dfe1e5;
  }
  .field .hint { margin-top: 4px; font-size: 12px; color: #6b6f76; line-height: 1.4; }
  .field .err { margin-top: 4px; font-size: 12px; color: #b3261e; line-height: 1.4; }
  .field input.bad, .field textarea.bad { border-color: #b3261e; }
  .field.check { display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; align-items: center; }
  .field.check label { order: 2; margin: 0; }
  .field.check input { order: 1; width: 16px; height: 16px; padding: 0; accent-color: #0062dd; }
  .field.check .hint { order: 3; grid-column: 2; margin-top: 0; }

  /* --- generated URL ---------------------------------------------------- */
  .gen { margin: 2px 0 14px; padding: 10px 12px; border-radius: 6px; font-size: 12px; line-height: 1.5; }
  .gen .glab {
    display: block; margin-bottom: 6px;
    font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  }
  .gen.ok { background: #f0f6ff; border: 1px solid #cfe0fb; color: #0b3d8f; }
  .gen .url { display: block; margin-top: 2px; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; color: #10233f; }
  .gen.bad { background: #fdf3f2; border: 1px solid #f3cdc8; color: #8a2b1d; }
  .gen.bad .url { color: #6b3a32; }
  .gen ul { margin: 0; padding-left: 16px; }
  .gen li { margin-bottom: 3px; }
`;

export default class BbgContactWidgetEditor extends HTMLElement {
  constructor({ initialConfiguration, setConfiguration }) {
    super();
    this.configuration = initialConfiguration || {};
    this.setConfiguration = setConfiguration;
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this._migrate();
    this.render();
  }

  // In-memory only: nothing is written until the planner actually changes
  // something, so merely opening the settings panel cannot alter a live page.
  _migrate() {
    const c = this.configuration;
    if (!c.demoBaseUrl && c.demoUrl) {
      const base = baseFromLegacyUrl(c.demoUrl);
      if (base) this.configuration = Object.assign({}, c, { demoBaseUrl: base });
    }
  }

  // Called by Cvent when the configuration changes elsewhere. Re-rendering on
  // an echo of our own write would collapse the open section and steal focus
  // mid-keystroke, so only rebuild when something actually differs.
  onConfigurationUpdate(newConfiguration) {
    const next = newConfiguration || {};
    if (JSON.stringify(next) === JSON.stringify(this.configuration)) return;
    this.configuration = next;
    this._migrate();
    this.render();
  }

  // Push a single key and refresh the generated URL. demoUrl is derived, never
  // typed, so it is rewritten on every change.
  _set(key, value) {
    const next = Object.assign({}, this.configuration, { [key]: value });
    // Both outbound links are derived, never typed.
    next.demoUrl = buildDemoUrl(next).url;
    next.supportUrl = buildSupportUrl(next).url;
    this.configuration = next;
    this.setConfiguration(next);
    this._paint();
  }

  _paint() {
    this._paintUrl(buildDemoUrl(this.configuration));
    this._paintSupport(buildSupportUrl(this.configuration));
  }

  _paintSupport(built) {
    const box = this._supportBox;
    if (!box) return;
    box.className = "gen " + (built.tracked ? "ok" : "bad");
    box.innerHTML = "";
    const lab = document.createElement("span");
    lab.className = "glab";
    lab.textContent = built.tracked ? "Generated link" : "Link works, but is not tracked";
    box.appendChild(lab);
    const a = document.createElement("span");
    a.className = "url";
    a.textContent = built.url;
    box.appendChild(a);
    if (!built.tracked) {
      const note = document.createElement("div");
      note.textContent = "Complete Option 1 to add tracking to this link too.";
      box.appendChild(note);
    }
  }

  _paintUrl(built) {
    const box = this._urlBox;
    if (!box) return;
    box.innerHTML = "";
    const lab = document.createElement("span");
    lab.className = "glab";
    if (built.problems.length) {
      box.className = "gen bad";
      lab.textContent = "Not tracked yet";
      box.appendChild(lab);
      const ul = document.createElement("ul");
      built.problems.forEach((p) => {
        const li = document.createElement("li");
        li.textContent = p;
        ul.appendChild(li);
      });
      box.appendChild(ul);
      // Say what the visitor actually gets, so "not tracked" is not mistaken
      // for "broken" - the button still works, it just carries no campaign.
      const fallback = applyParams(this.configuration.demoBaseUrl, []);
      const note = document.createElement("div");
      note.textContent = fallback
        ? "The button still opens " + fallback + " - but with no campaign tracking on it."
        : "Without a valid Form URL the button is hidden entirely.";
      box.appendChild(note);
    } else {
      box.className = "gen ok";
      lab.textContent = "Generated link";
      box.appendChild(lab);
      const a = document.createElement("span");
      a.className = "url";
      a.textContent = built.url;
      box.appendChild(a);
    }
  }

  render() {
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = EDITOR_CSS;
    root.appendChild(style);

    const container = document.createElement("div");
    container.className = "editor";

    const banner = document.createElement("p");
    banner.className = "banner";
    banner.innerHTML =
      "<strong>Submit a question is still a preview.</strong> It validates and shows a " +
      "confirmation but sends nothing anywhere - give it a destination or untick " +
      "\u201cShow Option 3\u201d before publishing.";
    container.appendChild(banner);

    SECTIONS.forEach((section) => {
      const sec = document.createElement("details");
      sec.className = "sec";
      sec.open = !!section.open;

      const sum = document.createElement("summary");
      const chev = document.createElement("span");
      chev.className = "chev";
      sum.appendChild(chev);
      sum.appendChild(document.createTextNode(section.title));
      sec.appendChild(sum);

      const body = document.createElement("div");
      body.className = "body";
      section.fields.forEach((field) => body.appendChild(this._buildField(field)));

      // Each outbound link is previewed at the bottom of its own section, so
      // the planner can see exactly what will be opened before publishing.
      if (section.preview) {
        const box = document.createElement("div");
        box.className = "gen";
        this[section.preview] = box;
        body.appendChild(box);
      }

      sec.appendChild(body);
      container.appendChild(sec);
    });

    root.appendChild(container);
    this._paint();
  }

  _buildField(field) {
    if (field.subhead) {
      const h = document.createElement("div");
      h.className = "subhead";
      h.textContent = field.subhead;
      return h;
    }

    const wrap = document.createElement("div");
    wrap.className = field.type === "checkbox" ? "field check" : "field";

    const label = document.createElement("label");
    label.textContent = field.label;
    label.setAttribute("for", "f-" + field.key);
    wrap.appendChild(label);

    let input;
    if (field.type === "fixed") {
      // A disabled one-option select: it shows the planner what the value is
      // and that it is not theirs to change, without pretending to be a text
      // box they could edit.
      input = document.createElement("select");
      const opt = document.createElement("option");
      opt.textContent = field.value;
      input.appendChild(opt);
      input.disabled = true;
    } else if (field.type === "select") {
      input = document.createElement("select");
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Select one";
      input.appendChild(blank);
      field.options.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o;
        opt.textContent = o;
        input.appendChild(opt);
      });
      input.value = this.configuration[field.key] || "";
    } else if (field.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      // Default-on settings must treat "undefined" as true, or the box would
      // read as unchecked while the widget behaves as enabled.
      const v = this.configuration[field.key];
      input.checked = v === undefined ? field.default !== false : v !== false;
    } else {
      input = document.createElement(field.multiline ? "textarea" : "input");
      if (!field.multiline) input.type = "text";
      input.placeholder = field.placeholder || "";
      if (field.maxlength) input.maxLength = field.maxlength;
      if (field.numeric) input.inputMode = "numeric";
      input.value = this.configuration[field.key] || "";
    }
    input.id = "f-" + field.key;

    const err = document.createElement("div");
    err.className = "err";
    err.hidden = true;

    const validate = () => {
      let msg = "";
      const v = String(input.value || "");
      if (field.key === "contentDesc" && v && !DESC_RE.test(v)) {
        msg = "Lowercase letters, numbers and dashes only.";
      } else if (field.key === "tacticId" && v && !TACTIC_RE.test(v)) {
        msg = "Exactly 7 digits.";
      }
      err.textContent = msg;
      err.hidden = !msg;
      input.classList.toggle("bad", !!msg);
    };

    if (!input.disabled) {
      // Cvent's editor contract: the Backspace key can be swallowed by the
      // host panel in some layouts, so stop it from bubbling past the input.
      input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace") event.stopPropagation();
      });
      const evt = field.type === "checkbox" || field.type === "select" ? "change" : "input";
      input.addEventListener(evt, () => {
        if (field.key === "tacticId") input.value = input.value.replace(/[^0-9]/g, "").slice(0, 7);
        validate();
        this._set(field.key, field.type === "checkbox" ? input.checked : input.value);
      });
      validate();
    }

    wrap.appendChild(input);
    wrap.appendChild(err);

    if (field.hint) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = field.hint;
      wrap.appendChild(hint);
    }

    return wrap;
  }
}
