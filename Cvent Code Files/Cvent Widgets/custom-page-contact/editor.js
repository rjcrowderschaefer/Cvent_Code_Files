// editor.js — Contact PAGE widget editor.
// Shared groups (General, Page layout, Banner, Closing band) come from
// editor-kit.js; this file adds Contact cards and Questions (FAQ).
import { PageEditor } from "./editor-kit.js";
import { CONTACT_DEFAULTS, mergeContactConfig, BUILD, SECTION_LABELS } from "./widget.js";

export default class ContactPageEditor extends PageEditor {
  merge(cfg) { return mergeContactConfig(cfg); }
  get defaults() { return CONTACT_DEFAULTS; }
  get labels() { return SECTION_LABELS; }
  get title() { return "Contact page widget"; }
  get build() { return BUILD; }

  groups(c) {
    const f = c.faq;
    const I = (sec, i) => (x) => this._patchItem(sec, i, x);
    return [
      this._bannerGroup({ titleHint: "Blank = “Contact”.", introHint: "Optional, e.g. “Questions about the summit or about Bloomberg. Reach the right team directly.”" }),
      this._sectionGroup("cards", [
        this._hint("A card shows when it has a heading. Its button shows when it has a label (and, with the pop-up off, a URL or an email address)."),
        this._check("Email links open Cvent’s Contact Planner pop-up", c.plannerContact !== false, (v) => this._patch({ plannerContact: v })),
        this._hint("Add Cvent’s Contact Planner widget to this page in Site Designer (it can sit in a hidden section). Messages go to the Event Planner email in the event details. Without the widget, email links open an email as before."),
        ...(c.plannerContact !== false ? [this._text("Contact Planner button: CSS selector (advanced)", c.plannerContactSelector, (v) => this._patch({ plannerContactSelector: v.trim() }), { url: false, placeholder: ".my-contact-planner button", hint: "Only if the widget’s button isn’t found automatically." })] : []),
        ...c.cards.items.flatMap((it, i) => [
          this._sub(`Card ${i + 1}`),
          this._text("Eyebrow", it.eyebrow, (v) => I("cards", i)({ eyebrow: v })),
          this._text("Heading", it.heading, (v) => I("cards", i)({ heading: v })),
          this._area("Text", it.body, (v) => I("cards", i)({ body: v }), { rows: 2 }),
          this._text("Email address", it.email, (v) => I("cards", i)({ email: v.trim() }), { url: false, placeholder: "events@bloomberg.net" }),
          this._text("Phone", it.phone, (v) => I("cards", i)({ phone: v.trim() }), { url: false }),
          this._text("Button label", it.buttonLabel, (v) => I("cards", i)({ buttonLabel: v })),
          this._text("Button URL", it.buttonUrl, (v) => I("cards", i)({ buttonUrl: v.trim() }), { hint: c.plannerContact !== false ? "Blank = the Contact Planner pop-up. A page link here opens that page instead." : "Blank = email the address above." }),
          this._select("Button style", it.style, [["primary", "Blue (primary)"], ["secondary", "Outline (secondary)"]], (v) => I("cards", i)({ style: v })),
        ]),
      ]),
      this._sectionGroup("faq", [
        this._text("Eyebrow", f.eyebrow, (v) => this._patchSection("faq", { eyebrow: v })),
        this._text("Heading", f.heading, (v) => this._patchSection("faq", { heading: v })),
        this._check("Open the first question", f.firstOpen !== false, (v) => this._patchSection("faq", { firstOpen: v })),
        this._hint("Questions without an answer are hidden. Leave a blank line between paragraphs of an answer."),
        ...f.items.flatMap((it, i) => [
          this._sub(`Question ${i + 1}`),
          this._text("Question", it.q, (v) => I("faq", i)({ q: v })),
          this._area("Answer", it.a, (v) => I("faq", i)({ a: v }), { rows: 3 }),
        ]),
      ]),
      this._ctaGroup(),
    ];
  }
}
