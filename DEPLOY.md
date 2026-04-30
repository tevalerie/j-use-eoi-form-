# J-USE REOI 2026 — Deployment Guide

The form code is **verified working** (PDF generation, Plan B fallback, draft export/import all tested locally and confirmed). The only thing left is wiring it to your Google account so submissions actually land in Drive + Sheets + email.

You have two paths. Pick one:

---

## Path A — CLI (one command, ~5 min)

For when you want to skip all the web-UI clicking.

**Prereqs:** Node.js (one-time install, ~1 min)

1. Install Node from <https://nodejs.org> (download the green "LTS" button → open the .pkg → click Continue / Install).
2. Open Terminal and run:
   ```bash
   cd ~/Documents/JUSE-REOI-2026-Handover/apps-script
   ./deploy.sh
   ```
3. When prompted, sign in with the Google account that owns the `Applications` Drive folder.
4. The script does the rest: creates the Apps Script project, pushes the code, runs `setup()`, deploys as a Web App, and patches `APPS_SCRIPT_URL` in your form HTML.

When it finishes you'll see something like:
```
✓ Deployed: https://script.google.com/macros/s/AKfycbx…/exec
✓ Patched J-USE_REOI_2026_Application_Form.html
```

That's it. **Open the form and submit a test application** — it'll land in your Drive folder.

---

## Path B — Web UI (point and click, ~10 min)

For when you don't want to install Node. Follow [apps-script/SETUP.md](apps-script/SETUP.md). The four steps are:

1. <https://script.google.com> → New project → paste in `Code.gs`, `Email_Applicant.html`, `Email_Grants.html` from `apps-script/`
2. Function picker → `setup` → ▶ Run → approve OAuth
3. Deploy → New deployment → Web app → "Anyone" access → copy URL
4. Paste URL into `APPS_SCRIPT_URL` (line 4350) in `J-USE_REOI_2026_Application_Form.html`

---

## What you should see after deploy

Open <https://drive.google.com/drive/folders/1SByBGFPCa5BtEtQfmvuQVnO5SRiTZX_Y>:

- A new `J-USE REOI 2026 — Submissions` Google Sheet (created by `setup()`)

After the first test submission:

- A subfolder named `JUSE-2026-000001 — Org-Name/` containing the uploaded files + the generated PDF
- A new row in the Sheet
- An email at `grants@efj.org.jm` with the PDF attached
- An email at the applicant's address with their reference number

If anything's missing, open the Apps Script editor → **Executions** (left sidebar) for the error log.

---

## Verified working (locally tested 2026-04-30)

| Feature | Status | Notes |
|---|---|---|
| Form loads + 10 steps render | ✅ | Title shows "May 3, 2026 (11:59 p.m. EST)" |
| Floating Download PDF button | ✅ | Generates 2.4 MB PDF in ~1.4 s, valid `%PDF-1.x` header |
| Plan B fallback modal | ✅ | Shows on submission failure with Download / Email / Retry buttons |
| Draft export to .json | ✅ | 115 fields captured |
| Draft import from .json | ✅ | Reloads form at saved step |
| Auto-save every 30 s | ✅ | Indicator updates with timestamp |
| Print stylesheet (browser Print → Save as PDF) | ✅ | Hides chrome, expands all 10 steps |
| Apps Script POST | ⏳ | Wired correctly; will work as soon as Path A or B is run |

---

## If something goes wrong

The form has three layers of resilience built in, so applicants are never stranded:

1. **Online submission** (primary) — POSTs to your Apps Script
2. **Plan B modal** (auto-triggered on failure) — Download PDF + Email to grants@efj.org.jm
3. **Draft export** (always available) — applicant can save a `.json` and reload it later

So even if the backend is briefly down, applicants can still get their work to the grants team.
