// Bloomberg "Connect with Bloomberg" floating action button - Cvent Custom Widget
//
// Built to the FS Event wireframes (turn 2b, "Three paths that can ship
// today"). Colours, type scale, geometry and copy are taken from that file
// rather than approximated.
//
// Renders inside its own shadow DOM, so it is completely self-contained:
// no dependency on Cvent's custom-CSS-field scoping, no character-limit
// truncation (this file is uploaded, not pasted into a text field), and no
// risk of React removing children, since Custom Elements are opaque to
// React's reconciler.
//
// "Contact Us" links out to Bloomberg's own form rather than embedding it.
// That is not a shortcut - the form at professional.bloomberg.com is
// reCAPTCHA-gated against that exact origin (site key 6Lc8Gukn..., bound to
// https://professional.bloomberg.com:443) and submits through Bloomberg's
// form-builder to Eloqua via script, not via a form action. Lifted onto a
// Cvent domain it would fail the captcha and have nowhere to post. Linking
// out keeps the captcha, the consent banner and the Eloqua campaign
// attribution working on Bloomberg's own origin, and carries tactic= across.
//
// "Submit a question" IS STILL MOCKED - it validates and confirms but posts
// nowhere. Give it a destination or drop it from the menu before launch.

const DEFAULTS = {
  hintText: "Connect with Bloomberg",
  demoLabel: "Contact Us",
  // Options 2 and 3 can be switched off without clearing their labels, so
  // turning one back on does not mean retyping it.
  showContact: true,
  showQuestion: true,
  // Where "Contact Us" sends the visitor. This is ASSEMBLED BY editor.js from
  // the planner's Hive9 inputs and written here whole - it is not meant to be
  // hand-edited. An empty string means the editor could not build a valid
  // link, and the panel then renders with no button rather than a wrong one.
  demoUrl: "https://professional.bloomberg.com/products/bloomberg-terminal/research/regulatory-intelligence/?utm_source=cvnt&utm_medium=genpro&utm_campaign=comp&utm_content=livepro_reg-contact-form&tactic=1065635#contact-us",
  // The base the editor builds that URL from, kept so the settings panel can
  // repopulate itself. Not read at render time.
  demoBaseUrl: "https://professional.bloomberg.com/products/bloomberg-terminal/research/regulatory-intelligence/#contact-us",
  demoIntro: "To learn how Bloomberg's global policy and regulatory team delivers insights that help you stay ahead.",
  demoCtaText: "Open the contact form",
  contactLabel: "Contact Bloomberg",
  questionLabel: "Submit a question",

  tacticId: "",

  // Attention nudge. Finite by design: it starts a few seconds after the page
  // has finished loading, repeats a limited number of times, and stops
  // permanently the moment the visitor interacts with the button.
  nudgeEnabled: true,
  nudgeCount: "3",
  nudgeDelaySeconds: "5",
  nudgeIntervalSeconds: "12",
  nudgeCtaText: "Want to learn more?",

  phoneAmericas: "+1 212 318 2000",
  phoneEmea: "+44 20 7330 7500",
  phoneApac: "+65 6212 1000",
  eventEmail: "events@bloomberg.net",
  supportUrl: "https://professional.bloomberg.com/support/customer-support/",

  questionTopics: "Fixed income, Macro & policy, Sustainable finance, Market structure, Technology & data, Other",
};

// Bloomberg Terminal mark, inlined so there is no external asset to host.
// Source artwork is #231f20; currentColor lets the CSS paint it white.
const ICON_TERMINAL = `<svg class="ico-term" viewBox="0 0 122.7487 76.6267" aria-hidden="true" focusable="false"><path fill="currentColor" d="M58.4646,44.4462a2.3451,2.3451,0,0,1-2.3386,2.3376H2.3387A2.3451,2.3451,0,0,1,0,44.4462V2.3513A2.3456,2.3456,0,0,1,2.3387.0127H56.126a2.3456,2.3456,0,0,1,2.3386,2.3386ZM122.7487,2.3386A2.3453,2.3453,0,0,0,120.41,0H66.6233a2.3456,2.3456,0,0,0-2.3386,2.3386v42.095a2.3451,2.3451,0,0,0,2.3386,2.3376H120.41a2.3447,2.3447,0,0,0,2.3386-2.3376ZM55.0352,59.475C46.158,60.55,39.6829,63.9016,39.6829,67.8706c0,4.8358,9.6138,8.7561,21.4729,8.7561s21.4726-3.92,21.4726-8.7561c0-4.0387-6.36-7.3442-15.4791-8.3559l-.2749-.0239v3.943c0,1.4659-2.6209,2.6542-5.8545,2.6542S55.1655,64.9,55.1655,63.4338v-3.943Z"/></svg>`;
const ICON_PHONE = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z"/></svg>`;
const ICON_ARROW = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M4 12h15M13 6l6 6-6 6"/></svg>`;
const ICON_QUESTION = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.1 15.2a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm1.8-5.7c-.7.5-.9.8-.9 1.4v.4h-2v-.5c0-1.3.5-2 1.5-2.7.8-.6 1.1-.9 1.1-1.5 0-.7-.5-1.2-1.4-1.2s-1.5.5-1.6 1.4H8.6c.1-1.9 1.5-3.2 3.6-3.2s3.4 1.2 3.4 2.9c0 1.1-.5 1.8-1.7 2.6z"/></svg>`;

