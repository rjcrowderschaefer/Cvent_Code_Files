// editor.js — Registration pages widget editor.
// Reuses the controls and styles from editor-kit.js, but not the inner-page
// groups (General / Page layout / Closing band), which don't apply here.
import { PageEditor, EDITOR_KIT_BUILD, EDITOR_CSS } from "./editor-kit.js";
import { PAGE_KIT_BUILD } from "./page-kit.js";
import { REG_DEFAULTS, mergeRegConfig, BUILD } from "./widget.js";

const MODES = [
  ["banner", "Banner: page header (event, “Request to attend”, date · venue)"],
  ["panel", "Side panel: “Your request” summary beside the form"],
  ["confirmation", "Confirmation: “Thanks, your request is in”"],
];

export default class RegPagesEditor extends PageEditor {
  merge(cfg) { return mergeRegConfig(cfg); }
  get defaults() { return REG_DEFAULTS; }
  get title() { return "Registration pages widget"; }
  get build() { return BUILD; }

  groups(c) {
    const S = (sec) => (p) => this._patchSection(sec, p);
    const out = [this._setupGroup(c)];
    if (c.mode === "banner") {
      const b = c.banner, B = S("banner");
      out.push(this._group("banner", "Banner", true, null, [
        this._text("Eyebrow", b.eyebrow, (v) => B({ eyebrow: v }), { hint: "Blank = the event name." }),
        this._text("Title", b.title, (v) => B({ title: v })),
        this._check("Show date · time · venue", b.showMeta !== false, (v) => B({ showMeta: v })),
        this._check("Show the step bar under the banner", b.showSteps !== false, (v) => B({ showSteps: v })),
        this._hint("Cvent keeps its step bar in the page header, above anything placed on the page. With this on, the banner shows the steps underneath itself and hides Cvent’s. Clicking a finished step still uses Cvent’s own navigation."),
        this._sub("Background image (optional)"),
        this._uploadField(b, B),
        this._imageField("Or: image URL", b.bgImageUrl, (v) => B({ bgImageUrl: v.trim() }), "A link wins over an uploaded image."),
        ...(b.bgImageUrl || b.bgImageData ? [this._num("Darken image (%)", b.bgOverlay, (v) => B({ bgOverlay: v }), { max: 90 })] : []),
      ]));
    }
    if (c.mode === "panel") {
      const p = c.panel, P = S("panel");
      out.push(this._group("panel", "Side panel", true, null, [
        this._text("Eyebrow", p.eyebrow, (v) => P({ eyebrow: v })),
        this._text("Heading", p.heading, (v) => P({ heading: v }), { hint: "Blank = the event name." }),
        this._text("Heading once the first name is known", p.greeting, (v) => P({ greeting: v }), { hint: "{first} = the registrant’s first name. Blank = always use the heading above." }),
        this._check("Show the date", p.showDate !== false, (v) => P({ showDate: v })),
        this._text("Date detail line", p.dateDetail, (v) => P({ dateDetail: v }), { hint: "Blank = time range · “Registration opens <time>”." }),
        this._check("Show the venue", p.showVenue !== false, (v) => P({ showVenue: v })),
        this._check("Show “What happens next”", p.showNext !== false, (v) => P({ showNext: v })),
        ...(p.showNext !== false ? [
          this._text("Steps heading", p.nextHeading, (v) => P({ nextHeading: v })),
          this._area("Steps", p.nextSteps, (v) => P({ nextSteps: v }), { rows: 4, hint: "One step per line." }),
        ] : []),
        this._text("Contact text", p.contactText, (v) => P({ contactText: v })),
        this._text("Contact link label", p.contactLabel, (v) => P({ contactLabel: v })),
        this._text("Contact link URL", p.contactUrl, (v) => P({ contactUrl: v.trim() }), { hint: "A page link or mailto:address. Blank = the site menu’s “Contact” item." }),
      ]));
    }
    if (c.mode === "confirmation") {
      const k = c.confirmation, K = S("confirmation");
      out.push(this._group("confirmation", "Confirmation", true, null, [
        this._text("Heading", k.heading, (v) => K({ heading: v }), { hint: "{first} = the registrant’s first name." }),
        this._text("Heading when the name isn’t available", k.headingNoName, (v) => K({ headingNoName: v })),
        this._area("Text", k.body, (v) => K({ body: v }), { rows: 3, hint: "{email} = their email address, shown in bold." }),
        this._area("Text when the email isn’t available", k.bodyNoEmail, (v) => K({ bodyNoEmail: v }), { rows: 3 }),
        this._area("Timeline", k.steps, (v) => K({ steps: v }), { rows: 4, hint: "One step per line: Title | detail. The first step is marked as done." }),
        this._sub("Buttons"),
        this._text("Primary button label", k.primaryLabel, (v) => K({ primaryLabel: v })),
        this._text("Primary button URL", k.primaryUrl, (v) => K({ primaryUrl: v.trim() }), { hint: "e.g. the Agenda page. Blank = no button." }),
        this._text("Second button label", k.secondaryLabel, (v) => K({ secondaryLabel: v })),
        this._text("Second button URL", k.secondaryUrl, (v) => K({ secondaryUrl: v.trim() }), { hint: "e.g. the Contact page. Blank = no button." }),
      ]));
    }
    return out;
  }

