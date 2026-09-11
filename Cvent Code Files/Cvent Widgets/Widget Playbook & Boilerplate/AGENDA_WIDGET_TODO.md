# Agenda Widget — Backlog & Deferred Items

Seeded 2026-09-11 from the open items carried over from the previous chat.
Add detail to each item as it's picked up; move done items to the bottom.

## Open

- [ ] **Remove debug log before next promote** — `editor.js` (`SO DROPDOWN | value:`).
- [ ] **Option A rail unification** — (details to be filled in)
- [ ] **Compact-mode cutover + toggle removal** — compact typography is already
      the default scale; remove the legacy toggle once all live events are confirmed on it.
- [ ] **Normal-card modal unification** — share modal CSS/markup between the
      full-card and tile render paths (see Playbook §5 shadow-root CSS gotcha).
- [ ] **Grid ↔ stack resize re-render** — concurrent tile grid should re-lay out
      on viewport resize instead of requiring a reload.

## Done

- [x] 2026-09-11 **Short concurrent tiles hid their speaker avatars.** Root cause was
      not the avatar measurement: tiles were positioned by pure time math but
      clamped up to MIN_H (118px), so a 20-min tile (80px of time) bled under the
      next tile in its column, which painted over the avatars pinned to its bottom.
      Fix in `widget.js` `_renderConcurrentGrid`: the time→px scale now stretches
      wherever a session needs MIN_H, so tiles never overlap. The `TILE DBG` log
      that was chasing this is removed.
