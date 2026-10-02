# Flagship Event Template

The Bloomberg Live event site built from Cvent page widgets (Home, Program,
Speakers, Venue, Contact, plus the registration pages), first used for the AI in
Finance Summit (formerly "the AIF template"). These rules come from the design
lead's review of 2026-10-01 and are template defaults: they ship in the shared
code (`page-kit.js`, `FeaturedSpeaker.js`, the site CSS) and are not set per
event. Every new page, section or feature on the template follows them.

## 1. Blue is functional, amber is decorative

| Job | Colour | Token | Where |
|---|---|---|---|
| Button fill (every ground) | `#0062DD`, hover `#0050B5`, white label | `live-action-fill` | Request to attend (hero, band, header), Get directions, contact buttons, registration Continue / Submit |
| Text link on white / tint | `#0062DD`, hover `#0050B5` | `link-text` | Arrow links ("View the full program →"), "Read more", email addresses, links inside copy (underlined) |
| Text link on black | `#4D94FF`, hover `#7AB0FF` | `link-text` (bbg-dark) | Links in dark sections, footer link hover |
| Clickable hover / functional icon | `#0062DD` | `link-text` | Speaker-name hover on cards, program-row title hover, FAQ ↓ toggles, carousel arrows |
| Label (eyebrow) | `#FF9D00` | `live-label` | Every eyebrow on every ground |
| Decoration | `#FF9D00` | `bbg-amber` | Rules, dots, the docked facts card's top line, header hairline and active-page underline, modal top bar |

The test: if a visitor can click it, it is blue. If it only marks or labels
something, it may be amber. Never use amber for a button, a link or a hover;
never use blue to decorate. Secondary (outline) buttons stay ink or white
outlines; on hover they take a blue border and label.

The blue is the one professional.bloomberg.com uses for its buttons and links,
so a visitor moving between the event site and the corporate site sees one
link colour.

## 2. Labels: amber, 20% larger

| Label | Size | Token |
|---|---|---|
| Section, banner and closing-band eyebrows | 14.4px (was 12px) | `live-eyebrow` |
| Facts-card labels, theme kickers, "Moderator", bio pop-up labels | 13.2px (was 11px) | `live-label-small` |

Weight 700, `.14em` tracking, uppercase. Amber on white is a known failing
contrast pair (2.08:1; 1.91:1 on the tint). It is kept by decision because the
label is decorative and always sits above a heading that carries the meaning.
Never put information that exists only in the label (a date, a status, a
warning) in an amber label on a light ground.

## 3. The closing "Request to attend" band is identical on every page

- A full-bleed black section. The black fills the whole band edge to edge;
  there is no grey margin around a black panel and no light variant.
- Amber "Request to attend" label, white heading "Join us at <venue> on
  <date>", muted line "<weekday>, <time> <zone>, <address>, <city>.", blue
  button on the right (full width on phones).
- The same default copy on Home and every inner page. Planners can still
  override the text, not the look.

## 4. Don't repeat the facts

- The Home hero shows no date and location line. The facts card docked
  under the hero already says when and where. The hero lockup image must not
  carry a date or city either.
- The facts card has Date, Venue and Program. No Speakers cell: the speakers
  section lists them.

## 5. Home page order

Hero → facts card → **About the event** → Speakers → Themes → Program
highlights → closing band → More from Bloomberg. The event blurb comes before
the speakers.

## 6. Speakers

- **Company is plain text on its own line under the title**, in demi
  (600) against the title's regular weight, same colour: "Chief AI Officer" /
  "**Balyasny Asset Management**". No grey company pill on cards or in the bio
  pop-up. A pill reads as a button.
- **Home shows speakers in a carousel**, not a "See all speakers" link: the
  picked speakers first, then everyone else in program order; four in view
  on desktop, three on tablet, about 1.6 on phones so the next card peeks.
  Square 44px blue-outline arrows sit at the right of the section heading,
  hidden when everything fits and disabled at each end. Swipe and trackpad
  scroll work natively.
- **Program page speaker photos are 72px** squares (60px on phones), up from
  52px.

## Additions (2026-10-02)

- **List markers.** The Home About list and the Themes cards offer three
  styles: numbered (01, 02 … the default), bullets (a small amber square) or
  one icon per item, picked from a fixed inline-SVG set (`ICONS` in
  `custom-page-home/widget.js`). About icons are ink on the tint band; theme
  markers are amber on the dark band.
- **Expandable list items.** An About item with a description shows the
  Contact FAQ arrows (blue ↓ / ↑) and is closed when the page loads.
- **About body** is one size throughout (17px). The larger first paragraph is gone.
- **Home speakers heading is one line**: 24 characters max
  (`SPEAKER_HEADING_MAX`). At 42 / 32 / 28px it fits down to 1025 / 601 /
  ~430px wide; under that it scales down. The editor caps the field, and
  anything longer that's already saved is cut with an ellipsis.
- **Moderator label** on Home speaker cards, the same as on the Speakers page
  (Cvent category "Moderator(s)").
- **Contact goes to Cvent's Contact Planner pop-up.** Email links and email
  buttons (Contact page cards, the registration panel's "Questions?" link,
  the FAB's event-team email) click Cvent's native Contact Planner widget when
  it's on the page, and the message goes to the Event Planner email in the
  event details. Without the widget they fall back to mailto, or to the
  Contact page. Phone links stay `tel:`.
- **Request-to-attend copy is soft**: "Places are limited, so our team
  confirms each request personally." Avoid "reviewed", "decision" and
  "under review" on the site and in the emails ("Status: Registration Pending").
- **Editor changes keep the page where it is** (`holdHeight`, `trackScroll`
  / `restoreScroll` in `page-kit.js`).

## Where it lives in code

| Rule | File |
|---|---|
| Colour roles, label sizes, buttons, links, closing band | `page-kit.js` (`TOKENS.action`, `TOKENS.amber`, `LABEL_PX`, `regBand`, `closingBandCopy`) |
| Company as text, card / pop-up labels | `FeaturedSpeaker.js` (`companyStyle`, `labelSize`), via `pageCardBase()` |
| Home order, hero facts, facts card, carousel | `custom-page-home/widget.js` |
| Native header Register button, footer link hover, Cvent dialog buttons | `css-files/bbg-live-site-custom.css` (`--nc`) |
| List markers / icons, speakers heading cap | `custom-page-home/widget.js` (`LIST_STYLES`, `ICONS`, `SPEAKER_HEADING_MAX`) |
| Contact Planner proxy, editor scroll hold | `page-kit.js` (`findPlannerContact`, `wirePlannerContact`, `holdHeight`, `trackScroll`) |
| Registration form buttons and links | `custom-reg-pages/reg-form-css.js` (`--r-primary`, `--r-link`) |