  _setupGroup(c) {
    return this._group("general", "Setup", true, null, [
      this._select("What this copy shows", c.mode, MODES, (v) => this._patch({ mode: v }),
        "Place one copy per job: the banner in the page header, the side panel beside the form, the confirmation on the pending-approval page."),
      this._select("Theme", c.theme, [["light", "Light"], ["dark", "Dark"]], (v) => this._patch({ theme: v }),
        "Applies to this widget and to Cvent’s form on the page. When a page has several copies, the banner’s theme wins; set the same theme on every copy."),
      this._check("Restyle Cvent’s registration form on this page", c.styleForm !== false, (v) => this._patch({ styleForm: v })),
      this._check("Hide Cvent’s old header text (“Event registration” box)", c.hideOldHeader !== false, (v) => this._patch({ hideOldHeader: v })),
      this._check("Hide the “Registration Type” line when there’s only one type", c.hideRegType !== false, (v) => this._patch({ hideRegType: v })),
      this._check("Show the intro’s first line as a heading", c.introHeading !== false, (v) => this._patch({ introHeading: v })),
      this._hint("For a text block above the form with two or more paragraphs and no Heading style: the first paragraph becomes the 28px heading. A Heading 2 in the text block is always styled as the heading."),
      this._check("Show “* Required” under the form’s intro text", c.showRequiredNote !== false, (v) => this._patch({ showRequiredNote: v })),
      ...(c.showRequiredNote !== false ? [this._text("“Required” wording", c.requiredNote, (v) => this._patch({ requiredNote: v }), { url: false })] : []),
      this._check("Hide Cvent’s “Your answer can only contain…” line under text fields", c.hideFieldHints !== false, (v) => this._patch({ hideFieldHints: v })),
      this._check("Hide State / region until a country is chosen (Cvent shows it for countries with states)", c.stateAfterCountry !== false, (v) => this._patch({ stateAfterCountry: v })),
      this._text("Help under the event-app networking question", c.optInHelp, (v) => this._patch({ optInHelp: v }), { url: false, hint: "Shown under Yes / No. Blank = no help line." }),
      this._area("Fields side by side", c.pairFields, (v) => this._patch({ pairFields: v }), { rows: 3,
        hint: "One pair per line: Label + Label, using the field labels as they appear on the page. The two fields must follow each other in Cvent. Phones show them one under the other." }),
      this._sub("Review page"),
      this._text("First card title", c.review.contactTitle, (v) => this._patchSection("review", { contactTitle: v }), { url: false }),
      this._text("Name label", c.review.nameLabel, (v) => this._patchSection("review", { nameLabel: v }), { url: false }),
      this._text("Email label", c.review.emailLabel, (v) => this._patchSection("review", { emailLabel: v }), { url: false }),
      this._text("Second card title", c.review.aboutTitle, (v) => this._patchSection("review", { aboutTitle: v }), { url: false }),
      this._area("Answer labels", c.review.labels, (v) => this._patchSection("review", { labels: v }), { rows: 3,
        hint: "One per line: Cvent label = label to show (e.g. Handraiser = Talk to a representative). Asterisks are always removed." }),
      this._hint("Tip: give the form section the CSS class “bbg-reg-page” in Cvent (section settings). The site CSS then keeps the page hidden for a moment until this widget has styled it, so Cvent’s own design never flashes."),
      this._check("Use the Bloomberg brand font", c.useBrandFont !== false, (v) => this._patch({ useBrandFont: v })),
      this._check("Full-width banner (edge to edge)", c.fullBleed !== false, (v) => this._patch({ fullBleed: v })),
    ]);
  }

  _render() {
    const root = this.shadowRoot;
    root.innerHTML = "";
    root.append(this._el("style", { text: EDITOR_CSS }));
    const panel = this._el("div", { class: "panel" });
    panel.append(...this.groups(this._config).filter(Boolean));
    panel.append(this._el("p", { class: "hint build", text: `${this.title} · build ${BUILD} · ${EDITOR_KIT_BUILD} · ${PAGE_KIT_BUILD}` }));
    root.append(panel);
  }
}
