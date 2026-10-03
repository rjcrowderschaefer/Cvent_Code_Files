// reg-form-css.js — the stylesheet the Registration pages widget puts into the
// page <head> to restyle Cvent's own registration form (it can't reach it from
// inside its shadow root). Every rule is scoped to html.bbg-reg, a class the
// widget sets only while a copy of it is on the page, so website pages are
// never affected. html.bbg-reg--dark switches the tokens to the dark theme.
//
// Cvent's class names carry build hashes (Forms__container___3ee8), so rules
// match on the stable prefix: [class*=Forms__container]. Form widgets render in
// [role=main]; the header region (nav, step bar) is [role=banner]; the black
// site footer is a section in [role=main] holding .site-footer and is skipped.
// Site Designer builds the page without those role attributes and wraps the
// whole canvas (header and body) in one grid, so no rule depends on either:
// a body section is a Cvent section (Grid__sectionContainer) that is not in
// the header and holds no nav / step bar / footer. That keeps the editor
// canvas and the live page looking the same.
//
// Checked against the live registration pages on 2026-09-26: step 1 (contact
// fields), step 2 (text, phone, dropdowns, radio questions, errors).

const FONT = `"AvenirNextforBBG","AvenirNextPForBBG","Avenir Next",Helvetica,Arial,sans-serif`;
// R is the element that carries the widget's state classes: <html> on the live
// page; when the page sits in a shadow root, the root's top-level elements.
export function regFormCss(R = "html.bbg-reg") {
// Sections of the page body that hold the form (not the site footer). A
// section with the CSS class "bbg-reg-page" (set in Cvent) always counts.
const BODY_SEC = `:is(.bbg-reg-page, [class*=Grid__sectionContainer]:not([role=banner] *):not(.site-footer *):not(:has(.site-footer, .cus_nav, #navigationContainer, [class*=ProgressBar__wrapper], [data-cvent-id*=ProgressBar-widget])))`;
const BODY = `${R} :where(${BODY_SEC})`;
// The site nav section. On some events Cvent puts its step bar INSIDE this
// section, so the step-bar rules below must never match it: hiding or
// repainting "the section with the step bar" would take the nav with it
// (bug seen 2026-10-01 on the Flagship template: nav missing on /register).
const NAV_SEC = `:is(.cus_nav, :has(.cus_nav, #navigationContainer, [class*=WebsiteNavigator__container]))`;
// Step-bar section of the registration header (live page and Site Designer),
// never the nav section.
const STEPS_SEC = `[class*=Grid__sectionContainer]:has([class*=ProgressBar__wrapper]):not(${NAV_SEC})`;
return `
${R} {
  --r-bg: #FFFFFF; --r-ink: #141416; --r-body: #3F3F3D; --r-muted: #5C5C5A; --r-hair: #E4E4E0;
  --r-ctl: #8A8A86; --r-field: #FFFFFF; --r-ph: #8C8C88; --r-accent: #FF9D00; --r-accent-ink: #0B0B0C;
  /* Flagship rule: buttons and links are BLUE (functional); amber is decoration only. */
  --r-primary: #0062DD; --r-primary-h: #0050B5; --r-primary-ink: #FFFFFF; --r-link: #0062DD;
  --r-err: #B42318; --r-focus: #2B6CE8; --r-focus-ring: rgba(43,108,232,.22);
  --r-menu: #FFFFFF; --r-menu-h: #F5F5F3; --r-sel: rgba(0,98,221,.08);
}
${R}.bbg-reg--dark {
  --r-bg: #0B0B0C; --r-ink: #FFFFFF; --r-body: rgba(255,255,255,.80); --r-muted: rgba(255,255,255,.66); --r-hair: rgba(255,255,255,.14);
  --r-ctl: rgba(255,255,255,.38); --r-field: #17181C; --r-ph: rgba(255,255,255,.45); --r-accent: #FF9D00; --r-accent-ink: #0B0B0C;
  --r-primary: #0062DD; --r-primary-h: #0050B5; --r-primary-ink: #FFFFFF; --r-link: #4D94FF;
  --r-err: #FF8A7A; --r-focus: #6FA0FF; --r-focus-ring: rgba(111,160,255,.3);
  --r-menu: #17181C; --r-menu-h: rgba(255,255,255,.08); --r-sel: rgba(77,148,255,.18);
}

/* ---------- grounds: no photos behind the form ---------- */
${R} [class*=AppContainer__container] { background-color: var(--r-bg) !important; }
${R} ${BODY_SEC} { background-color: var(--r-bg) !important; background-image: none !important; }

/* Base text colour for everything Cvent draws in the form area (low
   specificity on purpose: the specific rules below win). */
${BODY} :where(p, span, div, h1, h2, h3, h4, h5, h6, label, legend, li, dt, dd, td, th, strong, b, em):not(.site-footer *) { color: var(--r-ink) !important; }
${BODY} a { color: var(--r-link) !important; }

/* ---------- header: the step bar sits on the page ground under the banner ---------- */
${R} ${STEPS_SEC} {
  background-color: var(--r-bg) !important; background-image: none !important; padding: 0 !important;
  border-bottom: 1px solid var(--r-hair) !important; }
${R} ${STEPS_SEC} .hero-text-bg, ${R} ${STEPS_SEC} [data-cvent-id=containerParent] {
  background: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  border: 0 !important; border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
/* The old "Event registration / title / date / city" text box. */
${R}.bbg-reg--hide-old ${STEPS_SEC} [data-cvent-id=containerParent]:has(.event-title):not(:has([class*=ProgressBar])) { display: none !important; }
/* The banner copy draws its own step bar under the banner (Cvent keeps its step
   bar in the header, above any page content): hide Cvent's, and the whole
   header section once nothing visible is left in it. Cvent's bar stays in the
   page, so the widget can read it and pass clicks through to it. */
${R}.bbg-reg--own-steps :is([class*=ProgressBar__wrapper], [data-cvent-id*=ProgressBar-widget]) { display: none !important; }
/* Cvent step bar placed in the nav section: hide only the bar's own row, never
   the nav (the nav row holds nav / img / navigation and is kept). */
${R}.bbg-reg--own-steps [class*=Grid__row]:has(> [class*=Grid__column] > [data-cvent-id*=ProgressBar-widget]):not(:has(nav, img, [class*=navigation])) { display: none !important; }
${R}.bbg-reg--own-steps ${NAV_SEC} [class*=Grid__row]:has([class*=ProgressBar__wrapper]):not(:has(nav, img, [class*=navigation], [class*=WebsiteNavigator])) { display: none !important; }
/* Cvent's read-only "Registration Type · Apply to attend" line (one type only). */
${R}.bbg-reg--hide-regtype [data-cvent-id^=widget-RegistrationType]:has([data-cvent-id=read-only-view]) { display: none !important; }
${R}.bbg-reg--own-steps.bbg-reg--hide-old ${STEPS_SEC}:not(:has([data-bbg-reg])) { display: none !important; }

/* ---------- side panel copy: let it use its whole column ----------
   Placed in a nested half-width column, the panel was squeezed to ~300px. The
   innermost Cvent column holding the panel copy takes the full row instead;
   the panel itself caps its width at 420px. */
${R} [class*=Grid__column]:has([data-bbg-reg-mode=panel]):not(:has([class*=Grid__column] [data-bbg-reg-mode=panel])) {
  flex: 1 1 100% !important; max-width: 100% !important; width: 100% !important; }

/* ---------- form + side panel layout (mockup: form, 64px gap, 340px panel) ----------
   The panel copy marks its own row and column (data-bbg-reg-row / -panelcol):
   CSS alone can't tell that row from the rows around it. */
@media (min-width: 1024px) {
  /* 1144px = the banner's 1240px column less its 48px side padding, so the
     form lines up under the banner title. */
  ${R} [data-bbg-reg-row] { display: grid !important; grid-template-columns: minmax(0, 1fr) 380px; column-gap: 56px; align-items: start !important; width: 100% !important; max-width: 1144px !important; margin-left: auto !important; margin-right: auto !important; }
  ${R} [data-bbg-reg-row] > * { width: auto !important; max-width: none !important; min-width: 0 !important; flex: none !important; margin: 0 !important; left: auto !important; right: auto !important; }
  ${R} [data-bbg-reg-row] > [data-bbg-reg-panelcol] { position: sticky; top: 96px; z-index: 3; align-self: start; margin-top: var(--bbg-reg-panel-top, 0px) !important; }
  ${R} [data-bbg-reg-row] :is(.left-align-fields, [data-bbg-form]) { padding-left: 0 !important; padding-right: 0 !important; }
  /* Review page: the form box sits in a second Cvent container, padded too. */
  ${R} [data-bbg-reg-formcol] [data-cvent-id=containerParent]:has([data-bbg-form]) { padding-left: 0 !important; padding-right: 0 !important; }
  /* Site Designer wraps each column for drag and drop, so the marked children
     can be wrappers: the Cvent columns inside them fill the wrapper. */
  ${R} :is([data-bbg-reg-formcol], [data-bbg-reg-panelcol]) [class*=Grid__column]:has(.left-align-fields, [data-bbg-form], [data-bbg-reg-mode=panel], [class*=Forms__container]):not(:is(.left-align-fields, [data-bbg-form]) *) { width: 100% !important; max-width: 100% !important; flex: 0 0 100% !important; margin-left: 0 !important; margin-inline-start: 0 !important; left: auto !important; right: auto !important; }
}

/* Narrower screens: form first, then the panel, both full width. */
@media (max-width: 1023px) {
  ${R} [data-bbg-reg-row] { display: block !important; }
  ${R} [data-bbg-reg-row] > * { width: 100% !important; max-width: 100% !important; flex: none !important; margin: 0 !important; }
  ${R} [data-bbg-reg-row] > [data-bbg-reg-panelcol] { margin-top: 32px !important; }
}

/* Site Designer: a drag-and-drop wrapper around a Cvent column behaves like the
   column (fills its share of the row) instead of shrinking to its content. */
${BODY} [class*=Grid__row] > :not([class*=Grid__column]):has(> [class*=Grid__column]) { flex: 1 1 0; min-width: 0; }

/* ---------- side-by-side fields (marked by the widget) ----------
   data-bbg-pairrow: fields that share a Cvent row; data-bbg-halves: pairs from
   the "Fields side by side" setting. Equal columns, 20px gap; stacked on phones. */
${BODY} [data-bbg-pairrow] { display: flex !important; flex-wrap: nowrap !important; gap: 0 20px !important; }
${BODY} [data-bbg-pairrow] > * { min-width: 0 !important; }
${BODY} [data-bbg-pairrow] > [data-bbg-cell] { flex: 1 1 0 !important; width: auto !important; max-width: none !important; margin-left: 0 !important; margin-inline-start: 0 !important; left: auto !important; right: auto !important; }
${BODY} [data-bbg-cell] [class*=Grid__column], ${BODY} [data-bbg-half] [class*=Grid__column] { width: 100% !important; max-width: 100% !important; flex: 1 1 auto !important; margin-left: 0 !important; margin-inline-start: 0 !important; left: auto !important; }
${BODY} [data-bbg-halves] { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 20px; }
${BODY} [data-bbg-halves] > * { grid-column: 1 / -1; min-width: 0; }
${BODY} [data-bbg-halves] > [data-bbg-half] { grid-column: auto; }
@media (max-width: 600px) {
  ${BODY} [data-bbg-pairrow] { flex-direction: column !important; }
  ${BODY} [data-bbg-halves] > [data-bbg-half] { grid-column: 1 / -1; }
}

/* ---------- step bar ---------- */
${R} [class*=ProgressBar__wrapper] { max-width: 1240px; margin: 0 auto !important; padding: 22px clamp(20px, 4vw, 48px) 18px !important; background: transparent !important; }
${R} [class*=ProgressBar__progressbar] { margin: 0 !important; padding: 0 !important; }
${R} [class*=ProgressBar__before] {
  width: 30px !important; height: 30px !important; line-height: 27px !important; box-sizing: border-box !important;
  border: 1.5px solid var(--r-ctl) !important; background: var(--r-bg) !important; color: var(--r-muted) !important;
  font-family: ${FONT} !important; font-size: 13px !important; font-weight: 700 !important; box-shadow: none !important; }
${R} [class*=ProgressBar__progressbar] li[aria-current=step] [class*=ProgressBar__before] { background: var(--r-accent) !important; border-color: var(--r-accent) !important; color: var(--r-accent-ink) !important; }
${R} [class*=ProgressBar__progressbar] li:has(~ li[aria-current=step]) [class*=ProgressBar__before] { background: var(--r-ink) !important; border-color: var(--r-ink) !important; color: var(--r-bg) !important; }
${R} [class*=ProgressBar__progressText] { margin-top: 8px !important; font-family: ${FONT} !important; font-size: 14px !important; font-weight: 600 !important; letter-spacing: 0 !important; text-transform: none !important; color: var(--r-muted) !important; }
${R} [class*=ProgressBar__progressbar] li[aria-current=step] [class*=ProgressBar__progressText],
${R} [class*=ProgressBar__progressbar] li:has(~ li[aria-current=step]) [class*=ProgressBar__progressText] { color: var(--r-ink) !important; }
${R} [class*=ProgressBar__after] { height: 2px !important; top: 14px !important; background: var(--r-hair) !important; border: 0 !important; }
${R} [class*=ProgressBar__progressbar] li[aria-current=step] [class*=ProgressBar__after],
${R} [class*=ProgressBar__progressbar] li:has(~ li[aria-current=step]) [class*=ProgressBar__after] { background: var(--r-ink) !important; }
/* phone: thin track */
${R} [class*=ProgressBar__indicator] { height: 4px !important; border-radius: 2px !important; background: var(--r-hair) !important; border: 0 !important; overflow: hidden; }
${R} [class*=ProgressBar__bar] { height: 100% !important; background: var(--r-accent) !important; border-radius: 2px !important; }

/* ---------- form column ---------- */
${BODY} :is(.left-align-fields, [data-bbg-form]) { max-width: 620px; }
/* One left edge for intro text, fields and buttons (Cvent pads each by 15px). */
${BODY} :is(:is(.left-align-fields, [data-bbg-form]) [data-cvent-id^=widget-NucleusText], .button-group-left) { padding-left: 0 !important; padding-right: 0 !important; }
${BODY} :is(.left-align-fields, [data-bbg-form]) [data-cvent-id^=widget-NucleusText] { padding-top: 0 !important; padding-bottom: 0 !important; }
${R} [data-bbg-reg-row] .identity-confirmation { padding-left: 0 !important; padding-right: 0 !important; }
/* Intro text. Spans inside a heading are left to the heading rule below (a
   span rule here used to shrink the Heading 2 text to body size). */
${BODY} [data-cvent-id^=widget-NucleusText] :is(p, li, span):not(:is(h1, h2, h3, h4) *) { font-family: ${FONT} !important; font-size: 16.5px !important; line-height: 1.55 !important; color: var(--r-body) !important; letter-spacing: 0 !important; }
${BODY} [data-cvent-id^=widget-NucleusText] p { margin: 0 !important; }
${BODY} [data-cvent-id^=widget-NucleusText] :is(h1, h2, h3, h4) { font-family: ${FONT} !important; color: var(--r-ink) !important; letter-spacing: -0.01em !important; font-size: 28px !important; line-height: 1.2 !important; font-weight: 700 !important; margin: 0 0 8px !important; padding: 0 !important; text-transform: none !important; }
${BODY} [data-cvent-id^=widget-NucleusText] :is(h1, h2, h3, h4) * { font-family: inherit !important; font-size: inherit !important; font-weight: inherit !important; line-height: inherit !important; letter-spacing: inherit !important; color: inherit !important; text-transform: none !important; }
/* Intro heading: a Heading 2 in the text block is styled by the rule above.
   Written as plain paragraphs instead, the widget marks the heading
   (data-bbg-intro-h): a first text block followed by another one, or the first
   paragraph of a block that has two or more. */
${R}.bbg-reg--intro-heading :is([data-bbg-intro-h=line], [data-bbg-intro-h=block] :is(p, h1, h2, h3, h4, div)),
${R}.bbg-reg--intro-heading :is([data-bbg-intro-h=line], [data-bbg-intro-h=block]) * {
  font-family: ${FONT} !important; font-size: 28px !important; line-height: 1.2 !important; font-weight: 700 !important; letter-spacing: -0.01em !important; color: var(--r-ink) !important; text-transform: none !important; }
${R}.bbg-reg--intro-heading :is([data-bbg-intro-h=line], [data-bbg-intro-h=block] p:last-child) { margin: 0 0 8px !important; }
${R}.bbg-reg--intro-heading [data-bbg-intro-h=block] { padding: 0 !important; }
@media (max-width: 767px) {
  ${R}.bbg-reg--intro-heading :is([data-bbg-intro-h=line], [data-bbg-intro-h=block] :is(p, h1, h2, h3, h4, div)),
  ${R}.bbg-reg--intro-heading :is([data-bbg-intro-h=line], [data-bbg-intro-h=block]) * { font-size: 23px !important; }
}
/* Intro text blocks (marked data-bbg-intro) start on the fields' left edge. */
${R} [data-bbg-intro] { padding: 0 !important; margin-left: var(--bbg-intro-shift, 0px) !important; margin-top: var(--bbg-intro-gap, 0px) !important; margin-bottom: var(--bbg-intro-after, 0px) !important; }
${R} [data-bbg-intro] :is(p, h1, h2, h3, h4):last-child { margin-bottom: 0 !important; }
${R} [data-cvent-id^=widget-NucleusText] [data-bbg-empty] { display: none !important; }
${R} [data-bbg-intro] :is(div, p, h1, h2, h3, h4) { padding-left: 0 !important; margin-left: 0 !important; text-indent: 0 !important; }
/* "* Required" under the last intro text block (marked data-bbg-req). */
/* z-index: the spacing fix can pull the next row up over the note's line; the
   note must paint above that row's background. */
${R}.bbg-reg--req-note [data-bbg-req] { position: relative !important; z-index: 2; padding-bottom: 26px !important; }
${R}.bbg-reg--req-note [data-bbg-req]::after {
  content: var(--bbg-reg-req, "Required"); position: absolute; left: 11px; bottom: 0; font-family: ${FONT}; font-size: 13px; line-height: 20px; font-weight: 400; color: var(--r-muted); }
${R}.bbg-reg--req-note [data-bbg-req] > :first-child::after {
  content: "*"; position: absolute; left: 0; bottom: 0; font-family: ${FONT}; font-size: 13px; line-height: 20px; font-weight: 700; color: var(--r-accent); }
${BODY} [class*=Forms__container] { margin-top: 22px !important; padding: 0 !important; }
${BODY} input[class*=TextInput__textbox] { margin: 0 !important; }
${BODY} [data-cvent-id^=widget-RegistrationType] :is(span, p) { font-size: 14px !important; color: var(--r-muted) !important; font-family: ${FONT} !important; }

/* labels + legends */
${BODY} :is([class*=QuestionText__label], [class*=RegistrationTypeWidget__label], fieldset > legend),
${BODY} :is([class*=QuestionText__label], fieldset > legend) span {
  font-family: ${FONT} !important; font-size: 14.5px !important; line-height: 1.4 !important; font-weight: 600 !important;
  letter-spacing: 0 !important; text-transform: none !important; color: var(--r-ink) !important; }
${BODY} :is([class*=QuestionText__label], fieldset > legend) { display: block !important; margin: 0 0 7px !important; padding: 0 !important; }
${BODY} :is([class*=QuestionText__label], fieldset > legend) [class*=QuestionText__required] { color: var(--r-accent) !important; font-weight: 700 !important; }

/* The site's custom CSS narrows fields to 60% and nudges them right; inside the
   660px form column they read better full width, lined up with their labels. */
${R} .left-align-fields.left-align-fields :is(input[data-cvent-id=input], .react-international-phone-input-container, div:has(> [data-cvent-id=async-dropdown-wrapper])) { width: 100% !important; max-width: 100% !important; }
/* Cvent narrows the field column (10 of 12 grid columns, offset by 1): use the
   whole form column so fields line up with the intro text. Columns sharing a
   row are sized by the side-by-side rules (data-bbg-cell). */
${R} :is(.left-align-fields, [data-bbg-form]):is(.left-align-fields, [data-bbg-form]) [class*=Grid__column]:not([data-bbg-cell]) { width: 100% !important; max-width: 100% !important; flex: 0 0 100% !important; margin-left: 0 !important; margin-inline-start: 0 !important; left: auto !important; right: auto !important; }
${R} .left-align-fields.left-align-fields [class*=Forms__inputContainerGuestSide] { padding-left: 0 !important; padding-right: 0 !important; }
${R} .left-align-fields.left-align-fields input[data-cvent-id=input]::placeholder { font-style: normal !important; }
/* Mockup: "First name *", the asterisk after the label. */
/* Cvent puts the "*" before the words; it is drawn after the last word instead
   (so a long, wrapping question keeps it on its last line). */
${BODY} :is(label[class*=QuestionText__label], fieldset > legend) :has(> [class*=QuestionText__required]) { display: inline !important; }
${BODY} :is([class*=QuestionText__label], fieldset > legend) [class*=QuestionText__required] { display: none !important; }
${BODY} :is([class*=QuestionText__label], fieldset > legend) :has(> [class*=QuestionText__required]) > [data-cvent-id=label]::after {
  content: "*"; margin-left: 3px; color: var(--r-accent); font-weight: 700; }
/* Yes/No questions: the question reads as a sentence (mockup: 15.5px, 52ch). */
${BODY} fieldset > legend, ${BODY} fieldset > legend span, ${BODY} [class*=radioLabelStyles] { font-size: 15.5px !important; }
${BODY} fieldset > legend { max-width: 52ch; }

/* text inputs, phone, dropdowns: one field style */
${BODY} [class*=Forms__textboxContainer], ${BODY} [class*=Forms__inputContainer] { width: 100% !important; max-width: 100% !important; }
${BODY} input[class*=TextInput__textbox],
${BODY} .react-international-phone-input-container,
${BODY} [data-cvent-id=async-dropdown-wrapper] > div {
  box-sizing: border-box !important; width: 100% !important; min-height: 48px !important; height: 48px;
  border: 1px solid var(--r-ctl) !important; border-radius: 2px !important; background: var(--r-field) !important;
  color: var(--r-ink) !important; box-shadow: none !important; font-family: ${FONT} !important; font-size: 16px !important; }
${BODY} input[class*=TextInput__textbox] { padding: 0 14px !important; }
${BODY} input::placeholder { color: var(--r-ph) !important; opacity: 1 !important; }
${BODY} input[class*=TextInput__textbox]:focus,
${BODY} .react-international-phone-input-container:focus-within,
${BODY} [data-cvent-id=async-dropdown-wrapper] > div:focus-within {
  border-color: var(--r-focus) !important; box-shadow: 0 0 0 3px var(--r-focus-ring) !important; outline: none !important; }
/* phone: flag button + number share one box */
${BODY} .react-international-phone-input-container { display: flex !important; align-items: stretch !important; overflow: hidden; }
${BODY} .react-international-phone-input-container :is(.react-international-phone-country-selector-button, .react-international-phone-input) {
  height: 46px !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; color: var(--r-ink) !important;
  font-family: ${FONT} !important; font-size: 16px !important; box-shadow: none !important; }
${BODY} .react-international-phone-country-selector-button { padding: 0 10px 0 14px !important; border-right: 1px solid var(--r-hair) !important; }
${BODY} .react-international-phone-input { flex: 1 !important; padding: 0 14px !important; min-width: 0; }
${BODY} .react-international-phone-country-selector-dropdown { background: var(--r-menu) !important; border: 1px solid var(--r-hair) !important; box-shadow: 0 14px 32px rgba(11,11,12,.16) !important; }
${BODY} .react-international-phone-country-selector-dropdown__list-item:hover { background: var(--r-menu-h) !important; }
/* dropdowns (react-select) */
${BODY} [data-cvent-id=async-dropdown-wrapper] > div { margin: 0 !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] > div > div:first-child { padding: 0 12px !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] :is([class*=singleValue], [class*=placeholder], input) { color: var(--r-ink) !important; font-family: ${FONT} !important; font-size: 16px !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] [class*=placeholder] { color: var(--r-ph) !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] [class*=indicatorSeparator] { display: none !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] [class*=indicatorContainer] { color: var(--r-muted) !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] svg { fill: currentColor !important; }
${BODY} [class*=Forms__inputContainer] [class*=-menu] { margin-top: 4px !important; background: var(--r-menu) !important; border: 1px solid var(--r-hair) !important; border-radius: 2px !important; box-shadow: 0 14px 32px rgba(11,11,12,.16) !important; }
/* Cvent paints the menu's inner list dark (#191919): the list and each option get the menu colour. */
${BODY} [class*=Forms__inputContainer] [class*=-menu] > div { background: var(--r-menu) !important; }
${BODY} [class*=Forms__inputContainer] [class*=-option] { background: var(--r-menu) !important; color: var(--r-ink) !important; font-family: ${FONT} !important; font-size: 15px !important; padding: 10px 14px !important; }
${BODY} [class*=Forms__inputContainer] [class*=-option]:hover, ${BODY} [class*=Forms__inputContainer] [class*=-option][class*=focused] { background: var(--r-menu-h) !important; }
${BODY} [class*=Forms__inputContainer] [class*=-option][aria-selected=true] { background: var(--r-sel) !important; font-weight: 600 !important; }

/* help text under a field ("Your answer can only contain…"): one quiet line */
${BODY} [class*=Forms__additionalText] { display: inline !important; margin: 0 !important; font-family: ${FONT} !important; font-size: 12.5px !important; line-height: 1.5 !important; color: var(--r-muted) !important; }
${BODY} [class*=Forms__additionalText]:first-of-type { display: inline-block !important; margin-top: 8px !important; }
${BODY} [class*=Forms__additionalText] + [class*=Forms__additionalText]::before { content: " · "; }
/* "…only contain the following special characters:" then the list */
${BODY} [class*=Forms__additionalText]:first-of-type + [class*=Forms__additionalText]::before { content: " "; }

${R}.bbg-reg--no-hints [data-bbg-hint] { display: none !important; }

/* errors */
${BODY} input[class*=Forms__error],
${BODY} [class*=formElementWithErrors] .react-international-phone-input-container,
${BODY} [class*=formElementWithErrors] [data-cvent-id=async-dropdown-wrapper] > div {
  border-color: var(--r-err) !important; box-shadow: inset 0 0 0 1px var(--r-err) !important; }
${BODY} [class*=ErrorMessages__errorText] { margin-top: 7px !important; font-family: ${FONT} !important; font-size: 13.5px !important; font-weight: 600 !important; color: var(--r-err) !important; }

/* radio / checkbox questions: large, tappable options */
${BODY} ul:is([class*=Forms__radiobutton], [class*=Forms__checkbox], [class*=AttendeeListOptInStyles__radiobutton]) {
  display: flex !important; flex-direction: row !important; flex-wrap: wrap !important; gap: 10px !important; list-style: none !important; margin: 4px 0 0 !important; padding: 0 !important; }
${BODY} ul:is([class*=Forms__radiobutton], [class*=Forms__checkbox], [class*=AttendeeListOptInStyles__radiobutton]) > li {
  position: relative !important; display: inline-flex !important; align-items: center !important; gap: 10px !important;
  min-width: 96px; min-height: 44px; margin: 0 !important; padding: 0 18px !important; box-sizing: border-box !important;
  border: 1px solid var(--r-ctl) !important; border-radius: 2px !important; background: var(--r-field) !important; }
${BODY} ul:is([class*=Forms__radiobutton], [class*=Forms__checkbox], [class*=AttendeeListOptInStyles__radiobutton]) > li:has(input:checked) { border-color: var(--r-ink) !important; box-shadow: inset 0 0 0 1px var(--r-ink) !important; }
${BODY} ul:is([class*=Forms__radiobutton], [class*=Forms__checkbox], [class*=AttendeeListOptInStyles__radiobutton]) > li:has(input:focus-visible) { outline: 3px solid var(--r-focus) !important; outline-offset: 2px; }
${BODY} ul:is([class*=Forms__radiobutton], [class*=Forms__checkbox], [class*=AttendeeListOptInStyles__radiobutton]) input { position: static !important; top: auto !important; transform: none !important; accent-color: var(--r-ink); width: 18px !important; height: 18px !important; margin: 0 !important; flex-shrink: 0; }
${BODY} ul:is([class*=Forms__radiobutton], [class*=Forms__checkbox], [class*=AttendeeListOptInStyles__radiobutton]) label {
  margin: 0 !important; padding: 10px 0 !important; cursor: pointer; font-family: ${FONT} !important; font-size: 15px !important; font-weight: 600 !important; letter-spacing: 0 !important; text-transform: none !important; color: var(--r-ink) !important; }
/* the whole box selects the option */
${BODY} ul:is([class*=Forms__radiobutton], [class*=Forms__checkbox], [class*=AttendeeListOptInStyles__radiobutton]) label::after { content: ""; position: absolute; inset: 0; }
${BODY} fieldset { border: 0 !important; margin: 0 !important; padding: 0 !important; min-width: 0; }
/* A legend normally sits in the fieldset's border line; floated, it becomes a
   plain heading so the divider above the question stays a clean rule. */
${BODY} fieldset > legend { float: left !important; width: 100% !important; }
${BODY} fieldset > legend + * { clear: both; }
${BODY} :is([data-cvent-id=attendeeListOptIn], [data-cvent-id*=AttendeeListOptIn-widget]), ${BODY} fieldset[class*=Forms__element] { margin-top: 22px !important; padding-top: 22px !important; border-top: 1px solid var(--r-hair) !important; }
/* State / region before Country has an answer (the widget marks it). */
${R} [data-bbg-state-wait] { display: none !important; }
${R} [data-bbg-fadein] { animation: bbgRegFieldIn .28s ease both; }
@keyframes bbgRegFieldIn { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { ${R} [data-bbg-fadein] { animation: none; } }
/* Cvent pads the opt-in wrapper 15px on each side; every other question sits flush. */
${BODY} [data-cvent-id=attendeeListOptIn] { padding-left: 0 !important; padding-right: 0 !important; }
/* A fieldset sits in a Forms__container that already has the 22px above it
   (Cvent's flex rows don't collapse the two margins): mockup, 22px to the rule. */
${BODY} [class*=Forms__container] > fieldset[class*=Forms__element] { margin-top: 0 !important; }

/* "Show your profile in the event app?" (newer Carina widget): same look as
   the other Yes/No questions, on the form's left edge. */
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] :is(.carina-row, .carina-column) { margin: 0 !important; max-width: 100% !important; width: 100% !important; flex: 1 1 100% !important; padding: 0 !important; }
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-column > div, ${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-column > div > div { margin: 0 !important; padding: 0 !important; }
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] [class*=radioLabelStyles] {
  display: block; max-width: 52ch; margin: 0 !important; padding: 0 !important; font-family: ${FONT} !important; line-height: 1.4 !important; font-weight: 600 !important; letter-spacing: 0 !important; text-transform: none !important; color: var(--r-ink) !important; }
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-radiogroup { display: flex !important; flex-wrap: wrap !important; gap: 10px !important; margin: 12px 0 0 !important; padding: 0 !important; }
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-radiogroup__button { position: relative !important; padding: 0 !important; margin: 0 !important; }
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-radiogroup__button-label {
  position: relative !important; display: inline-flex !important; align-items: center !important; gap: 10px !important; box-sizing: border-box !important;
  min-width: 96px; height: 44px; margin: 0 !important; padding: 0 18px !important; cursor: pointer;
  border: 1px solid var(--r-ctl) !important; border-radius: 2px !important; background: var(--r-field) !important;
  font-family: ${FONT} !important; font-size: 15px !important; line-height: 1 !important; font-weight: 600 !important; letter-spacing: 0 !important; text-transform: none !important; color: var(--r-ink) !important; }
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-radiogroup__button-label::before {
  content: "" !important; position: static !important; display: block !important; box-sizing: border-box !important; width: 18px !important; height: 18px !important; flex-shrink: 0;
  border-radius: 50% !important; border: 1.5px solid var(--r-ctl) !important; background: var(--r-field) !important; box-shadow: none !important; left: auto !important; top: auto !important; transform: none !important; }
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-radiogroup__button-label::after { display: none !important; content: none !important; }
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-radiogroup__button-label:is([class*=--checked], :has(input:checked)) { border-color: var(--r-ink) !important; box-shadow: inset 0 0 0 1px var(--r-ink) !important; }
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-radiogroup__button-label:is([class*=--checked], :has(input:checked))::before { border: 5px solid var(--r-ink) !important; }
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-radiogroup__button-label:has(input:focus-visible) { outline: 3px solid var(--r-focus) !important; outline-offset: 2px; }
/* help line under it (setting: "Help under the event-app question") */
${BODY} [data-cvent-id*=AttendeeListOptIn-widget] .carina-radiogroup::after { content: var(--bbg-reg-optin-help, none); flex: 1 1 100%; margin-top: -2px; font-family: ${FONT}; font-size: 13px; line-height: 1.5; font-weight: 400; color: var(--r-muted); }


/* ---------- review page (Cvent's Registration Summary) ----------
   Mockup: a "Contact details" card (name, work email, Edit) and an "About you"
   card with the answers in two columns. Cvent draws one box: the attendee
   header (name, email, Edit, a collapse arrow) and the answers below it; the
   header becomes the first card and the answers the second. */
${BODY} [data-cvent-id^=widget-RegistrationSummary],
${BODY} [data-cvent-id^=widget-RegistrationSummary] :is([data-cvent-id=attendee-details], [data-dd-privacy], [class*=RegistrationSummary__body], [class*=Grid__grid], [class*=Grid__row], [class*=Grid__column]) {
  background: transparent !important; background-image: none !important; box-shadow: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; border-radius: 0 !important; }
${BODY} [data-cvent-id^=widget-RegistrationSummary] { padding: 0 !important; }
${BODY} [data-cvent-id^=widget-RegistrationSummary] > :is(h2, [data-cvent-id=RegistrationSummary-instructionalText]):empty,
${BODY} [data-cvent-id^=widget-RegistrationSummary] [class*=RegistrationSummary__separator],
${BODY} [data-cvent-id^=widget-RegistrationSummary] [class*=RegistrationSummary__accordionHeaderIcon] { display: none !important; }
${BODY} [data-cvent-id^=widget-RegistrationSummary] [data-cvent-id=attendee-details] { padding: 0 !important; border: 0 !important; }
/* card 1: Contact details */
${BODY} [class*=RegistrationSummary__attendee] {
  position: relative !important; display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 28px; row-gap: 0;
  margin: 0 !important; padding: 0 22px 20px !important; border: 1px solid var(--r-hair) !important; border-radius: 2px !important; background: var(--r-bg) !important; }
${BODY} [class*=RegistrationSummary__attendee]::before {
  content: var(--bbg-sum-contact, "Contact details"); grid-column: 1 / -1; display: block; margin: 0 -22px 18px; padding: 16px 22px; border-bottom: 1px solid var(--r-hair);
  font-family: ${FONT}; font-size: 16px; line-height: 1.4; font-weight: 700; color: var(--r-ink); }
${BODY} [class*=RegistrationSummary__attendee] > :is(h4, [class*=fieldStyles]) {
  margin: 0 !important; padding: 0 !important; font-family: ${FONT} !important; font-size: 15.5px !important; line-height: 1.45 !important; font-weight: 400 !important; color: var(--r-ink) !important; text-align: left !important; letter-spacing: 0 !important; overflow-wrap: anywhere; }
${BODY} [class*=RegistrationSummary__attendee] > :is(h4, [class*=fieldStyles])::before {
  display: block; margin-bottom: 2px; font-family: ${FONT}; font-size: 12.5px; line-height: 1.4; font-weight: 600; color: var(--r-muted); }
${BODY} [class*=RegistrationSummary__attendee] > h4::before { content: var(--bbg-sum-name, "Name"); }
${BODY} [class*=RegistrationSummary__attendee] > [class*=fieldStyles]::before { content: var(--bbg-sum-email, "Work email"); }
${BODY} [class*=RegistrationSummary__attendee] > div:has(> [class*=summaryHeaderActionLinks]) { position: absolute !important; top: 15px; right: 22px; margin: 0 !important; padding: 0 !important; }
${BODY} [class*=RegistrationSummary__attendee] [class*=summaryHeaderActionLinks] {
  padding: 0 !important; cursor: pointer; font-family: ${FONT} !important; font-size: 14px !important; line-height: 1.4 !important; font-weight: 700 !important; color: var(--r-link) !important; text-decoration: none !important; }
${BODY} [class*=RegistrationSummary__attendee] [class*=summaryHeaderActionLinks]:hover { text-decoration: underline !important; text-underline-offset: 3px; }
/* card 2: About you (the answers) */
${BODY} [data-cvent-id^=widget-RegistrationSummary] [class*=RegistrationSummary__body] { margin-top: 16px !important; border: 1px solid var(--r-hair) !important; border-radius: 2px !important; background: var(--r-bg) !important; }
${BODY} [data-cvent-id^=widget-RegistrationSummary] [class*=RegistrationSummary__body]::before {
  content: var(--bbg-sum-about, "About you"); display: block; padding: 16px 22px; border-bottom: 1px solid var(--r-hair);
  font-family: ${FONT}; font-size: 16px; line-height: 1.4; font-weight: 700; color: var(--r-ink); }
${BODY} [data-cvent-id^=widget-RegistrationSummary] [class*=RegistrationSummary__body] [class*=Grid__grid] { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px 28px; padding: 18px 22px 20px !important; margin: 0 !important; }
${BODY} [data-cvent-id^=widget-RegistrationSummary] [class*=RegistrationSummary__body] [class*=Grid__row] { display: contents !important; }
${BODY} [data-cvent-id^=widget-RegistrationSummary] [class*=RegistrationSummary__body] [class*=Grid__column] { width: auto !important; max-width: none !important; flex: none !important; margin: 0 !important; padding: 0 !important; min-width: 0; }
${BODY} [data-bbg-sum-label] { padding: 0 !important; font-size: 0 !important; line-height: 0 !important; }
${BODY} [data-bbg-sum-label]::before { content: attr(data-bbg-sum-label); display: block; font-family: ${FONT}; font-size: 12.5px; line-height: 1.4; font-weight: 600; color: var(--r-muted); }
${BODY} [data-bbg-sum-value], ${BODY} [data-bbg-sum-value] * {
  margin: 0 !important; padding: 0 !important; font-family: ${FONT} !important; font-size: 15.5px !important; line-height: 1.45 !important; font-weight: 400 !important; color: var(--r-ink) !important; letter-spacing: 0 !important; overflow-wrap: anywhere; }
${BODY} [data-bbg-sum-value] { margin-top: 2px !important; }
/* consent line above the buttons */
${BODY} [data-bbg-consent] { margin-top: 20px !important; padding: 0 !important; }
${BODY} [data-bbg-consent][data-bbg-consent] :is(p, span, div) { max-width: 62ch; font-family: ${FONT} !important; font-size: 14px !important; line-height: 1.55 !important; color: var(--r-body) !important; text-align: left !important; }
${BODY} [data-bbg-consent][data-bbg-consent] a { color: var(--r-link) !important; font-weight: 600 !important; }
@media (max-width: 600px) {
  ${BODY} [class*=RegistrationSummary__attendee] { grid-template-columns: minmax(0, 1fr); row-gap: 12px; }
  ${BODY} [class*=RegistrationSummary__attendee]::before { margin-bottom: 6px; }
  ${BODY} [data-cvent-id^=widget-RegistrationSummary] [class*=RegistrationSummary__body] [class*=Grid__grid] { grid-template-columns: minmax(0, 1fr); gap: 12px; }
}

/* ---------- buttons: Back · Continue ····· Cancel ----------
   Each button sits in its own <li>: order and spacing are set on the <li>. */
${BODY} ul[class*=ButtonGroup__buttonGroup] {
  display: flex !important; flex-wrap: wrap !important; justify-content: flex-start !important; align-items: center !important;
  gap: 12px !important; margin: 34px 0 0 !important; padding: 24px 0 0 !important; border-top: 1px solid var(--r-hair) !important; list-style: none !important; }
${BODY} ul[class*=ButtonGroup__buttonGroup] > li { margin: 0 !important; padding: 0 !important; list-style: none !important; }
${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button[type=submit]) { order: 1; }
${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button[type=button]) { order: 0; }
${BODY} button[class*=LinearNavigator__button] {
  height: 52px !important; min-width: 0 !important; width: auto !important; padding: 0 28px !important; margin: 0 !important;
  border-radius: 2px !important; box-shadow: none !important; cursor: pointer;
  font-family: ${FONT} !important; font-size: 15px !important; font-weight: 700 !important; letter-spacing: 0 !important; text-transform: none !important;
  transition: background-color .15s ease, border-color .15s ease, color .15s ease; }
${BODY} button[class*=LinearNavigator__button] * { color: inherit !important; font: inherit !important; letter-spacing: 0 !important; text-transform: none !important; }
${BODY} button[class*=LinearNavigator__button]#complete { background: var(--r-primary) !important; border: 1px solid var(--r-primary) !important; color: var(--r-primary-ink) !important; }
${BODY} button[class*=LinearNavigator__button]#complete:hover { background: var(--r-primary-h) !important; border-color: var(--r-primary-h) !important; }
${BODY} button[class*=LinearNavigator__button][type=submit] { background: var(--r-primary) !important; border: 1px solid var(--r-primary) !important; color: var(--r-primary-ink) !important; }
${BODY} button[class*=LinearNavigator__button][type=submit]:hover { background: var(--r-primary-h) !important; border-color: var(--r-primary-h) !important; }
${BODY} button[class*=LinearNavigator__button][type=button] { background: transparent !important; border: 1px solid var(--r-ink) !important; color: var(--r-ink) !important; }
${BODY} button[class*=LinearNavigator__button][type=button]:hover { background: var(--r-menu-h) !important; }
/* Cancel (id="exit"): a quiet link, far right. */
${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button#complete) { order: 1; }
${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button#exit) { order: 3; margin-left: auto !important; }
${BODY} button#exit[class*=LinearNavigator__button] {
  height: auto !important; padding: 8px 4px !important; border: 0 !important; background: transparent !important;
  color: var(--r-muted) !important; font-size: 14px !important; font-weight: 600 !important; text-decoration: underline !important; text-underline-offset: 3px; }
/* Not the dropdown's own search input: it is a few px wide inside the
   control, so an outline on it draws two blue bars. The control shows focus. */
${BODY} :is(button, a, input):not([class*=-control] input, [data-cvent-id=async-dropdown-wrapper] input):focus-visible { outline: 3px solid var(--r-focus) !important; outline-offset: 2px !important; }
${BODY} :is([class*=-control], [data-cvent-id=async-dropdown-wrapper]) input:is(:focus, :focus-visible, .focus-visible) { outline: none !important; box-shadow: none !important; }

@media (max-width: 767px) {
  ${R} [class*=ProgressBar__wrapper] { padding: 16px 20px !important; }
  ${BODY} [data-cvent-id^=widget-NucleusText] :is(p, li, span):not(:is(h1, h2, h3, h4) *) { font-size: 15.5px !important; }
  ${BODY} [data-cvent-id^=widget-NucleusText] :is(h1, h2, h3, h4) { font-size: 23px !important; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] { flex-direction: column !important; align-items: stretch !important; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li { width: 100% !important; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li > button[class*=LinearNavigator__button] { width: 100% !important; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button[type=submit]) { order: 0; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button[type=button]) { order: 1; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button#complete) { order: 0; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button#exit) { order: 2; margin: 4px 0 0 !important; text-align: center; }
  ${BODY} button#exit[class*=LinearNavigator__button] { width: auto !important; }
}
`;
}

export const REG_FORM_CSS = regFormCss();
