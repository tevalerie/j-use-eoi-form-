# Migrating the Apps Script backend to a Google Workspace account

> **When to do this:** Only if you expect **more than ~50 submissions per day** during the peak window before May 3.
>
> **Why it helps:** Consumer Gmail (`tellyonu@gmail.com`) has a 100-email/day `MailApp` quota → ~50 submissions/day (each one sends 2 emails: applicant + grants). Workspace accounts get **1,500 emails/day** → ~750 submissions/day. 15× the headroom.
>
> **How long it takes:** ~30 minutes. Mostly waiting for permissions checks.

---

## Pre-flight check (1 minute) — is grants@efj.org.jm actually Workspace?

Workspace = the paid Google service for organisations (custom domain emails like `name@efj.org.jm`). Consumer = the free `@gmail.com` accounts.

If `grants@efj.org.jm` exists, it's almost certainly Workspace (the `efj.org.jm` domain wouldn't work otherwise). To confirm:

1. Sign in at <https://gmail.com> as `grants@efj.org.jm`
2. Top-right avatar → if you see "**Manage your Google Account**" → click it
3. Look for "**Google Workspace**" anywhere in the left nav or under "About"

If yes, proceed below. If no (e.g., the address forwards to a personal Gmail), pick another Workspace account at EFJ to host the Apps Script project (any `@efj.org.jm` mailbox works).

---

## Step 1 — Share the existing Drive folder + Sheet with the Workspace account (~2 min)

The Drive folder and Submissions Sheet currently live in `tellyonu@gmail.com`'s Drive. The new Workspace-account Apps Script needs Editor access to them.

1. Sign in as **`tellyonu@gmail.com`**
2. Open the **Applications** folder: <https://drive.google.com/drive/folders/1SByBGFPCa5BtEtQfmvuQVnO5SRiTZX_Y>
3. Top-right share icon (👤+) → enter `grants@efj.org.jm` → set permission to **Editor** → uncheck "Notify people" → **Share**
4. Inside the folder, find **`J-USE REOI 2026 — Submissions`** Sheet → right-click → **Share** → add `grants@efj.org.jm` → **Editor** → **Share**

The Drive folder ID + Sheet ID don't change — Workspace just gets edit rights.

---

## Step 2 — Create a new Apps Script project under the Workspace account (~5 min)

1. Sign out of `tellyonu@gmail.com`. Sign in as **`grants@efj.org.jm`**.
2. Go to <https://script.google.com/home/usersettings> → toggle **Google Apps Script API** to **ON** (Workspace accounts have this off by default; same one-toggle as last time).
3. Open <https://script.google.com> → **+ New project**
4. Rename the project (top-left) to **`J-USE REOI 2026 Backend (Workspace)`**

You'll do the actual code copy via `clasp` — it's faster than manual paste.

---

## Step 3 — Use clasp from your laptop to push the same code into the new project (~10 min)

You already have `clasp` installed locally from the original deploy. From Terminal:

```bash
cd ~/Documents/JUSE-REOI-2026-Handover/apps-script

# 1. Add a credentials file for the Workspace account
PATH="$(cd .. && pwd)/.node/bin:$PATH" \
  ./node_modules/.bin/clasp logout

PATH="$(cd .. && pwd)/.node/bin:$PATH" \
  ./node_modules/.bin/clasp login
```

A browser opens. **Sign in as `grants@efj.org.jm` this time.** Approve permissions. Terminal prints `Authorization successful.`

Now you need the new project's Script ID. From the Apps Script editor (signed in as `grants@`), click ⚙️ **Project Settings** → **Script ID** → copy it (looks like `1aBcDeF...XYZ`).

```bash
# 2. Replace the existing .clasp.json with one pointing at the new project
cd ~/Documents/JUSE-REOI-2026-Handover/apps-script

# Back up the old one (so you can switch back later if needed)
mv .clasp.json .clasp.json.tellyonu

# Create the new one — paste the Workspace project's Script ID where shown
echo '{"scriptId":"PASTE_NEW_SCRIPT_ID_HERE","rootDir":"."}' > .clasp.json

# 3. Push the code into the new (Workspace) project
PATH="$(cd .. && pwd)/.node/bin:$PATH" \
  ./node_modules/.bin/clasp push --force
```

You should see:
```
Pushed 6 files.
```

Refresh the Apps Script editor in your browser → you'll see `Code.gs`, `Schema.gs`, `Templates.gs`, `Email_Applicant.html`, `Email_Grants.html`, `appsscript.json`.

---

## Step 4 — Configure the new project to use the SAME Sheet + Drive folder (~3 min)

Open the new project in the editor. You need to set its Script Properties to point at the existing resources (so all historical submissions stay together in one Sheet/folder):

1. ⚙️ **Project Settings** → scroll to **Script Properties** → **Add script property**
2. Add these two:

| Property | Value |
|---|---|
| `SHEET_ID` | `<the existing Submissions Sheet ID — find it in the URL when you open the Sheet>` |
| `DRIVE_FOLDER_ID` | `1SByBGFPCa5BtEtQfmvuQVnO5SRiTZX_Y` |

3. Save.

