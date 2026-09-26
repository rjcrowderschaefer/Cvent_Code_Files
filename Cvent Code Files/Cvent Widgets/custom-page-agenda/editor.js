// editor.js — Agenda PAGE widget editor.
// Shared groups (General, Page layout, Banner, Closing band) come from
// editor-kit.js; this file adds the Program group. The category list is read
// from the live sessions so planners can see what to group and what counts
// as a break.
import { PageEditor } from "./editor-kit.js";
import { isHiddenSession } from "./page-kit.js";
import { AGENDA_DEFAULTS, mergeAgendaConfig, BUILD, SECTION_LABELS, parseGroups } from "./widget.js";

export default class AgendaPageEditor extends PageEditor {
  merge(cfg) { return mergeAgendaConfig(cfg); }
  get defaults() { return AGENDA_DEFAULTS; }
  get labels() { return SECTION_LABELS; }
  get title() { return "Agenda page widget"; }
  get build() { return BUILD; }
  needsRoster() { return true; }

  groups(c) {
    const p = c.program;
    const S = (x) => this._patchSection("program", x);
    const cats = [...new Set(this._sessions.map((s) => String(s?.category?.name || "").trim()).filter(Boolean))];
    const catList = cats.length
      ? this._el("div", { class: "cats" }, ...cats.map((x) => this._el("span", { text: x })))
      : this._hint(this._loading ? "Loading session categories…" : "No session categories found.");
    const groups = parseGroups(p.filterGroups);
    return [
      this._bannerGroup({ titleHint: "Blank = “Program”.", introHint: "Blank = “<n> sessions at <venue>. All times are <time zone>.”" }),
      this._sectionGroup("program", [
        this._check("Show the day heading and session count", p.showDayHeading !== false, (v) => S({ showDayHeading: v })),
        this._sub("Filters"),
        this._check("Show filter buttons", p.showFilters !== false, (v) => S({ showFilters: v })),
        this._text("“All” button label", p.allLabel, (v) => S({ allLabel: v }), { placeholder: "All sessions", hint: "Blank = “All sessions”, translated automatically." }),
        this._area("Filter buttons", p.filterGroups, (v) => S({ filterGroups: v }), {
          rows: 5,
          placeholder: "Keynotes and talks: Keynote, Talk, Lightning talk, Remarks\nPanels: Panel\nFireside chats: Fireside chat, Executive dialogue\nNetworking: Networking",
          hint: "One button per line: “Button label: Category, Category”. Blank = one button per session category. Buttons with no matching sessions are hidden.",
        }),
        groups.length ? this._hint(`${groups.length} button${groups.length === 1 ? "" : "s"} defined.`) : null,
        this._el("span", { class: "lbl", text: "Session categories in this event" }),
        catList,
        this._sub("Breaks"),
        this._text("Break categories / words", p.breakCategories, (v) => S({ breakCategories: v }), {
          hint: "Comma separated. A session in one of these categories shows as a grey break row. Sessions with no category, no speakers and no description also count as breaks when their title contains one of these words (e.g. “Networking Reception”). A session custom field “Break session?” set to Yes always works.",
        }),
        this._sub("Session rows"),
        this._sub("Session details"),
        this._hint("Shown as one line under the session title (category · location), with tags after the speakers. Anything a session doesn’t have is left out."),
        this._check("Show the category", p.showCategory !== false, (v) => S({ showCategory: v })),
        this._check("Show the location", p.showLocation !== false, (v) => S({ showLocation: v })),
        this._check("Show tags (up to 5 per session)", p.showTags !== false, (v) => S({ showTags: v })),
        ...(p.showTags !== false ? [this._text("Tags custom field name", p.tagsField, (v) => S({ tagsField: v.trim() || "Tags" }), { url: false,
          hint: "A multi-choice session custom field in Cvent. Cvent’s built-in session tags aren’t available to custom widgets." })] : []),
        this._check("Location drop-down filter (when 2+ locations are used)", p.locationFilter !== false, (v) => S({ locationFilter: v })),
        ...(p.locationFilter !== false ? [this._text("Location filter label", p.locationLabel, (v) => S({ locationLabel: v }), { placeholder: "Location", hint: "Blank = “Location”, translated automatically." })] : []),
        this._check("Tags drop-down filter (when 2+ tags are used)", p.tagFilter !== false, (v) => S({ tagFilter: v })),
        ...(p.tagFilter !== false ? [this._text("Tags filter label", p.tagsLabel, (v) => S({ tagsLabel: v }), { placeholder: "Topics", hint: "Blank = “Topics”, translated automatically." })] : []),
        this._sub("Descriptions and speakers"),
        this._check("Show descriptions", p.showDescription !== false, (v) => S({ showDescription: v })),
        this._num("Description lines before “Read more”", p.descriptionLines, (v) => S({ descriptionLines: v }), { min: 0, max: 12, hint: "0 = always show the full description." }),
        this._select("“Speakers to be announced”", p.tbaMode || "field", [
          ["field", "Only sessions marked “Speakers TBA?” = Yes (recommended)"],
          ["all", "Every session without speakers"],
          ["off", "Never"],
        ], (v) => S({ tbaMode: v }), "Create a Yes/No session custom field named “Speakers TBA?” in Cvent and set it to Yes on the sessions still waiting for speakers. Sessions without speakers otherwise just show nothing there."),
        this._check("Show speaker photos", p.showPhotos !== false, (v) => S({ showPhotos: v })),
        this._text("Moderator speaker categories", p.moderatorCategories, (v) => S({ moderatorCategories: v }), { url: false,
          hint: "Comma separated Cvent speaker categories. These speakers are listed after the others, below a thin line, with a label above their name." }),
        this._text("Moderator label", p.moderatorLabel, (v) => S({ moderatorLabel: v }), { placeholder: "Moderator", hint: "Blank = “Moderator”, translated automatically." }),
        this._check("Speakers open their bio pop-up", p.speakerBios !== false, (v) => S({ speakerBios: v })),
        ...(p.speakerBios !== false ? [
          this._text("Bio pop-up eyebrow", p.modalEyebrowText, (v) => S({ modalEyebrowText: v }), { placeholder: "Speaker", hint: "Blank = “Speaker”, translated automatically. Speakers in the Cvent speaker category “Moderator” always show “Moderator”." }),
          this._check("List the speaker’s sessions in the bio pop-up", p.showSessions !== false, (v) => S({ showSessions: v })),
          this._text("Pop-up heading, several sessions", p.sessionsHeaderText, (v) => S({ sessionsHeaderText: v }), { placeholder: "Sessions", hint: "Blank = “Sessions”, translated automatically." }),
          this._text("Pop-up heading, one session", p.sessionHeaderText, (v) => S({ sessionHeaderText: v }), { placeholder: "Session", hint: "Blank = “Session”, translated automatically." }),
        ] : []),
      ]),
      this._hiddenGroup(p),
      this._ctaGroup(),
    ];
  }

