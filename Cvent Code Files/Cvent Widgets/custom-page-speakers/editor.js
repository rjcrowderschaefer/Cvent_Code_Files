// editor.js — Speakers PAGE widget editor.
// Shared groups (General, Page layout, Banner, Closing band) come from
// editor-kit.js; this file adds Featured speakers, All speakers and Bio pop-up.
import { PageEditor } from "./editor-kit.js";
import { SPEAKERS_DEFAULTS, mergeSpeakersConfig, BUILD, SECTION_LABELS, orderSpeakers, isModerator, isHouse } from "./widget.js";

export default class SpeakersPageEditor extends PageEditor {
  // The speakers the "all speakers" grid would show, in its current order.
  _allList(a) {
    const c = this._config;
    const hidden = new Set((a.hiddenIds || []).map(String));
    const feat = new Set(a.excludeFeatured !== false && c.featured.show !== false ? (c.featured.speakerIds || []).map(String) : []);
    const pool = this._speakers.filter((sp) => sp.displayOnWebsite !== false && !hidden.has(String(sp.id)) && !feat.has(String(sp.id)));
    return orderSpeakers(pool, a);
  }

  // Ordered list with ↑ ↓ (and to top / to bottom) for the custom order.
  _customOrder(a, A) {
    const wrap = this._el("div", { class: "picker" });
    const list = this._allList(a);
    const ids = list.map((sp) => String(sp.id));
    wrap.append(this._el("span", { class: "lbl", text: `Custom order (${ids.length} speakers)` }));
    if (!list.length) { wrap.append(this._hint(this._loading ? "Loading speakers…" : "No speakers found.")); return wrap; }
    const move = (i, j) => { const n = [...ids]; const [x] = n.splice(i, 1); n.splice(j, 0, x); A({ customOrder: n }); };
    const ol = this._el("ol", { class: "chosen" });
    list.forEach((sp, i) => {
      const tagBits = [isModerator(sp, a) ? "moderator" : "", isHouse(sp, a) ? (a.houseCompany || "") : ""].filter(Boolean).join(", ");
      ol.append(this._el("li", {},
        this._el("span", { class: "nm", text: `${this._name(sp)}${tagBits ? ` (${tagBits})` : ""}` }),
        this._el("button", { type: "button", class: "mini", "aria-label": "Move to top", text: "⤒", onclick: () => i && move(i, 0) }),
        this._el("button", { type: "button", class: "mini", "aria-label": "Move up", text: "↑", onclick: () => i && move(i, i - 1) }),
        this._el("button", { type: "button", class: "mini", "aria-label": "Move down", text: "↓", onclick: () => i < ids.length - 1 && move(i, i + 1) }),
        this._el("button", { type: "button", class: "mini", "aria-label": "Move to bottom", text: "⤓", onclick: () => i < ids.length - 1 && move(i, ids.length - 1) }),
      ));
    });
    wrap.append(ol,
      this._hint("Speakers added to the event later appear at the end, A–Z by first name, until you move them."),
      this._button("Reset: A–Z by first name, moderators then Bloomberg last", () => A({ customOrder: orderSpeakers(list, { ...a, sort: "first-house-last" }).map((sp) => String(sp.id)) })));
    return wrap;
  }

  merge(cfg) { return mergeSpeakersConfig(cfg); }
  get defaults() { return SPEAKERS_DEFAULTS; }
  get labels() { return SECTION_LABELS; }
  get title() { return "Speakers page widget"; }
  get build() { return BUILD; }
  needsRoster() { return true; }