**Don't** run `setup()` from this project — that would create new Sheet + folder. The Script Properties above tell the code to reuse what `tellyonu@` already created.

---

## Step 5 — Deploy as a Web App from the Workspace account (~2 min)

In the new project's editor:

1. **Deploy** → **New deployment**
2. Gear icon → **Web app**
3. **Description:** `J-USE REOI 2026 Workspace v1`
4. **Execute as:** `Me (grants@efj.org.jm)` ← this is the critical one — quota now uses Workspace's 1,500/day
5. **Who has access:** **Anyone**
6. **Deploy**
7. Approve permissions when prompted (Workspace might ask one extra confirmation about external-domain email — click Allow)
8. **Copy the new Web App URL** (looks like `https://script.google.com/macros/s/AKfycbz.../exec`)

---

## Step 6 — Point the form at the new URL (~1 min)

```bash
cd ~/Documents/JUSE-REOI-2026-Handover

# Open the form HTML and replace the existing APPS_SCRIPT_URL at line ~4350
# Use sed for precision; OR just open the file in any editor and find/replace
sed -i '' 's|https://script.google.com/macros/s/AKfycbyyKe9jNhtQrKf0VyRrErRBXFp2NXk6_V-dzwBvkP8g92TFZmEURIfn1hoFIvXYslk/exec|<PASTE_NEW_WORKSPACE_URL_HERE>|g' \
  J-USE_REOI_2026_Application_Form.html

# Push the change to GitHub Pages
git add J-USE_REOI_2026_Application_Form.html
git commit -m "Switch backend to Workspace account for higher email quota"
git push
```

GitHub Pages rebuilds in ~30 seconds. Live form now POSTs to the Workspace deployment.

---

## Step 7 — Test the migration (~3 min)

1. Open <https://tevalerie.github.io/juse-reoi-2026/?prefill=1> in your browser
2. Submit a test application
3. Confirm:
   - ✅ Both inboxes (`tellyonu@gmail.com` + `grants@efj.org.jm`) receive the email
   - ✅ A new row appears in the Submissions Sheet (under the SAME spreadsheet, since you re-used `SHEET_ID`)
   - ✅ A new subfolder appears in the Drive `Applications` folder
   - ✅ The Apps Script editor (signed in as `grants@`) → ⏱️ Executions shows the doPost succeeding

If all four ticks ✅, migration is complete.

---

## Step 8 — Decommission the old deployment (optional, ~1 min)

Once you've verified everything works on the Workspace deployment for a few days, you can disable the old `tellyonu@`-owned Web App so there's no confusion:

1. Sign in as `tellyonu@gmail.com` → open the original Apps Script project
2. **Deploy** → **Manage deployments**
3. Click ✏️ on the old `J-USE REOI 2026 production` deployment → **Archive**

The old URL stops responding. New URL (Workspace) is the only one in the form HTML, so applicants are unaffected.

---

## Switching back if needed

The original Apps Script deployment in `tellyonu@gmail.com` is still there until you archive it. To switch the form back at any time:

```bash
cd ~/Documents/JUSE-REOI-2026-Handover

# Restore the original URL in the form
sed -i '' 's|<WORKSPACE_URL>|https://script.google.com/macros/s/AKfycbyyKe9jNhtQrKf0VyRrErRBXFp2NXk6_V-dzwBvkP8g92TFZmEURIfn1hoFIvXYslk/exec|g' \
  J-USE_REOI_2026_Application_Form.html

git commit -am "Revert to consumer-Gmail backend"
git push
```

Or to switch your local clasp setup back:

```bash
cd ~/Documents/JUSE-REOI-2026-Handover/apps-script
mv .clasp.json .clasp.json.workspace
mv .clasp.json.tellyonu .clasp.json   # the backup from Step 3
PATH="$(cd .. && pwd)/.node/bin:$PATH" ./node_modules/.bin/clasp logout
PATH="$(cd .. && pwd)/.node/bin:$PATH" ./node_modules/.bin/clasp login   # sign in as tellyonu@gmail.com
```

---

## What about the historical executions log?

Each Apps Script project has its own Executions log. After migration:
- Old logs (`tellyonu@`) — preserved in that project; review at any time by signing in as `tellyonu@`
- New logs (`grants@`) — start fresh in the Workspace project

The actual submission data (Sheet rows, Drive files) is **shared** — both projects write to the same Sheet + folder via the shared resource IDs. So your audit trail is continuous.

---

## Quick decision checklist

| Question | If "yes" — migrate to Workspace | If "no" — stay on consumer Gmail |
|---|---|---|
| Do you expect > 50 submissions in any single day? | ✅ migrate | ❌ stay |
| Is `grants@efj.org.jm` a Workspace account? | (proceed) | (use a different Workspace account) |
| Is the EFJ IT team OK with grants@efj.org.jm running an Apps Script? | (proceed) | (talk to them first) |
| Do you have ~30 min to migrate? | (do it) | (defer until needed) |

If submissions look like they'll stay below ~30/day even at peak, **stay on consumer Gmail**. Migration adds operational complexity for no benefit. The Plan B modal in the form already catches any quota overrun and lets applicants email manually.