const TRACKING_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "tactic"];

// The choke point that stops a "javascript:" or "data:" value reaching an
// href. Only validates and normalises; tracking is handled below.
function safeUrl(url) {
  const raw = String(url == null ? "" : url).trim();
  if (!raw) return "";
  try {
    // No base URL on purpose: these fields are documented as full links, and
    // resolving relatively turned a typo into a broken link on the event's
    // own domain rather than no link at all.
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return u.href;
  } catch (err) {
    return "";
  }
}

// Copy whatever tracking the Contact Us link carries onto another link.
//
// The support link used to get its parameters only from editor.js, which
// meant a widget nobody had edited yet - and the local preview harness -
// rendered it untagged. Deriving it here instead means the two links can
// never disagree, and the support link is tagged from the moment the widget
// renders. An untracked Contact Us link (the editor could not build one)
// leaves the target plain rather than half-tagged.
function withTrackingFrom(sourceUrl, targetUrl) {
  const target = safeUrl(targetUrl);
  if (!target) return "";
  const source = safeUrl(sourceUrl);
  if (!source) return target;
  try {
    const from = new URL(source);
    const to = new URL(target);
    TRACKING_KEYS.forEach((k) => to.searchParams.delete(k));
    TRACKING_KEYS.forEach((k) => {
      const v = from.searchParams.get(k);
      if (v) to.searchParams.set(k, v);
    });
    return to.href;
  } catch (err) {
    return target;
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function optionList(csv) {
  return String(csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
    .join("");
}

const WIDGET_CSS = `
  :host {
    all: initial;
    /* Declared once as a custom property so the font shorthands below can
       reference it. Do NOT write the family component as the global keyword
       for inheriting - the font shorthand rejects it there and the browser
       drops the whole declaration, silently losing the size, weight and
       line-height with it. Everything fell back to 16px that way once. */
    --f: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; font-family: var(--f); }

  /* Wireframe tokens: hairline #E4E4E0, blue #0362DD (open state #0254BC),
     ink #141416, muted #5C5C5A, label grey #6F6F6D, hover wash #F5F5F3. */
  .wrap {
    position: fixed;
    right: clamp(16px, 4vw, 32px);
    bottom: clamp(16px, 4vh, 32px);
    left: auto;
    z-index: 2147483000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
  }
  /* Cvent's Site Designer puts the page canvas and its settings panel in
     one document, so drop below its chrome while editing. */
  .wrap.is-editor-preview { z-index: 500; }

  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.18);
    opacity: 0; visibility: hidden;
    transition: opacity 150ms ease-in, visibility 0s linear 150ms;
  }
  .is-open .backdrop {
    opacity: 1; visibility: visible;
    transition: opacity 260ms ease-out, visibility 0s linear 0s;
  }

  /* --- hint, sitting above the button per the wireframe ----------------- */
  .hint {
    order: 1;
    padding: 7px 10px;
    background: #fff;
    border: 1px solid #E4E4E0;
    font: 400 12px/1 var(--f);
    color: #5C5C5A;
    white-space: nowrap;
    opacity: 0;
    transform: translateY(4px);
    pointer-events: none;
    transition: opacity 150ms ease, transform 150ms ease;
  }
  .wrap:not(.is-open):hover .hint,
  .fab:focus-visible ~ .hint { opacity: 1; transform: translateY(0); }
  .is-open .hint { display: none; }

  /* --- the button ------------------------------------------------------- */
  .fab {
    order: 3;
    position: relative;
    display: flex; align-items: center; justify-content: flex-end;
    /* width, not a fixed 56px: the button grows leftwards - towards the
       centre of the page - when the CTA expands, because the wrapper is
       right-aligned and this is its last item. */
    width: auto; min-width: 56px; height: 56px;
    margin: 0; padding: 0; border: 0;
    border-radius: 2px;
    background: #0362DD;
    color: #fff;
    cursor: pointer;
    box-shadow: 0 0 0 4px rgba(3, 98, 221, .26), 0 8px 24px rgba(0, 0, 0, .3);
    transition: background 160ms ease, box-shadow 220ms ease;
  }
  /* :hover only. The reference paired it with :focus, but clicking a
     button focuses it - and close() calls fab.focus() - so :focus latched
     the expanded ring on after any click. Keyboard users still get a ring
     from :focus-visible below. */
  .fab:hover { box-shadow: 0 0 0 8px rgba(3, 98, 221, .3), 0 8px 24px rgba(0, 0, 0, .3); }
  .is-open .fab { background: #0254BC; animation: bbgPulse .6s forwards linear; }
  .fab:focus-visible { outline: none; box-shadow: 0 0 0 3px #fff, 0 0 0 6px #0362DD; }

  /* The mark keeps its own square box, so the icon and the X stay centred
     on it no matter how wide the pill grows. */
  .fab-mark {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    width: 56px; height: 56px; flex: 0 0 56px;
  }
  /* 25px: the wireframe's 20px mark, up 25% at RJ's request. The .fab-mark
     box stays 56px, so the icon grows without moving the button. */
  .fab-mark .ico-term { width: 25px; height: auto; display: block; transition: opacity 150ms ease; }
  /* X drawn as two bars, matching the wireframe rather than a glyph. The
     terminal mark cross-fades out beneath them. */
  .fab-mark i {
    position: absolute; width: 18px; height: 2px; background: #fff;
    opacity: 0; transition: opacity 150ms ease, transform 200ms ease;
  }
  .is-open .fab-mark .ico-term { opacity: 0; }
  .is-open .fab-mark i { opacity: 1; }
  .is-open .fab-mark i:nth-of-type(1) { transform: rotate(45deg); }
  .is-open .fab-mark i:nth-of-type(2) { transform: rotate(-45deg); }

  /* A panel in its own right, not more button: white with a blue border,
     so it reads as a separate chip docked to the blue mark.
     Collapsed to nothing at rest - max-width is animated because width:auto
     cannot be transitioned - and the padding lives on the inner span so
     that at max-width:0 there is no stray background peeking out. */
  /* The chip's surface lives here, on the clipper itself, so the button's
     blue can never show through a gap between the two. The border is an
     INSET SHADOW rather than a real border: box-sizing:border-box cannot
     shrink a 2px border below 4px, which would leave a blue sliver stuck to
     the button at rest, whereas a zero-width box paints no shadow at all. */
  .fab-cta {
    align-self: stretch;
    display: flex; align-items: center;
    max-width: 0;
    overflow: hidden;
    background: #ffffff;
    color: #141416;
    box-shadow: inset 0 0 0 2px #0362DD;
    /* The roll-out: the panel is clipped to its right edge and unrolls
       leftwards, like a blind coming down sideways. Clipping rather than
       scaling keeps the text crisp - scaleX would smear it. */
    clip-path: inset(0 0 0 100%);
    transition: max-width 460ms cubic-bezier(.2, 0, .2, 1),
                clip-path 460ms cubic-bezier(.2, 0, .2, 1);
  }
  .fab-cta-inner {
    display: flex; align-items: center; gap: 10px;
    height: 100%;
    padding: 0 16px 0 18px;
    white-space: nowrap;
    font: 700 13.5px/1 var(--f);
    /* Lags the panel slightly so the text appears to be carried out by it
       rather than arriving with it. */
    opacity: 0;
    transform: translateX(8px);
    transition: opacity 200ms ease 140ms, transform 300ms cubic-bezier(.2, 0, .2, 1) 140ms;
  }
  /* Drop the halo ring while the chip is out. At 56px square it reads as a
     soft glow, but wrapped around a ~290px pill it stacks straight against
     the chip's own 2px border, so the left edge becomes one thick blue
     band. The drop shadow stays; the ping supplies the outer blue. */
  .wrap.is-nudging:not(.is-open) .fab {
    box-shadow: 0 8px 24px rgba(0, 0, 0, .3);
  }
  .wrap.is-nudging:not(.is-open) .fab-cta {
    max-width: min(260px, 56vw);
    clip-path: inset(0 0 0 0);
  }
  .wrap.is-nudging:not(.is-open) .fab-cta-inner { opacity: 1; transform: translateX(0); }

  /* Blue, matching the border. Brand amber reaches only ~2:1 on white -
     under the 3:1 floor for graphical elements - so it can't be used here. */
  .fab-cta svg { width: 16px; height: 16px; flex: 0 0 16px; display: block; color: #0362DD; }
  /* Attention nudge: a radar ping off the button's edge plus a small
     wobble, to catch a scrolling visitor's eye. Deliberately finite - it
     runs a set number of times and stops for good once the visitor hovers
     or opens the widget, rather than flapping forever in the corner. */
  .fab::after {
    content: "";
    position: absolute; inset: 0;
    border-radius: 2px;
    pointer-events: none;
  }
  /* Spread, not scale. Scaling a 290x56 pill pushes the ring far wider than
     it does tall; an animated box-shadow spread grows evenly on every side,
     so the ripple keeps the pill's shape. */
  @keyframes bbgPing {
    0%   { box-shadow: 0 0 0 0 rgba(3, 98, 221, .5); }
    100% { box-shadow: 0 0 0 20px rgba(3, 98, 221, 0); }
  }
  /* Horizontal shake rather than the old rotate: rotating a wide pill by
     5 degrees swings its far end a long way and reads as a wobble, not a
     nudge. */
  @keyframes bbgShake {
    0%, 100% { transform: translateX(0); }
    15%      { transform: translateX(-6px); }
    30%      { transform: translateX(5px); }
    45%      { transform: translateX(-4px); }
    60%      { transform: translateX(3px); }
    75%      { transform: translateX(-2px); }
  }
  /* Both wait for the roll-out to finish, so the ring ripples off the full
     pill rather than off a half-opened one. */
  .is-nudging .fab { animation: bbgShake 1.2s ease-in-out 520ms 1; }
  .is-nudging .fab::after { animation: bbgPing 1.4s ease-out 520ms 2; }
  /* The hint is not shown during a nudge - the expanded CTA already
     carries the message, and both at once is noise. */

  /* Ring pulse on open, ported from the reference's onePulse keyframes.
     The reference animates box-shadow alone, so the drop shadow is carried
     through every stop here - otherwise it would blink out mid-pulse. */
  @keyframes bbgPulse {
    0%   { box-shadow: 0 0 0 0px rgba(3, 98, 221, .3),  0 8px 24px rgba(0, 0, 0, .3); }
    50%  { box-shadow: 0 0 0 12px rgba(3, 98, 221, .1), 0 8px 24px rgba(0, 0, 0, .3); }
    100% { box-shadow: 0 0 0 4px rgba(3, 98, 221, .26), 0 8px 24px rgba(0, 0, 0, .3); }
  }
  /* --- card: menu and panels share one anchor -------------------------- */
  .card {
    /* Absolutely positioned, NOT a flex item: in-flow it kept its box while
       hidden (visibility:hidden reserves space) and shoved the hint up by
       the height of the closed menu. Anchored above the whole wrapper so it
       clears the Close button on mobile too. */
    position: absolute;
    right: 0;
    bottom: calc(100% + 10px);
    width: 248px;
    background: #fff;
    border: 1px solid #E4E4E0;
    box-shadow: 0 8px 24px rgba(0, 0, 0, .3);
    transform-origin: bottom right;
    /* Not scale(0): starting from literally nothing squashes the text into a
       point and reads as a pop rather than a grow. A short rise from .92 is
       gentler and keeps the type legible the whole way. */
    transform: scale(.92) translateY(8px);
    opacity: 0; visibility: hidden;
    max-height: min(560px, calc(100vh - 150px));
    display: flex; flex-direction: column;
    overflow: hidden;
    /* CLOSING - the state declared here. Quick, no delay, and ease-IN so it
       accelerates away; a shared delay made dismissal feel unresponsive,
       because the card sat still for 100ms after the click. Visibility is
       held until the transform has finished, so it doesn't vanish mid-flight. */
    transition: transform 190ms cubic-bezier(.4, 0, 1, 1),
                opacity 150ms ease-in,
                visibility 0s linear 190ms,
                width 260ms cubic-bezier(.2, 0, .2, 1);
  }
  /* OPENING - slower than the close, and ease-OUT so it decelerates into
     place. Asymmetry is the point: opening should feel unhurried, closing
     should feel immediate. */
  .is-open .card {
    opacity: 1;
    visibility: visible;
    transform: scale(1) translateY(0);
    transition: transform 340ms cubic-bezier(.16, 1, .3, 1),
                opacity 220ms ease-out,
                visibility 0s linear 0s,
                width 260ms cubic-bezier(.2, 0, .2, 1);
  }
  .is-open:not([data-view="menu"]) .card { width: 300px; }

  .view { display: none; flex-direction: column; min-height: 0; }
  [data-view="menu"] .view-menu { display: flex; }
  /* Panels ease in as they replace the menu. The menu is excluded because
     its rows already have their own staggered entrance - running both would
     double up. */
  @keyframes bbgViewIn {
    from { opacity: 0; transform: translateX(10px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  [data-view="demo"] .view-demo,
  [data-view="contact"] .view-contact,
  [data-view="question"] .view-question {
    display: flex;
    animation: bbgViewIn 260ms cubic-bezier(.16, 1, .3, 1);
  }

  /* --- menu ------------------------------------------------------------- */
  .menu { margin: 0; padding: 6px; list-style: none; }
  /* fadeInItem, ported from the reference: each row starts nudged left and
     transparent, then slides home. Delays are the reference's 0.2s cadence.
     Driven by an animation rather than a transition so that closing drops
     the rows at once instead of unwinding them one by one. */
  @keyframes bbgFadeInItem {
    100% { transform: translateX(0); opacity: 1; }
  }
  .menu li { opacity: 0; transform: translateX(-10px); }
  .wrap.is-open[data-view="menu"] .menu li {
    animation: bbgFadeInItem .6s .2s forwards;
  }
  .wrap.is-open[data-view="menu"] .menu li:nth-child(2) { animation-delay: .4s; }
  .wrap.is-open[data-view="menu"] .menu li:nth-child(3) { animation-delay: .6s; }

  .menu button {
    display: flex; align-items: center; gap: 12px; width: 100%;
    margin: 0; padding: 11px 12px; border: 0; background: none;
    color: #141416; cursor: pointer; text-align: left;
    font: 400 13.5px/1.3 var(--f);
    transition: background 150ms cubic-bezier(.2,0,.2,1), color 150ms cubic-bezier(.2,0,.2,1);
  }
  .menu button:hover { background: #F5F5F3; color: #0362DD; }
  .menu button:focus-visible {
    outline: none; background: #F5F5F3; color: #0362DD; box-shadow: inset 0 0 0 2px #0362DD;
  }
  /* Without an explicit size an inline SVG renders at its intrinsic size -
     which for these is enormous. Sizing here is load-bearing, not cosmetic. */
  .menu svg { width: 17px; height: 17px; flex: 0 0 17px; display: block; }
  .menu .ico-term { width: 17px; height: auto; }

  /* --- panel chrome ----------------------------------------------------- */
  .phead {
    flex: 0 0 auto;
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid #E4E4E0;
  }
  .back {
    margin: 0; padding: 0; border: 0; background: none; cursor: pointer;
    font: 700 13px/1 var(--f); color: #9C5F00;
  }
  .back:focus-visible { outline: none; box-shadow: 0 0 0 2px #0362DD; }
  .ptitle { margin: 0; font: 700 14px/1.2 var(--f); color: #141416; }
  .ptitle:focus { outline: none; }

  /* Body scrolls inside the card, so the card never outgrows the viewport
     and the submit button stays reachable. */
  .pbody { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 16px; display: grid; gap: 12px; }
  .view-contact .pbody { gap: 14px; }
  .lede { margin: 0; font: 400 12.5px/1.45 var(--f); color: #5C5C5A; }
  .fine { margin: 0; font: 400 11px/1.45 var(--f); color: #6F6F6D; }

  /* --- fields ----------------------------------------------------------- */
  .f label, .flabel {
    display: block; margin-bottom: 6px;
    font: 700 11px/1 var(--f); letter-spacing: .06em; text-transform: uppercase; color: #141416;
  }
  .f label em { font-style: normal; color: #9C5F00; }
  .f input, .f select, .f textarea {
    width: 100%; padding: 8px 9px;
    font: 400 13px/1.35 var(--f); color: #141416;
    background: #fff; border: 1px solid #4D4D4D; border-radius: 0;
    outline: none;
  }
  .f textarea { min-height: 58px; resize: vertical; }
  .view-question .f textarea { min-height: 74px; }
  .f input:focus, .f select:focus, .f textarea:focus { box-shadow: inset 0 0 0 1px #0362DD; border-color: #0362DD; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .check { display: flex; align-items: flex-start; gap: 8px; font: 400 12.5px/1.35 var(--f); color: #141416; }
  .check input { width: 15px; height: 15px; flex: 0 0 15px; margin: 1px 0 0; accent-color: #0362DD; }
  .counter { margin-top: 6px; font: 400 11.5px/1.35 var(--f); color: #6F6F6D; }

  .btn {
    width: 100%; padding: 10px 14px; border: 0; border-radius: 0;
    background: #0362DD; color: #fff; cursor: pointer;
    font: 700 13px/1.35 var(--f);
    transition: background 150ms ease;
  }
  .btn:hover { background: #0254BC; }
  /* The primary action in the Contact Us panel is a real link, not a button,
     because it navigates. It still has to look like .btn. */
  a.btn { display: block; text-align: center; text-decoration: none; }
  a.btn .ext { font-style: normal; margin-left: 6px; }
  .vh {
    position: absolute; width: 1px; height: 1px;
    margin: -1px; padding: 0; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  .btn:focus-visible { outline: none; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #0362DD; }
  /* Amber highlight per the wireframe's brand ladder. Two different ambers
     on purpose: #FF9D00 is the brand colour and carries the border, but it
     only reaches ~2:1 as text on white, so the label uses the
     accessibility-tuned amber-as-text-on-light token instead. */
  .btn-secondary {
    background: #fff;
    color: #9C5F00;
    box-shadow: inset 0 0 0 1px #FF9D00;
  }
  .btn-secondary:hover { background: #FFF8EC; box-shadow: inset 0 0 0 1px #E8951B; }
  .btn-secondary:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 1px #FF9D00, 0 0 0 3px rgba(255, 157, 0, .35);
  }

  /* --- contact panel ---------------------------------------------------- */
  .glabel {
    margin: 0 0 9px;
    font: 700 11px/1 var(--f); letter-spacing: .14em; text-transform: uppercase; color: #6F6F6D;
  }
  .rows { margin: 0; }
  .row {
    display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
    padding: 7px 0; border-bottom: 1px solid #E4E4E0;
  }
  .row span { font: 400 12.5px/1.4 var(--f); color: #5C5C5A; }
  .row a {
    font: 700 13px/1.4 var(--f); font-variant-numeric: tabular-nums;
    color: #141416; text-decoration: none; white-space: nowrap;
  }
  .row a:hover { color: #0362DD; text-decoration: underline; }
  .mail { font: 400 13px/1.5 var(--f); color: #141416; text-decoration: none; }
  .mail:hover { color: #0362DD; text-decoration: underline; }

  .support { display: block; background: #F4F4F7; padding: 16px; text-decoration: none; }
  .support:hover { background: #ECECF1; }
  .support .glabel { letter-spacing: .06em; color: #0362DD; margin-bottom: 10px; }
  .support strong { display: block; font: 700 17px/1.2 var(--f); letter-spacing: -.01em; color: #141416; }
  .support-cta {
    margin-top: 12px; display: flex; align-items: center; gap: 8px;
    font: 700 13px/1.3 var(--f); color: #141416;
  }
  .support-cta i { font-style: normal; color: #0362DD; }

  /* --- confirmation (mocked submit) ------------------------------------ */
  .done { padding: 20px 16px; text-align: center; }
  .done strong { display: block; margin-bottom: 8px; font: 700 15px/1.3 var(--f); color: #141416; }
  .done p { margin: 0 0 10px; font: 400 12.5px/1.45 var(--f); color: #5C5C5A; }
  .done .fine { color: #9C5F00; }

  /* --- mobile ----------------------------------------------------------- */
  .mclose {
    order: 4; display: none;
    height: 48px; width: 100%; margin: 0; border: 0; border-radius: 2px;
    background: #0254BC; color: #fff; cursor: pointer;
    font: 700 13px/1 var(--f);
  }
  @media (max-width: 640px) {
    .wrap.is-open { left: 12px; right: 12px; bottom: 16px; align-items: stretch; }
    /* The FAB gives way to a full-width Close, so the card gets the whole
       width instead of the button crowding its corner. */
    .wrap.is-open .fab { display: none; }
    .wrap.is-open .mclose { display: block; }
    .wrap.is-open .card,
    .wrap.is-open:not([data-view="menu"]) .card {
      left: 0; right: 0; width: auto; max-height: calc(100vh - 130px);
    }
    .menu button { padding: 13px 12px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .hint, .fab, .fab i, .fab .ico-term, .card, .backdrop, .menu button, .menu li {
      transition: none !important; transition-delay: 0ms !important;
      animation: none !important;
    }
    /* With the entrance animation suppressed the rows would stay at
       opacity 0, so state them outright. */
    .menu li { opacity: 1 !important; transform: none !important; }
    .view { animation: none !important; }
    /* The nudge's motion goes; the hint still fades in, which is a
       safe cue under reduced-motion. */
    .is-nudging .fab, .is-nudging .fab::after { animation: none !important; }
    .fab-cta, .fab-cta-inner { transition: none !important; }
  }
`;

export default class BbgContactWidget extends HTMLElement {
  constructor({ configuration, theme }) {
    super();
    this.configuration = Object.assign({}, DEFAULTS, configuration || {});
    this.theme = theme;
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    // Cvent's site canvas can reconnect an already-built instance (e.g. on
    // a DOM move/reflow). Without this guard, connectedCallback would run
    // again and append a second full set of markup into the same shadow
    // root, producing stacked duplicate buttons.
    if (this._initialized) return;
    this._initialized = true;

    // Any throw below would leave the widget permanently dead - the guard
    // above blocks a retry - and surfaces as an errored widget in Site
    // Designer. Contain failures and report them to the console instead.
    try {
      this._render();
    } catch (err) {
      console.error("[BbgContactWidget] render failed:", err);
    }
  }

  _render() {
    const c = this.configuration;

    let isEditorPreview = false;
    try {
      isEditorPreview = /(^|\.)cvent\.com$/i.test(window.location.hostname);
    } catch (err) {
      isEditorPreview = false;
    }

    const style = document.createElement("style");
    style.textContent = WIDGET_CSS;
    this.shadowRoot.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    wrap.setAttribute("data-view", "menu");
    if (isEditorPreview) wrap.classList.add("is-editor-preview");

    const rq = `<em aria-hidden="true">*</em>`;
    const tel = (n) => escapeHtml(String(n || "").replace(/[^+\d]/g, ""));
    // A blank label hides its row, so a planner can drop an option - notably
    // "Submit a question", whose form still posts nowhere - without needing a
    // new build. The stagger is nth-child based, so it re-closes by itself.
    const has = (v) => String(v == null ? "" : v).trim() !== "";
    // A row needs both its toggle and a label. The toggle is what the planner
    // uses; the blank-label check is a backstop so an empty row can never
    // render as a clickable sliver of nothing.
    const showDemo = has(c.demoLabel);
    const showContact = c.showContact !== false && has(c.contactLabel);
    const showQuestion = c.showQuestion !== false && has(c.questionLabel);
    const row = (show, view, icon, label) => show
      ? `<li><button type="button" data-go="${view}">${icon}<span>${escapeHtml(label)}</span></button></li>`
      : "";
    // demoUrl is the tracked link the editor assembles. When it could not
    // build one it writes "", and we fall back to the untracked base URL.
    //
    // This used to render no button at all. That was the wrong trade: an
    // untracked link still delivers the lead, while a missing button delivers
    // nothing, and the condition fires easily - a fresh widget, or any edit to
    // an older one, leaves demoUrl empty. Partial tracking is never emitted,
    // so the fallback is untagged rather than mis-tagged.
    const demoHref = safeUrl(c.demoUrl) || safeUrl(c.demoBaseUrl);
    const supportHref = withTrackingFrom(demoHref, c.supportUrl);

    wrap.innerHTML = `
      <div class="backdrop"></div>

      <div class="card" role="dialog" aria-modal="false" aria-label="${escapeHtml(c.hintText)}">

        <div class="view view-menu">
          <ul class="menu">
            ${row(showDemo, "demo", ICON_TERMINAL, c.demoLabel)}
            ${row(showContact, "contact", ICON_PHONE, c.contactLabel)}
            ${row(showQuestion, "question", ICON_QUESTION, c.questionLabel)}
          </ul>
        </div>

        <div class="view view-demo">
          <div class="phead">
            <button type="button" class="back" data-go="menu" aria-label="Back to menu">&#8592;</button>
            <h2 class="ptitle" tabindex="-1">${escapeHtml(c.demoLabel)}</h2>
          </div>
          <div class="pbody">
            <p class="lede">${escapeHtml(c.demoIntro)}</p>
            ${demoHref ? `<a class="btn" href="${escapeHtml(demoHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.demoCtaText)}<i class="ext" aria-hidden="true">&#8594;</i><span class="vh"> (opens in a new tab)</span></a>` : ""}
            ${supportHref ? `<a class="support" href="${escapeHtml(supportHref)}" target="_blank" rel="noopener noreferrer">
              <p class="glabel">Help &amp; support</p>
              <strong>Already a customer?</strong>
              <span class="support-cta">Get in touch with the support team <i aria-hidden="true">&#8594;</i></span>
            </a>` : ""}
          </div>
        </div>

        ${showContact ? `
        <div class="view view-contact">
          <div class="phead">
            <button type="button" class="back" data-go="menu" aria-label="Back to menu">&#8592;</button>
            <h2 class="ptitle" tabindex="-1">${escapeHtml(c.contactLabel)}</h2>
          </div>
          <div class="pbody">
            <div>
              <p class="glabel">Call us</p>
              <div class="rows">
                <div class="row"><span>Americas</span><a href="tel:${tel(c.phoneAmericas)}">${escapeHtml(c.phoneAmericas)}</a></div>
                <div class="row"><span>EMEA</span><a href="tel:${tel(c.phoneEmea)}">${escapeHtml(c.phoneEmea)}</a></div>
                <div class="row"><span>Asia Pacific</span><a href="tel:${tel(c.phoneApac)}">${escapeHtml(c.phoneApac)}</a></div>
              </div>
            </div>
            <div>
              <p class="glabel">Event team</p>
              <a class="mail" href="mailto:${escapeHtml(c.eventEmail)}">${escapeHtml(c.eventEmail)}</a>
            </div>
            ${showDemo ? `<button type="button" class="btn btn-secondary" data-go="demo">Contact a specialist</button>` : ""}
            ${supportHref ? `<a class="support" href="${escapeHtml(supportHref)}" target="_blank" rel="noopener noreferrer">
              <p class="glabel">Help &amp; support</p>
              <strong>Already a customer?</strong>
              <span class="support-cta">Get in touch with the support team <i aria-hidden="true">&#8594;</i></span>
            </a>` : ""}
          </div>
        </div>` : ""}

        ${showQuestion ? `
        <div class="view view-question">
          <div class="phead">
            <button type="button" class="back" data-go="menu" aria-label="Back to menu">&#8592;</button>
            <h2 class="ptitle" tabindex="-1">${escapeHtml(c.questionLabel)}</h2>
          </div>
          <form class="pbody" data-form="question" novalidate>
            <p class="lede">Questions are put to the relevant moderator ahead of the event.</p>
            <div class="f"><label for="q-tp">Topic or focus area</label><select id="q-tp" name="topic"><option value="">Select a topic</option>${optionList(c.questionTopics)}</select></div>
            <div class="f">
              <label for="q-qq">Your question ${rq}</label>
              <textarea id="q-qq" name="question" maxlength="280" required></textarea>
              <div class="counter" data-counter>280 characters</div>
            </div>
            <button type="button" class="btn" data-submit="question">Submit question</button>
          </form>
        </div>
` : ""}
      </div>

      <button type="button" class="fab" aria-haspopup="menu" aria-expanded="false" aria-label="${escapeHtml(c.hintText)}">
        <span class="fab-cta" aria-hidden="true"><span class="fab-cta-inner"><span>${escapeHtml(c.nudgeCtaText)}</span>${ICON_ARROW}</span></span>
        <span class="fab-mark">${ICON_TERMINAL}<i></i><i></i></span>
      </button>
      <span class="hint" aria-hidden="true">${escapeHtml(c.hintText)}</span>
      <button type="button" class="mclose">Close</button>
    `;
    this.shadowRoot.appendChild(wrap);

    const fab = wrap.querySelector(".fab");
    const card = wrap.querySelector(".card");
    const backdrop = wrap.querySelector(".backdrop");
    const mclose = wrap.querySelector(".mclose");

    const isOpen = () => wrap.classList.contains("is-open");
    const setView = (view) => {
      wrap.setAttribute("data-view", view);
      const scope = wrap.querySelector(`.view-${view}`);
      if (!scope) return;
      // Move focus to the panel heading rather than the first control:
      // focusing the back chevron left a visible ring on it, and dropping
      // straight into a text field pops the keyboard on mobile. The heading
      // announces the new panel and leaves the visitor to tab in.
      const target = scope.querySelector(".ptitle") || scope.querySelector("button");
      if (target && target.focus) target.focus();
    };
    const open = () => {
      wrap.classList.add("is-open");
      fab.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      setView("menu");
    };
    const close = () => {
      wrap.classList.remove("is-open");
      fab.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      wrap.setAttribute("data-view", "menu");
      // Programmatic focus doesn't match :focus-visible, so the hint stays
      // hidden for a mouse user while keyboard users still get it back.
      fab.focus();
    };

    fab.addEventListener("click", () => (isOpen() ? close() : open()));
    mclose.addEventListener("click", close);
    backdrop.addEventListener("click", close);

    // One delegated handler covers every menu row, every back chevron and
    // the "Contact a specialist" cross-link - they all just switch view.
    card.addEventListener("click", (event) => {
      const go = event.target.closest("[data-go]");
      if (go) setView(go.getAttribute("data-go"));
    });

    const counter = card.querySelector("[data-counter]");
    const qText = card.querySelector("#q-qq");
    if (counter && qText) {
      qText.addEventListener("input", () => {
        const left = 280 - qText.value.length;
        counter.textContent = left + (left === 1 ? " character" : " characters") + " remaining";
      });
    }

    // MOCKED SUBMIT - now only "Submit a question", since Contact Us links
    // out. Validates, then swaps the form for a confirmation. Deliberately
    // makes no network request: a form that appears to send while discarding
    // input is worse than one that says plainly it is a preview.
    card.querySelectorAll("[data-submit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const form = card.querySelector(`[data-form="${btn.getAttribute("data-submit")}"]`);
        if (!form || !form.reportValidity()) return;
        form.innerHTML = `
          <div class="done">
            <strong>Thank you.</strong>
            <p>Your question has been noted for the moderator.</p>
            <p class="fine">Preview only - this form is not yet connected to a destination,
            so nothing was sent.</p>
          </div>`;
      });
    });

    this._onKeydown = (event) => {
      if (event.key !== "Escape" || !isOpen()) return;
      // Escape steps back to the menu first, then closes - so it undoes one
      // level at a time rather than discarding a part-filled form outright.
      if (wrap.getAttribute("data-view") !== "menu") setView("menu");
      else close();
    };
    document.addEventListener("keydown", this._onKeydown);

    // --- attention nudge -------------------------------------------------
    const nudgeMax = Math.max(0, parseInt(c.nudgeCount, 10) || 0);
    const gapSeconds = Math.max(3, parseInt(c.nudgeIntervalSeconds, 10) || 12);
    const gapMs = gapSeconds * 1000;
    const parsedDelay = parseInt(c.nudgeDelaySeconds, 10);
    const startMs = Math.max(0, isNaN(parsedDelay) ? 5 : parsedDelay) * 1000;

    if (c.nudgeEnabled !== false && nudgeMax > 0 && !isEditorPreview) {
      let fired = 0;
      let armed = true;
      let timer = null;
      let startTimer = null;

      const stopNudging = () => {
        armed = false;
        if (timer) clearInterval(timer);
        if (startTimer) clearTimeout(startTimer);
        timer = startTimer = null;
        wrap.classList.remove("is-nudging");
        window.removeEventListener("load", begin);
      };

      const playNudge = () => {
        if (!armed || isOpen()) return;
        fired++;
        wrap.classList.add("is-nudging");
        setTimeout(() => {
          wrap.classList.remove("is-nudging");
          // Retire only AFTER the last one has finished playing. Calling
          // stopNudging() inline used to strip the class in the same tick it
          // was added, so the final nudge never rendered at all.
          if (fired >= nudgeMax) stopNudging();
        }, 3900);
      };

      function begin() {
        if (!armed || startTimer) return;
        startTimer = setTimeout(() => {
          playNudge();
          if (armed && nudgeMax > 1) timer = setInterval(playNudge, gapMs);
        }, startMs);
      }

      // Cvent renders this widget asynchronously, so connectedCallback often
      // runs AFTER window.load has already fired - a bare load listener would
      // then never run and the nudge would never start. Check readyState and
      // only wait for the event if the page is genuinely still loading.
      if (document.readyState === "complete") begin();
      else window.addEventListener("load", begin, { once: true });

      // Any sign of intent retires it for good - nothing is more irritating
      // than a button that keeps waving after you've found it.
      fab.addEventListener("pointerenter", stopNudging);
      fab.addEventListener("click", stopNudging);
      this._stopNudging = stopNudging;
    }

    // In Site Designer, pin to the bottom-right of the page preview rather
    // than of the whole browser window. Cosmetic only, and fully contained
    // so it can never break the render.
    if (isEditorPreview) {
      const GUTTER = 40;
      const findCanvasRect = () => {
        let node = this.parentElement;
        for (let depth = 0; node && node !== document.body && depth < 40; depth++) {
          const cs = window.getComputedStyle(node);
          // Only auto/scroll - NOT hidden. overflow:hidden is common on
          // ordinary page sections, and matching it lets a small section
          // masquerade as the canvas and fling the button off-position.
          if (/(auto|scroll)/.test(cs.overflowY + " " + cs.overflow)) {
            const r = node.getBoundingClientRect();
            if (r.width > 300 && r.height > 300 && r.right < window.innerWidth - 40) return r;
          }
          node = node.parentElement;
        }
        return null;
      };
      const pin = () => {
        try {
          const r = findCanvasRect();
          if (!r) { wrap.style.removeProperty("right"); wrap.style.removeProperty("bottom"); return; }
          const right = window.innerWidth - r.right + GUTTER;
          const bottom = window.innerHeight - r.bottom + 16;
          // Judged against the canvas, not the window: the settings panel is
          // a fixed width, so as the window narrows this offset stays large
          // relative to the window while remaining correct.
          if (r.right - GUTTER < 120 || r.bottom < 120 || right < 0 || bottom < 0) {
            wrap.style.removeProperty("right"); wrap.style.removeProperty("bottom"); return;
          }
          wrap.style.right = Math.max(16, Math.round(right)) + "px";
          wrap.style.bottom = Math.max(16, Math.round(bottom)) + "px";
        } catch (err) {
          wrap.style.removeProperty("right"); wrap.style.removeProperty("bottom");
        }
      };
      try {
        pin();
        this._onResize = pin;
        window.addEventListener("resize", this._onResize);
        this._pinPollId = setInterval(pin, 1000);
      } catch (err) { /* optional */ }
    }
  }

  disconnectedCallback() {
    if (this._onKeydown) document.removeEventListener("keydown", this._onKeydown);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    if (this._pinPollId) clearInterval(this._pinPollId);
    if (this._stopNudging) this._stopNudging();
  }
}
