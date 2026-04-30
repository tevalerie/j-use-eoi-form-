# Hosting on GitHub Pages

End-state: **one URL** that EFJ can embed in their website. Updates take seconds. Free, no maintenance.

Your live URL will be: **`https://tevalerie.github.io/j-use-eoi-form-/`**

---

## Step 1 — Create the GitHub repository (one-time, ~2 min)

1. Go to <https://github.com/new>
2. Sign in as **tevalerie** if prompted.
3. Fill in:
   - **Owner:** `tevalerie`
   - **Repository name:** `juse-reoi-2026`
   - **Description:** `J-USE Nature-based Climate Solutions Programme 2026 — Expression of Interest application form`
   - **Visibility:** **Public** (required for free GitHub Pages)
   - **Initialize this repository:** leave UNCHECKED (we already have files locally)
4. Click **Create repository**

You'll land on an empty-repo page with quick-start instructions. Ignore them — the next step uses the right ones.

---

## Step 2 — Push the project to GitHub (~3 min, one-time)

In Terminal:

```bash
cd ~/Documents/JUSE-REOI-2026-Handover

# Configure git with your details (one-time setup, then never again)
git config --global user.name "T. Valerie Onu"
git config --global user.email "tellyonu@gmail.com"

# Initialise the repo and commit everything (the .gitignore I created
# automatically excludes .node/, node_modules/, .clasp.json, .claude/, etc.)
git init
git add .
git commit -m "Initial commit — production J-USE REOI 2026 form + Apps Script backend"

# Connect to your GitHub repo and push
git branch -M main
git remote add origin https://github.com/tevalerie/j-use-eoi-form-.git
git push -u origin main
```

When you run `git push`, a browser window will open asking you to authorise GitHub. Sign in as **tevalerie**, click **Authorize**. The push completes in ~10 seconds.

---

## Step 3 — Enable GitHub Pages (~30 seconds)

1. In your browser, go to **`https://github.com/tevalerie/j-use-eoi-form-/settings/pages`**
2. Under **Source**, select **Deploy from a branch**
3. Under **Branch**, choose **`main`** and folder **`/ (root)`**
4. Click **Save**
5. Wait ~30 seconds. Refresh the page. You'll see a green banner:
   > **Your site is live at https://tevalerie.github.io/j-use-eoi-form-/**

That's your production URL. Anyone with the link can fill in the form.

---

## Step 4 — Test the live URL

Open <https://tevalerie.github.io/j-use-eoi-form-/> in any browser.

You should see:
- The landing page → auto-redirects to the application form within 1 second
- 📋 **See Worked Example** button at the top — loads the Hybrid Community Farm sample data
- 📄 **Download PDF** floating button (top-right) — opens the print preview

Submit a test application end-to-end to confirm Apps Script is still wired correctly. New submissions will land in your Drive's `Applications` folder + the Submissions Sheet exactly as before — GitHub Pages only changes WHERE the form is served, not what it does.

---

## Step 5 — Embed in EFJ's website

Send the EFJ web team this URL:

> **`https://tevalerie.github.io/j-use-eoi-form-/`**

They have two options for putting it on the EFJ site:

### Option A — Embed in an iframe (form opens in-page)

```html
<iframe
  src="https://tevalerie.github.io/j-use-eoi-form-/"
  width="100%"
  height="900"
  style="border:0; max-width: 1000px; margin: 0 auto; display: block;"
  allow="clipboard-write"
  title="J-USE REOI 2026 Application Form">
</iframe>
```

### Option B — Link button (form opens in a new tab)

```html
<a href="https://tevalerie.github.io/j-use-eoi-form-/"
   target="_blank"
   rel="noopener"
   style="display:inline-block; background:#2E8B57; color:white;
          padding:14px 28px; border-radius:8px; text-decoration:none;
          font-weight:600;">
  Apply Now — J-USE REOI 2026 →
</a>
```

Option B is simpler and more reliable — most embedded forms suffer from height/scrolling issues. Recommend Option B unless EFJ specifically wants the form embedded inline.

---

## Updating the form later

Whenever you change anything in the form:

```bash
cd ~/Documents/JUSE-REOI-2026-Handover

git add .
git commit -m "describe what changed"
git push
```

GitHub Pages automatically rebuilds in ~30 seconds. Applicants see the new version on next page load. **No version pinning, no service window required, no IT involvement.**

To roll back a bad change:

```bash
git log --oneline       # find the previous commit's hash
git revert <hash>       # creates a new "undo" commit
git push                # publishes the rollback
```

---

## What's NOT on GitHub (and shouldn't be)

`.gitignore` already excludes:
- `.node/` — local Node install (161 MB), not needed for GitHub Pages
- `apps-script/node_modules/` — npm dependencies for clasp (205 MB), reinstallable via `npm install` in `apps-script/`
- `apps-script/.clasp.json` — your script ID + project metadata (private — keeps the deploy chain working from your machine only)
- `.claude/` — local dev config

The Apps Script backend code (`apps-script/Code.gs`, etc.) IS in the repo for version-control and handover, but it's not served by GitHub Pages — Apps Script runs from `script.google.com` under your `tellyonu@gmail.com` account.

---

## If you ever need to take the form offline

Two options:
1. **Pause submissions but leave the form visible**: in `apps-script/Code.gs`, add at the top of `doPost`:
   ```js
   return jsonResponse_({ ok: false, error: 'Submissions are currently closed.' });
   ```
   Then `apps-script/deploy.sh` to push.
2. **Take the form down entirely**: in GitHub repo settings → Pages → Source: **None**. Disables the URL immediately.

---

## Why GitHub Pages instead of EFJ's web server

| | GitHub Pages | EFJ web server |
|---|---|---|
| Cost | Free | (whatever EFJ pays for hosting) |
| HTTPS | Automatic, free | Depends on EFJ's setup |
| Uptime | 99.9%+ (Microsoft infrastructure) | Depends on EFJ's hosting |
| Updates | `git push`, ~30 s | Coordinate with EFJ IT |
| If EFJ's main site goes down | Form stays up | Form goes down too |
| Embedding into EFJ's site | iframe or link from EFJ pages | Direct hosting |
| Past evidence | Stable | We saw the PocketBase/Railway setup break in late April |

GitHub Pages is the lowest-risk choice for the May 3 deadline.
