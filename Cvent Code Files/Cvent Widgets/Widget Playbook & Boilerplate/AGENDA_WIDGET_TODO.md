# Agenda Widget — Backlog & Deferred Items

Seeded 2026-09-11 from the open items carried over from the previous chat.
Add detail to each item as it's picked up; move done items to the bottom.

## Open

- [ ] **Remove debug logs before next promote** — `AgendaItem.js` (`TILE DBG |`),
      `editor.js` (`SO DROPDOWN | value:`).
- [ ] **~20-min concurrent tile drops speaker avatars** in one case. Suspected
      avatar height vs. MIN_H measurement. Paused as "good enough"; revisit if a
      planner reports it.
- [ ] **Option A rail unification** — (details to be filled in)
- [ ] **Compact-mode cutover + toggle removal** — compact typography is already
      the default scale; remove the legacy toggle once all live events are confirmed on it.
- [ ] **Normal-card modal unification** — share modal CSS/markup between the
      full-card and tile render paths (see Playbook §5 shadow-root CSS gotcha).
- [ ] **Grid ↔ stack resize re-render** — concurrent tile grid should re-lay out
      on viewport resize instead of requiring a reload.

## Done

(nothing yet under the branch workflow)
