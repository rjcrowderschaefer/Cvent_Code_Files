// editor.js — Venue PAGE widget editor.
// Shared groups (General, Page layout, Banner, Closing band) come from
// editor-kit.js; this file adds Location, Getting here and Accessibility.
import { PageEditor } from "./editor-kit.js";
import { VENUE_DEFAULTS, mergeVenueConfig, BUILD, SECTION_LABELS, BLOOMBERG_HQ } from "./widget.js";

export default class VenuePageEditor extends PageEditor {
  merge(cfg) { return mergeVenueConfig(cfg); }
  get defaults() { return VENUE_DEFAULTS; }
  get labels() { return SECTION_LABELS; }
  get title() { return "Venue page widget"; }
  get build() { return BUILD; }

  _eventAddress() {
    const e = this._eventInfo || {};
    const a = e.address || {};
    return [e.location, a.address1, a.city].filter(Boolean).join(", ");
  }

  groups(c) {
    const l = c.location;
    const g = c.gettingHere;
    const a = c.accessibility;
    const L = (x) => this._patchSection("location", x);
    const G = (x) => this._patchSection("gettingHere", x);
    const addr = this._eventAddress();
    return [
      this._bannerGroup({ titleHint: "Blank = “Venue”.", introHint: "Optional, e.g. “The summit takes place at Bloomberg’s global headquarters…”" }),
      this._sectionGroup("location", [
        addr ? this._hint(`From Cvent: ${addr}. Fields left blank use the event’s own details.`) : null,
        this._text("Eyebrow", l.eyebrow, (v) => L({ eyebrow: v })),
        this._text("Heading", l.heading, (v) => L({ heading: v }), { hint: "Blank = the event location name." }),
        this._area("Address", l.address, (v) => L({ address: v }), { rows: 3, hint: "One line per line. Blank = the event address." }),
        this._check("Show the date line", l.showDate !== false, (v) => L({ showDate: v })),
        this._text("Date", l.dateLine, (v) => L({ dateLine: v }), { hint: "Blank = the event date." }),
        this._text("Date detail", l.dateDetail, (v) => L({ dateDetail: v }), { hint: "Blank = “Registration opens at <start time> <time zone>”." }),
        this._text("Directions button label", l.directionsLabel, (v) => L({ directionsLabel: v })),
        this._text("Directions URL", l.directionsUrl, (v) => L({ directionsUrl: v.trim() }), { hint: "Blank = Google Maps directions to the address." }),
        this._check("Show “Add to calendar” (downloads a calendar file)", l.showCalendar !== false, (v) => L({ showCalendar: v })),
        this._text("Calendar button label", l.calendarLabel, (v) => L({ calendarLabel: v })),
        this._sub("Photo"),
        this._imageField("Building photo URL", l.imageUrl, (v) => L({ imageUrl: v.trim() }), "Paste the link to the image already used on the venue page (upload in Cvent, open it, copy its address). Blank = no photo, text only."),
        ...(l.imageUrl ? [
          this._text("Photo alt text", l.imageAlt, (v) => L({ imageAlt: v })),
          this._num("Focal point, % from left", l.imageFocalX, (v) => L({ imageFocalX: v })),
          this._num("Focal point, % from top", l.imageFocalY, (v) => L({ imageFocalY: v })),
        ] : []),
      ]),
      this._sectionGroup("gettingHere", [
        this._button("Load the Bloomberg HQ (731 Lexington Ave) details", () => this._patch({
          gettingHere: { ...g, heading: BLOOMBERG_HQ.gettingHere.heading, groups: BLOOMBERG_HQ.gettingHere.groups.map((x) => ({ ...x })) },
          accessibility: { ...a, heading: BLOOMBERG_HQ.accessibility.heading, items: BLOOMBERG_HQ.accessibility.items.map((x) => ({ ...x })) },
        })),
        this._hint("Fills Getting here and Accessibility with the Bloomberg HQ copy from the design. Edit anything afterwards."),
        this._text("Eyebrow", g.eyebrow, (v) => G({ eyebrow: v })),
        this._text("Heading", g.heading, (v) => G({ heading: v })),
        ...g.groups.flatMap((it, i) => [
          this._sub(`List ${i + 1}`),
          this._text("Title", it.title, (v) => this._patchItem("gettingHere", i, { title: v }, "groups"), { placeholder: ["Subway", "Airports", "Parking", "Bus"][i] }),
          this._area("Lines", it.items, (v) => this._patchItem("gettingHere", i, { items: v }, "groups"), { rows: 4,
            hint: i === 0 ? "One per line. “Name | detail” shows the detail on the right; a line with no “|” shows as text." : "" }),
        ]),
        this._sub("Map"),
        this._select("Map", g.map, [["auto", "Google map of the address (automatic)"], ["embed", "My own map embed"], ["image", "An image"], ["none", "No map"]], (v) => G({ map: v })),
        ...(g.map === "embed" ? [this._text("Map embed URL", g.mapEmbedUrl, (v) => G({ mapEmbedUrl: v.trim() }), { hint: "Paste the Google Maps “Embed a map” code or just its link; the widget keeps the link." })] : []),
        ...(g.map === "image" ? [
          this._imageField("Map image URL", g.mapImageUrl, (v) => G({ mapImageUrl: v.trim() })),
          this._text("Map alt text", g.mapAlt, (v) => G({ mapAlt: v })),
        ] : []),
      ]),
      this._sectionGroup("accessibility", [
        this._text("Eyebrow", a.eyebrow, (v) => this._patchSection("accessibility", { eyebrow: v })),
        this._text("Heading", a.heading, (v) => this._patchSection("accessibility", { heading: v })),
        ...a.items.flatMap((it, i) => [
          this._sub(`Note ${i + 1}`),
          this._text("Title", it.title, (v) => this._patchItem("accessibility", i, { title: v })),
          this._area("Text", it.body, (v) => this._patchItem("accessibility", i, { body: v }), { rows: 2 }),
        ]),
        this._hint("A note with no title and no text is hidden."),
      ]),
      this._ctaGroup(),
    ];
  }
}