  groups(c) {
    const f = c.featured;
    const a = c.all;
    const b = c.bios;
    const F = (x) => this._patchSection("featured", x);
    const A = (x) => this._patchSection("all", x);
    const B = (x) => this._patchSection("bios", x);
    const cols = [["3", "3 per row (as designed)"], ["4", "4 per row"], ["2", "2 per row"]];
    return [
      this._bannerGroup({ titleHint: "Blank = “Speakers”.", introHint: "Optional, e.g. “… Select a speaker to read their bio.”" }),
      this._sectionGroup("featured", [
        this._text("Eyebrow", f.eyebrow, (v) => F({ eyebrow: v })),
        this._text("Heading", f.heading, (v) => F({ heading: v }), { hint: "Optional." }),
        this._select("Columns", String(f.columns), cols, (v) => F({ columns: Number(v) })),
        this._speakerPicker("Featured speakers", f.speakerIds, (ids) => F({ speakerIds: ids })),
      ]),
      this._sectionGroup("all", [
        this._text("Eyebrow", a.eyebrow, (v) => A({ eyebrow: v })),
        this._text("Heading", a.heading, (v) => A({ heading: v }), { hint: "Optional." }),
        this._select("Who is shown", a.source, [["auto", "Every speaker on a session (automatic)"], ["picked", "Only the speakers I pick"]], (v) => A({ source: v }),
          "Automatic picks up new speakers as soon as they are added to a session in Cvent."),
        ...(a.source === "picked"
          ? [this._speakerPicker("Speakers", a.speakerIds, (ids) => A({ speakerIds: ids }))]
          : [
            this._check("Don’t repeat the featured speakers", a.excludeFeatured !== false, (v) => A({ excludeFeatured: v })),
            this._select("Order", a.sort, [
              ["first-house-last", `A–Z by first name; moderators, then ${a.houseCompany || "Bloomberg"}, last`],
              ["first", "A–Z by first name"],
              ["last", "A–Z by last name"],
              ["event", "Order of appearance in the program"],
              ["custom", "Custom order (set below)"],
            ], (v) => A(v === "custom" && !(a.customOrder || []).length ? { sort: v, customOrder: this._allList(a).map((sp) => String(sp.id)) } : { sort: v })),
            ...(a.sort === "first-house-last" ? [this._text("Company always listed last", a.houseCompany, (v) => A({ houseCompany: v.trim() }), { url: false, placeholder: "Bloomberg",
              hint: "Anyone whose company contains this goes at the very end (moderators from this company included)." })] : []),
            ...(a.sort === "custom" ? [this._customOrder(a, A)] : []),
            this._speakerPicker("Hide these speakers", a.hiddenIds, (ids) => A({ hiddenIds: ids }), { hint: "Speakers ticked here never show in this list. Speakers set to not display on the website in Cvent are hidden automatically." }),
          ]),
        this._sub("Moderators"),
        this._check("Show a “Moderator” label on their card", a.showModeratorLabel !== false, (v) => A({ showModeratorLabel: v })),
        this._text("Moderator speaker categories", a.moderatorCategories, (v) => A({ moderatorCategories: v }), { url: false,
          hint: "Comma separated Cvent speaker categories. Also used by the A–Z order that lists moderators last." }),
        this._text("Moderator label", a.moderatorLabel, (v) => A({ moderatorLabel: v }), { placeholder: "Moderator", hint: "Blank = “Moderator”, translated automatically." }),
        this._select("Columns", String(a.columns), cols, (v) => A({ columns: Number(v) })),
        this._check("Show a note under the grid", a.showMore !== false, (v) => A({ showMore: v })),
        ...(a.showMore !== false ? [this._text("Note", a.moreText, (v) => A({ moreText: v }), { placeholder: "More speakers to be announced." })] : []),
      ]),
      this._group("bios", "Bio pop-up", true, null, [
        this._text("Hover prompt on photos", b.hoverPrompt, (v) => B({ hoverPrompt: v })),
        this._text("Pop-up eyebrow", b.modalEyebrowText, (v) => B({ modalEyebrowText: v }), { placeholder: "Speaker", hint: "Blank = “Speaker”, translated automatically. Speakers in the Cvent speaker category “Moderator” always show “Moderator”." }),
        this._check("List the speaker’s sessions", b.showSessions !== false, (v) => B({ showSessions: v })),
        this._text("Sessions heading, several sessions", b.sessionsHeaderText, (v) => B({ sessionsHeaderText: v }), { placeholder: "Sessions", hint: "Blank = “Sessions”, translated automatically." }),
        this._text("Sessions heading, one session", b.sessionHeaderText, (v) => B({ sessionHeaderText: v }), { placeholder: "Session", hint: "Blank = “Session”, translated automatically." }),
      ]),
      this._ctaGroup(),
    ];
  }
}