  // Sessions hidden from the agenda: the custom field (set in Cvent) and/or
  // the list ticked here (for sessions whose fields can't be edited, e.g.
  // cancelled ones).
  _hiddenGroup(p) {
    const ids = (p.hiddenSessionIds || []).map(String);
    const set = (next) => this._patchSection("program", { hiddenSessionIds: next });
    const body = [
      this._hint("Cvent’s own “Display on agenda” switch isn’t available to custom widgets. To hide a session, add a Yes/No session custom field named “Hide from agenda?” and set it to Yes, or tick the session below."),
    ];
    if (!this._sessions.length) {
      body.push(this._hint(this._loading ? "Loading sessions…" : "No sessions found."));
    } else {
      const ul = this._el("ul", { class: "roster" });
      this._sessions.forEach((s) => {
        const id = String(s.id);
        const byField = isHiddenSession(s, []);
        const c = this._el("input", { type: "checkbox" });
        c.checked = byField || ids.includes(id);
        c.disabled = byField;
        c.onchange = () => set(c.checked ? [...ids, id] : ids.filter((x) => x !== id));
        ul.append(this._el("li", {}, this._el("label", { class: "check" }, c,
          this._el("span", { text: `${s.name || "(untitled)"}${byField ? " (hidden by custom field)" : ""}` }))));
      });
      body.push(this._el("span", { class: "lbl", text: `Hidden sessions (${this._sessions.filter((s) => isHiddenSession(s, ids)).length})` }), ul);
    }
    return this._group("hidden", "Hidden sessions", true, null, body);
  }
}
