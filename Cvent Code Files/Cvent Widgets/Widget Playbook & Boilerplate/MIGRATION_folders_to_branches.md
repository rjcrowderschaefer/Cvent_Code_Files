# Migration: Two Folders → Two Branches

Your current setup: ONE repo with `prod/` and `sandbox/` folders holding
near-identical files at different versions.

Target: same repo, but `main` branch = prod code, `dev` branch = sandbox code,
files at the repo ROOT (no `prod/`/`sandbox/` folders). Promotion becomes
`git merge dev` instead of copying files between folders.

> **Nothing you do here touches Cvent.** Git only changes local files + GitHub.
> Your live widgets keep running until YOU manually upload a file. Zero risk to
> live agendas during this migration.

---

## Before you start (safety net)

Make a full backup so you can always get back to today's state:

```bash
cd <your-repo>
git status                       # confirm a clean working tree (commit/stash any WIP first)
git checkout main 2>/dev/null || git checkout master   # your current default branch
git tag backup-before-branch-migration                 # a restore point
git push origin backup-before-branch-migration         # push the tag to GitHub
```

Also, physically copy the repo folder somewhere as a belt-and-suspenders backup
(e.g. zip it). If anything goes sideways, you delete the working copy and restore
from the zip.

---

## Step 1 — Move PROD files to the root on `main`

Your current default branch (call it `main`) will hold the PROD code at the root.

```bash
git checkout main                # (or master)

# Move prod files up to the repo root
git mv prod/widget.js widget.js
git mv prod/AgendaItem.js AgendaItem.js
git mv prod/editor.js editor.js
git mv prod/config.json config.json
# ...repeat for any other prod files...

# Remove the now-empty prod folder and the sandbox folder from THIS branch
# (sandbox code will live on the dev branch instead)
git rm -r sandbox
rmdir prod 2>/dev/null || true

git add -A
git commit -m "Flatten prod files to root; remove folders (main = prod)"
git push origin main
```

At this point `main` has your PROD code at the root, no folders. ✅

---

## Step 2 — Create the `dev` branch and put SANDBOX code on it

```bash
# Branch dev off main (so it shares history)
git checkout -b dev

# Right now dev has the PROD files (inherited from main). Overwrite them with
# your SANDBOX versions. Easiest: pull the sandbox files from the tagged backup.

# Get each sandbox file from the backup tag into the working tree at root:
git checkout backup-before-branch-migration -- sandbox/widget.js
git checkout backup-before-branch-migration -- sandbox/AgendaItem.js
git checkout backup-before-branch-migration -- sandbox/editor.js
git checkout backup-before-branch-migration -- sandbox/config.json
# ...repeat for others...

# Those landed under sandbox/ — move them to root, replacing the prod versions:
mv -f sandbox/widget.js widget.js
mv -f sandbox/AgendaItem.js AgendaItem.js
mv -f sandbox/editor.js editor.js
mv -f sandbox/config.json config.json
rm -rf sandbox

git add -A
git commit -m "dev branch = sandbox code at root"
git push -u origin dev
```

Now:
- `main` = prod code (root)
- `dev`  = sandbox code (root)
- Both share history; `git diff main dev` shows exactly how sandbox differs from prod. ✅

---

## Step 3 — Verify before trusting it

```bash
# Confirm main has prod code:
git checkout main
git log --oneline -3
head -5 widget.js                # sanity-check it's the prod version

# Confirm dev has sandbox code:
git checkout dev
head -5 widget.js                # sanity-check it's the sandbox version

# See the difference (should reflect sandbox-ahead-of-prod changes):
git diff main dev --stat
```

If `main` = prod and `dev` = sandbox and the diff looks right, you're done.
If something's off, you still have the `backup-before-branch-migration` tag and
your zip — restore and retry.

---

## Step 4 — Clean up (after you're confident, days later)

```bash
# Once you trust the new structure, you can delete the backup tag:
git tag -d backup-before-branch-migration
git push origin :refs/tags/backup-before-branch-migration
```
(Keep the zip backup a while longer — it's free insurance.)

---

## Your new day-to-day (folders are gone)

```
Develop:   git checkout dev → edit widget.js etc. → upload to Cvent SANDBOX → test (incognito)
Save:      git add . && git commit -m "..." && git push origin dev
Promote:   git checkout main && git merge dev && git push origin main
Deploy:    upload main's files to Cvent PROD → confirm matches sandbox
Inspect:   git diff main dev     (what prod will gain before you merge)
```

- Files are always `widget.js`, `AgendaItem.js`, etc. — **no folders, no `_dev`
  suffix.** The branch is the environment marker.
- You edit on `dev`, upload those files to the Cvent **Sandbox** widget.
- When verified, `git merge dev` into `main`, then upload `main`'s files to the
  Cvent **Prod** widget. The merge guarantees prod = what you tested.

---

## If you get stuck mid-migration

Nothing is committed to `main`/`dev` remotely until you `push`. Before pushing,
you can always bail:
```bash
git checkout main
git reset --hard backup-before-branch-migration   # local main back to pre-migration
```
And your Cvent widgets were never touched regardless.

---

## Common questions

**Q: Will this break the connection between my repo and the Cvent widgets?**
No — there is no automatic connection. You upload files to Cvent manually. Git
restructuring is invisible to Cvent.

**Q: Do I lose my commit history?**
No. Branching off `main` preserves all history. Both branches share the past;
they only diverge going forward.

**Q: What if prod and sandbox had different filenames?**
Name them by their real Cvent filenames at the root (whatever Cvent expects on
upload). The branch — not the filename — distinguishes environments.

**Q: Can I keep the folders too, just in case?**
Don't — that reintroduces the drift/confusion. The tag + zip backups are your
safety net instead.
