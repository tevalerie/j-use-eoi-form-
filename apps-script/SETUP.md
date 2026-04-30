# J-USE REOI 2026 Backend — Setup Guide (Google Apps Script)

This is the entire backend in your Google tenant. **Total time: ~10 minutes.**

The `setup()` function auto-creates the Sheet and the `Applications` subfolder for you — no copying IDs, no editing config files.

---

## What you need before you start

- A Google account (the one that should own the data — recommended: the same account that owns the parent Drive folder).
- The three files in this folder: `Code.gs`, `Email_Applicant.html`, `Email_Grants.html`.

The Applications Drive folder is already wired into the script:
`https://drive.google.com/drive/folders/1SByBGFPCa5BtEtQfmvuQVnO5SRiTZX_Y`

When `setup()` runs it will create the submissions Google Sheet inside that folder. The folder will stay empty until the first applicant successfully submits — that's expected.

---

## Step 1 — Create the Apps Script project

1. Go to <https://script.google.com> and click **New project** (top-left).
2. Rename the project (top-left, where it says "Untitled project") to **`J-USE REOI 2026 Backend`**.
3. The default `Code.gs` file is open. Replace its contents with the contents of `Code.gs` from this folder.
4. Click the **+** next to "Files" → **HTML** → name it **`Email_Applicant`** (Apps Script adds `.html` automatically). Replace its contents with `Email_Applicant.html` from this folder.
5. Repeat for **`Email_Grants`**.
6. Save (⌘+S / Ctrl+S).

You should now have three files in the project: `Code.gs`, `Email_Applicant.html`, `Email_Grants.html`.

---

## Step 2 — Run `setup()` once

1. In the Apps Script editor, the function picker (top centre) shows `doPost`. Change it to **`setup`**.
2. Click **▶ Run**.
3. The first time, Google asks for permissions:
   - Click **Authorize access** → choose your account → click **Advanced** → **Go to J-USE REOI 2026 Backend (unsafe)** → **Allow**.
   - "Unsafe" just means "not Google-verified." It only does what's in `Code.gs`.
4. Open the **Execution log** (bottom panel). You should see something like:
   ```
   ✓ Created "Applications" subfolder: https://drive.google.com/...
   ✓ Created Submissions Sheet: https://docs.google.com/spreadsheets/...
   ✓ Grants notifications will be sent to: grants@efj.org.jm
   Setup complete.
   ```

That's it — the Sheet and the `Applications` subfolder are now wired up. Re-running `setup()` is safe and reuses what's already there.

---

## Step 3 — Deploy as a Web App

1. Click **Deploy** (top-right) → **New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Fill in:
   - **Description:** `J-USE REOI 2026 v1`
   - **Execute as:** `Me (your-email@…)`
   - **Who has access:** **Anyone** (required so the form can post without users signing in — the script runs as you and only does what's in `Code.gs`).
4. Click **Deploy**.
5. Copy the **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycbx…/exec
   ```

---

## Step 4 — Wire the form to the backend

Open `J-USE_REOI_2026_Application_Form.html`. Near the top of the main `<script>` block (around line 4201):

```js
const APPS_SCRIPT_URL = 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE';
```

Paste the URL from Step 3. Save. **Done.**

---

## Step 5 — Test

1. Open `J-USE_REOI_2026_Application_Form.html` in a browser.
2. Fill in the minimum required fields.
3. Submit.
4. Within ~30 seconds you should see:
   - A new row in the Google Sheet with a `JUSE-2026-000001` reference number.
   - A new sub-subfolder inside `Applications/` containing the uploaded files + the generated PDF.
   - A confirmation email at the applicant's address.
   - A notification email at `grants@efj.org.jm`.
   - The success page on the form showing the new reference number.

If anything is missing, open the Apps Script editor → **Executions** (left sidebar) for the error log.

---

## What changed for applicants

Three resilience features were added to the form:

1. **📄 Download PDF (top-right, always visible)** — applicants can save a PDF copy of their work at any time.
2. **Plan B modal on submission failure** — if the backend ever fails, a modal appears with [Download PDF] + [Email to grants@efj.org.jm] buttons so no work is lost.
3. **Draft export/import + auto-save** — the form auto-saves every 30 s. Applicants can also download a `.json` draft and re-load it later (handy for switching computers or recovering after clearing browser data).

This means even if the backend goes down on submission day, applicants still have a clean path to send their completed application to the grants team.

---

## Updating the script later

If you change `Code.gs` or either email template:

1. Edit and save in the Apps Script editor.
2. Click **Deploy** → **Manage deployments** → pencil icon on your existing deployment → **Version: New version** → **Deploy**.

The Web App URL **stays the same** — you do not need to update the form.

---

## How the pieces fit together

```
Browser (form)
   │
   │  1. User clicks Submit
   │  2. Browser renders PDF in hidden iframe (renderer + html2pdf.js)
   │  3. Browser reads file inputs as base64
   │  4. POST { formData, files, pdfBase64 }   →   Apps Script Web App
   │
   ▼
Apps Script (one .gs file in your Google account)
   │
   │  generateRefNumber  →  JUSE-2026-000123
   │  Drive: Applications/{refNumber — Org-Name}/  ← files + PDF
   │  Sheet: append row with key columns + JSON dump
   │  Mail: applicant confirmation + grants notification
   │
   ▼
Browser receives { ok: true, refNumber } and shows the success page.
   │
   ▼  (if POST fails)
Plan B modal: Download PDF + Email grants@efj.org.jm
```

---

## Limits to be aware of

| Limit | Value | What to do |
|---|---|---|
| Apps Script `doPost` payload | ~50 MB | Plenty for this form (3 docs + 1 PDF, typically <8 MB total). |
| `MailApp.sendEmail` per day | 100 (consumer) / 1500 (Workspace) | Workspace `grants@efj.org.jm` should be fine. |
| Script execution time | 6 min | Each submission completes in ~10–20 s. |

---

## Troubleshooting

**"Authorization required" when running `setup()`.** First-run only — accept the OAuth prompt and re-run.

**Submissions arrive but emails don't.** Check `Executions` in the Apps Script sidebar. Most common cause is the daily `MailApp` quota — wait 24h or upgrade the sender to Workspace.

**Submission shows "PDF generation timeout."** The renderer (`juse-full-pdf-renderer.html`) or its `pdf-*.js` dependencies aren't reachable from the form's origin. Make sure they're served from the same folder.

**CORS error in the browser console.** The form uses `Content-Type: text/plain` to avoid the CORS preflight (Apps Script Web Apps require this). The form is already set up correctly — don't change it.

**Need to reset the reference-number counter.** In the Apps Script editor → **Project Settings** (gear) → **Script Properties** → edit `refCounter`.

---

## Files in this folder

| File | Purpose |
|---|---|
| `Code.gs` | The entire backend — paste into the Apps Script `Code.gs` editor file. |
| `Email_Applicant.html` | Applicant confirmation template (with `{{PLACEHOLDERS}}`). |
| `Email_Grants.html` | Grants-team notification template. |
| `SETUP.md` | This file. |
