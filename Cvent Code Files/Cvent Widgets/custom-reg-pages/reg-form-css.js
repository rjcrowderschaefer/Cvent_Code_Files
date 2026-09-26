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
//
// Checked against the live registration pages on 2026-09-26: step 1 (contact
// fields), step 2 (text, phone, dropdowns, radio questions, errors).

const FONT = `"AvenirNextforBBG","AvenirNextPForBBG","Avenir Next",Helvetica,Arial,sans-serif`;
const R = "html.bbg-reg";
// Sections of the page body that hold the form (not the site footer).
const BODY = `${R} :where([role=main] [class*=Grid__grid]:not(:has(.site-footer)))`;

export const REG_FORM_CSS = `
${R} {
  --r-bg: #FFFFFF; --r-ink: #141416; --r-body: #3F3F3D; --r-muted: #5C5C5A; --r-hair: #E4E4E0;
  --r-ctl: #8A8A86; --r-field: #FFFFFF; --r-ph: #8C8C88; --r-accent: #9C5F00;
  --r-primary: #9C5F00; --r-primary-h: #8F5700; --r-primary-ink: #FFFFFF;
  --r-err: #B42318; --r-focus: #2B6CE8; --r-focus-ring: rgba(43,108,232,.22);
  --r-menu: #FFFFFF; --r-menu-h: #F5F5F3; --r-sel: rgba(156,95,0,.10);
}
${R}.bbg-reg--dark {
  --r-bg: #0B0B0C; --r-ink: #FFFFFF; --r-body: rgba(255,255,255,.80); --r-muted: rgba(255,255,255,.66); --r-hair: rgba(255,255,255,.14);
  --r-ctl: rgba(255,255,255,.38); --r-field: #17181C; --r-ph: rgba(255,255,255,.45); --r-accent: #F7A325;
  --r-primary: #F7A325; --r-primary-h: #E8951B; --r-primary-ink: #0B0B0C;
  --r-err: #FF8A7A; --r-focus: #6FA0FF; --r-focus-ring: rgba(111,160,255,.3);
  --r-menu: #17181C; --r-menu-h: rgba(255,255,255,.08); --r-sel: rgba(247,163,37,.16);
}

/* ---------- grounds: no photos behind the form ---------- */
${R} [class*=AppContainer__container] { background-color: var(--r-bg) !important; }
${BODY} [class*=Grid__sectionContainer] { background-color: var(--r-bg) !important; background-image: none !important; }

/* Base text colour for everything Cvent draws in the form area (low
   specificity on purpose: the specific rules below win). */
${BODY} :where(p, span, div, h1, h2, h3, h4, h5, h6, label, legend, li, dt, dd, td, th, strong, b, em) { color: var(--r-ink) !important; }
${BODY} a { color: var(--r-accent) !important; }

/* ---------- header: the step bar sits on the page ground under the banner ---------- */
${R} [role=banner] [class*=Grid__sectionContainer]:has([class*=ProgressBar__wrapper]) {
  background-color: var(--r-bg) !important; background-image: none !important; padding: 0 !important;
  border-bottom: 1px solid var(--r-hair) !important; }
${R} [role=banner] .hero-text-bg, ${R} [role=banner] [class*=Grid__sectionContainer]:has([class*=ProgressBar__wrapper]) [data-cvent-id=containerParent] {
  background: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
  border: 0 !important; border-radius: 0 !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; }
/* The old "Event registration / title / date / city" text box. */
${R}.bbg-reg--hide-old [role=banner] [data-cvent-id=containerParent]:has(.event-title):not(:has([class*=ProgressBar])) { display: none !important; }

/* ---------- step bar ---------- */
${R} [class*=ProgressBar__wrapper] { max-width: 1240px; margin: 0 auto !important; padding: 22px clamp(20px, 4vw, 48px) 18px !important; background: transparent !important; }
${R} [class*=ProgressBar__progressbar] { margin: 0 !important; padding: 0 !important; }
${R} [class*=ProgressBar__before] {
  width: 30px !important; height: 30px !important; line-height: 27px !important; box-sizing: border-box !important;
  border: 1.5px solid var(--r-ctl) !important; background: var(--r-bg) !important; color: var(--r-muted) !important;
  font-family: ${FONT} !important; font-size: 13px !important; font-weight: 700 !important; box-shadow: none !important; }
${R} [class*=ProgressBar__progressbar] li[aria-current=step] [class*=ProgressBar__before] { background: var(--r-accent) !important; border-color: var(--r-accent) !important; color: var(--r-primary-ink) !important; }
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
${BODY} .left-align-fields { max-width: 660px; }
${BODY} [class*=TextWidget__container] :is(p, span) { font-family: ${FONT} !important; font-size: 17px !important; line-height: 1.55 !important; color: var(--r-body) !important; letter-spacing: 0 !important; }
${BODY} [class*=TextWidget__container] :is(h1, h2, h3) { font-family: ${FONT} !important; color: var(--r-ink) !important; letter-spacing: -0.01em !important; }
${BODY} [class*=Forms__container] { margin-top: 22px !important; }
${BODY} [data-cvent-id^=widget-RegistrationType] :is(span, p) { font-size: 14px !important; color: var(--r-muted) !important; font-family: ${FONT} !important; }

/* labels + legends */
${BODY} :is([class*=QuestionText__label], [class*=RegistrationTypeWidget__label], fieldset > legend),
${BODY} :is([class*=QuestionText__label], fieldset > legend) span {
  font-family: ${FONT} !important; font-size: 15px !important; line-height: 1.4 !important; font-weight: 600 !important;
  letter-spacing: 0 !important; text-transform: none !important; color: var(--r-ink) !important; }
${BODY} :is([class*=QuestionText__label], fieldset > legend) { display: block !important; margin: 0 0 8px !important; padding: 0 !important; }
${BODY} :is([class*=QuestionText__label], fieldset > legend) [class*=QuestionText__required] { color: var(--r-accent) !important; font-weight: 700 !important; }

/* The site's custom CSS narrows fields to 60% and nudges them right; inside the
   660px form column they read better full width, lined up with their labels. */
${R} [role=main] .left-align-fields :is(input[data-cvent-id=input], .react-international-phone-input-container, div:has(> [data-cvent-id=async-dropdown-wrapper])) { width: 100% !important; max-width: 100% !important; }
${R} [role=main] .left-align-fields [class*=Forms__inputContainerGuestSide] { padding-left: 0 !important; padding-right: 0 !important; }
${R} [role=main] .left-align-fields input[data-cvent-id=input]::placeholder { font-style: normal !important; }
${BODY} :is([class*=QuestionText__label], fieldset > legend) [class*=QuestionText__required] { position: static !important; margin: 0 3px 0 0 !important; }

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
${BODY} [data-cvent-id=async-dropdown-wrapper] > div > div:first-child { padding: 0 12px !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] :is([class*=singleValue], [class*=placeholder], input) { color: var(--r-ink) !important; font-family: ${FONT} !important; font-size: 16px !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] [class*=placeholder] { color: var(--r-ph) !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] [class*=indicatorSeparator] { display: none !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] [class*=indicatorContainer] { color: var(--r-muted) !important; }
${BODY} [data-cvent-id=async-dropdown-wrapper] svg { fill: currentColor !important; }
${BODY} [class*=Forms__inputContainer] [class*=-menu] { margin-top: 4px !important; background: var(--r-menu) !important; border: 1px solid var(--r-hair) !important; border-radius: 2px !important; box-shadow: 0 14px 32px rgba(11,11,12,.16) !important; }
${BODY} [class*=Forms__inputContainer] [class*=-option] { background: transparent !important; color: var(--r-ink) !important; font-family: ${FONT} !important; font-size: 15px !important; padding: 10px 14px !important; }
${BODY} [class*=Forms__inputContainer] [class*=-option]:hover, ${BODY} [class*=Forms__inputContainer] [class*=-option][class*=focused] { background: var(--r-menu-h) !important; }
${BODY} [class*=Forms__inputContainer] [class*=-option][aria-selected=true] { background: var(--r-sel) !important; font-weight: 600 !important; }

/* help text under a field ("Your answer can only contain…"): one quiet line */
${BODY} [class*=Forms__additionalText] { display: inline !important; margin: 0 !important; font-family: ${FONT} !important; font-size: 12.5px !important; line-height: 1.5 !important; color: var(--r-muted) !important; }
${BODY} [class*=Forms__additionalText]:first-of-type { display: inline-block !important; margin-top: 8px !important; }
${BODY} [class*=Forms__additionalText] + [class*=Forms__additionalText]::before { content: " · "; }
/* "…only contain the following special characters:" then the list */
${BODY} [class*=Forms__additionalText]:first-of-type + [class*=Forms__additionalText]::before { content: " "; }

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
${BODY} [data-cvent-id=attendeeListOptIn], ${BODY} fieldset[class*=Forms__element] { margin-top: 22px !important; padding-top: 22px !important; border-top: 1px solid var(--r-hair) !important; }

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
${BODY} button[class*=LinearNavigator__button][type=submit] { background: var(--r-primary) !important; border: 1px solid var(--r-primary) !important; color: var(--r-primary-ink) !important; }
${BODY} button[class*=LinearNavigator__button][type=submit]:hover { background: var(--r-primary-h) !important; border-color: var(--r-primary-h) !important; }
${BODY} button[class*=LinearNavigator__button][type=button] { background: transparent !important; border: 1px solid var(--r-ink) !important; color: var(--r-ink) !important; }
${BODY} button[class*=LinearNavigator__button][type=button]:hover { background: var(--r-menu-h) !important; }
/* Cancel (id="exit"): a quiet link, far right. */
${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button#exit) { order: 3; margin-left: auto !important; }
${BODY} button#exit[class*=LinearNavigator__button] {
  height: auto !important; padding: 8px 4px !important; border: 0 !important; background: transparent !important;
  color: var(--r-muted) !important; font-size: 14px !important; font-weight: 600 !important; text-decoration: underline !important; text-underline-offset: 3px; }
${BODY} :is(button, a, input):focus-visible { outline: 3px solid var(--r-focus) !important; outline-offset: 2px !important; }

@media (max-width: 767px) {
  ${R} [class*=ProgressBar__wrapper] { padding: 16px 20px !important; }
  ${BODY} [class*=TextWidget__container] :is(p, span) { font-size: 16px !important; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] { flex-direction: column !important; align-items: stretch !important; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li { width: 100% !important; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li > button[class*=LinearNavigator__button] { width: 100% !important; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button[type=submit]) { order: 0; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button[type=button]) { order: 1; }
  ${BODY} ul[class*=ButtonGroup__buttonGroup] > li:has(> button#exit) { order: 2; margin: 4px 0 0 !important; text-align: center; }
  ${BODY} button#exit[class*=LinearNavigator__button] { width: auto !important; }
}
`;
