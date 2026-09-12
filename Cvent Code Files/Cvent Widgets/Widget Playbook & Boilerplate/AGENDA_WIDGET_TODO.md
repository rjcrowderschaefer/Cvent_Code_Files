# Agenda Widget — Backlog & Deferred Items

Seeded 2026-09-11 from the open items carried over from the previous chat.
Add detail to each item as it's picked up; move done items to the bottom.

## Open

- [ ] **Editorial header style — decide.** Opt-in `headerStyle: "editorial"` shipped to
      dev 2026-09-12 for review in the preview. Either promote it as the new default
      (and retire classic) or keep it as a planner option. Open questions: tab strip
      on very long multi-day events (8+ days) and whether the concurrent block
      sub-row should adopt the same eyebrow styling.
- [ ] **Option A rail unification** — (details to be filled in)
- [ ] **Compact-mode cutover + toggle removal** — compact typography is already
      the default scale; remove the legacy toggle once all live events are confirmed on it.
- [ ] **Grid ↔ stack resize re-render** — concurrent tile grid should re-lay out
      on viewport resize instead of requiring a reload.

## Done

- [x] 2026-09-12 **Short concurrent sessions.** Strip / compact / full tile tiers by
      duration (<=15 / 16–29 / >=30 min) with matching height floors, so a 5-minute
      item no longer occupies a 30-minute tile or stretches the axis five-fold.
- [x] 2026-09-12 **Doubled agenda on rapid config updates** fixed with a render
      sequence guard in `widget.js` (`_renderSeq`).
- [x] 2026-09-12 **Sticky date nav removed.** The date nav is now a plain row under
      the subheader; clicking a day still scrolls its header below Cvent's site
      header (measured live at click time). Gone: sticky positioning, the header
      measurement on scroll/resize, the scroll-spy, and the "Sticky offset" editor
      control. `dateNav.stickyOffset` in saved configs is ignored.
- [x] 2026-09-11 **Normal-card modal unification.** One modal shell (`.sbackdrop`/`.smodal`)
      now serves the tile session view, its speaker view, and the speaker opened from a
      standalone card (close-only header, no back link). CSS lives in
      `AgendaItem._sharedModalCss()` and is injected into BOTH render paths. The old
      `buildModal()` / accent-coloured header modal is gone; the "Modal Name (top header)"
      typography control was removed with it.
- [x] 2026-09-11 Removed the last debug log (`SO DROPDOWN` in `editor.js`). All three files are clean.
- [x] 2026-09-11 **Short concurrent tiles hid their speaker avatars.** Root cause was
      not the avatar measurement: tiles were positioned by pure time math but
      clamped up to MIN_H (118px), so a 20-min tile (80px of time) bled under the
      next tile in its column, which painted over the avatars pinned to its bottom.
      Fix in `widget.js` `_renderConcurrentGrid`: the time→px scale now stretches
      wherever a session needs MIN_H, so tiles never overlap. The `TILE DBG` log
      that was chasing this is removed.
