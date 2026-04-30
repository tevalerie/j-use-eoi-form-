# J-USE REOI 2026 Application System

> **Live form:** [`https://tevalerie.github.io/j-use-eoi-form-/`](https://tevalerie.github.io/j-use-eoi-form-/) *(once GitHub Pages is enabled)*
>
> **Deadline:** May 3, 2026 (11:59 p.m. EST)
> **Status:** Production — frontend, PDF renderer, and Google Apps Script backend all live.

---

## What this repo contains

| File / folder | Purpose |
|---|---|
| `index.html` | Landing page that auto-redirects to the application form (so the bare GitHub Pages URL works) |
| `J-USE_REOI_2026_Application_Form.html` | The 10-step application form (the thing applicants actually use) |
| `juse-full-pdf-renderer.html` | The PDF renderer template — opened in a hidden iframe by the form, populated with submission data, then printed to PDF via the browser's native engine |
| `pdf-core.js`, `pdf-sections.js`, `pdf-tables.js` | Renderer logic (helpers, scalar field population, dynamic tables) |
| `sample-applicationData.json` | Worked-example data — populates every field via the **📋 See Worked Example** button on the form (Hybrid Community Farm — Clarendon Youth Farmers Cooperative). Applicants see what a complete submission looks like; they then clear fields and add their own data. |
| `apps-script/` | Google Apps Script Web App — the backend. Generates JUSE-2026-XXXXXX ref numbers, saves submissions to Drive + Sheets, sends applicant + grants confirmation emails. **Not served by GitHub Pages** — lives in EFJ's Google account; this folder is for version control only. |

## How a submission flows

```
Applicant opens form on GitHub Pages
  ↓
Fills 10 steps; auto-saves to localStorage every 30 s; can save/load draft as .json
  ↓
Clicks Submit → opens 3-step modal:
  Step 1: Open print preview → user saves the camera-ready PDF
  Step 2: Re-attach the saved PDF
  Step 3: Sending… → success page with JUSE-2026-XXXXXX ref number
  ↓
Apps Script receives:
  · Form data (all 154 fields, structured arrays)
  · 3 or 4 uploaded documents (Letter of Intent, Capacity, Budget, Reg Cert)
  · The applicant's saved PDF (camera-ready)
  ↓
Apps Script then:
  · Creates Drive subfolder under EFJ-J-USE Project Team / Applications /
  · Saves all docs + the PDF to that subfolder
  · Writes a row to Sheet1 (quick view)
  · Writes structured rows to 12+ schema tabs (applications_master, multiselect_selections,
    outcome_metrics, benefit_traceability, focus_lens_selections, enablers_detail,
    implementation_roles, tna_scores, documents, plus pre-filled identity rows on the
    3 reviewer/analyst tabs)
  · Sends applicant confirmation email (with PDF attached)
  · Sends grants notification email to grants@efj.org.jm (same PDF attached)
```

## Key features

- **One PDF, used everywhere** — the user's saved PDF flows into both emails AND the Drive folder. No duplicate / inconsistent versions.
- **Camera-ready PDF** via the browser's native print engine (no html2pdf.js rasterisation).
- **Two-phase POST** — Apps Script reserves the JUSE-2026-XXXXXX ref number FIRST so it appears on the PDF the applicant saves.
- **Conditional document requirements** — Government / SOE / informal CBO applicants don't need a Registration Certificate; everyone else does (4 docs total).
- **Resilience layers** — auto-save every 30 s, draft export/import as `.json`, and a Plan B modal that lets applicants email a saved PDF directly to grants@efj.org.jm if the backend ever fails.

## Architecture (no servers, no databases to maintain)

| Layer | Where it runs |
|---|---|
| Form HTML + renderer + JS | **GitHub Pages** (this repo) |
| Backend (refs, Drive, Sheets, emails) | **Google Apps Script** in `tellyonu@gmail.com` |
| Submission data | **Google Sheet** — `J-USE REOI 2026 — Submissions` (16 tabs) |
| Uploaded documents + PDFs | **Google Drive** — `EFJ-J-USE Project Team / Applications / JUSE-2026-XXXXXX — Org-Name /` |

Replaces the original architecture (PocketBase + Railway + Netlify Functions + Puppeteer + Google Sheets API + email service — 6 moving parts) with two: GitHub Pages + one Apps Script Web App.

## Field schema

The Sheet's structured tabs follow the `J_USE_Complete_GoogleSheet_Output_Workbook.xlsx` spec (provided by the SFM team). The 9 form-fed tabs auto-populate from each submission; the 5 static-metadata tabs are pre-populated once on `setup()`; the 3 reviewer/analyst tabs (`tna_analytics`, `iucn_alignment_report`, `capital_alignment_report`) get identity columns pre-filled per submission with the assessment columns left blank for human reviewers; the 1 leads tab captures parish-ineligible exits.

## Updating the form

1. Edit any HTML / JS file in this repo
2. `git commit -am "your change" && git push`
3. GitHub Pages auto-rebuilds in ~30 seconds — applicants see the change immediately

The Apps Script backend updates are independent — those happen via `apps-script/deploy.sh` (uses `clasp` to push and deploy in place at the same Web App URL).

## Setup docs

- **GitHub Pages first-time setup:** see [`HOSTING.md`](HOSTING.md) (created alongside this push)
- **Apps Script backend setup:** see [`apps-script/SETUP.md`](apps-script/SETUP.md)
- **Local-dev / clasp deploy:** see [`DEPLOY.md`](DEPLOY.md)

## Maintainers

T. Valerie Onu — SFM Specialist Team, Edge Catalyst Finance
