# J-USE REOI 2026 — Technical Handover Report

**Prepared for IT / Development Team**  
**Date:** April 2026  
**Status:** Frontend + PDF Renderer + Backend (Google Apps Script) Finalized

> **For the IT team:** the backend is now a single Google Apps Script Web App.
> Follow `apps-script/SETUP.md` (~15 min). No PocketBase, Railway, Netlify Functions,
> or Puppeteer setup is required.

---

## 1. Package Contents

- `J-USE_REOI_2026_Application_Form.html` — Main application form
- `juse-full-pdf-renderer.html` — Dynamic PDF renderer
- `pdf-core.js` — Helper functions + main entry point
- `pdf-sections.js` — Scalar field population (all 10 sections)
- `pdf-tables.js` — Dynamic table rendering
- `grants-email.html` — Grants team notification
- `applicant-email.html` — Applicant confirmation
- `README.md` — Setup and integration guide
- `sample-applicationData.json` — Full test payload

## 2. System Flow

1. Applicant fills form → submits
2. Browser reads file inputs (regCertificate, capacityDocument, budgetBreakdown) as base64
3. Browser opens hidden iframe → renderer populates → html2pdf.js produces PDF blob
4. Browser POSTs `{ formData, files, pdfBase64 }` to the Apps Script Web App
5. Apps Script: generates `JUSE-2026-xxxxxx`, creates Drive subfolder, saves files + PDF, appends row to Google Sheet, sends both emails
6. Apps Script returns `{ ok, refNumber, pdfUrl }` → form shows success page with reference number

## 3. Field Mapping Summary

The renderer maps **231+ data points** across 10 PDF sections plus cover page. These include:

- **14 cover/header fields** (ref_number, orgName, projectTitle, parish, dates, contact)
- **22 Section 1 fields** (org details, registration, primary/secondary contacts)
- **10 Section 2 fields** (parish, hazards, challenges, coping, system flows, priority needs)
- **15 Section 3 fields** (project info, NbCS interventions, housing vulnerability, causal chain) + 2 dynamic tables (outcomeMetrics, focusLenses)
- **25 Section 4 fields** (beneficiary numbers, demographics, target groups, vulnerability, gender/GBV) + 1 dynamic table (benefitTraceability)
- **13 Section 5 fields** (value model, model-specific fields, qualifying questions, rationale, sustainability)
- **10 Section 6 fields** (implementation, enablers, maintenance, learning) + 2 dynamic tables (implementationStructure, enablersDetail)
- **5 Section 7 fields** (budget summary, dates)
- **20 Section 8 fields** (IUCN criteria, TNA matrix, capacity needs, learning formats, accessibility)
- **8 Section 9 fields** (supporting documents — grouped by type)
- **16 Section 10 fields** (8 declarations + 8 authorization fields)

**Field types:** Scalar strings, boolean flags (declarations), arrays (focusLenses, benefitTraceability, enablersDetail, outcomeMetrics, implementation_roles, tna_scores, documents, preferredLearningFormats, capacityBuildingNeeds), conditional blocks (gender analysis, GBV, housing context), and single-select models (value proposition pathway).

## 4. Critical Conditional Logic

### Registration Date/Number (Section 1)
When `regType` is "Government" or "SOE", both the Date of Formation row and Registration Number row are hidden via JavaScript. This is because Government entities and SOEs don't register in the same way as NGOs.

### Housing Vulnerability (Section 3)
Three-tier classification with visual badges:
- 🟢 **Yes — Directly and centrally** (green badge) → shows context description
- 🟡 **Partially / Indirectly** (amber badge) → shows context description
- ⚪ **No — Not a focus** (orange badge) → hides context description

### Gender Analysis & GBV (Section 4)
- `genderAnalysisConducted: true` → shows "Gender Analysis Conducted" block with findings text
- `gbvRiskConsidered: true` → shows "GBV Risk Considered" block with mitigation measures text
- Both false → both blocks hidden

### Value Proposition Model (Section 5)
Single-model selection. The `data.pathway` field determines which model block is visible:
- `market` → "Revenue-Generating Model" with revenue, customer, O&M fields
- `hybrid` → "Hybrid Model (Revenue + Public Goods)" with market %, anchor partner, public goods
- `public` → "Public Goods Model" with beneficiaries, agency adoption, NDC alignment
- Orange warning shown when no model is selected

### Focus Lenses (Section 3)
Populated from `data.focusLenses` array. Supports multiple field-name conventions (`lensName`/`name`/`label`, `selectedOption`/`option`/`value`). Shows "Not provided" if empty.

### Benefit Traceability (Section 4)
Per-row `intensity` and `timing` values with global fallback. Seven columns: Outcome, Sector, Target Groups, How They Benefit, Intensity of Benefit, When Benefits Will Be Realised, Verification.

### Key Milestones (Section 7)
**Completely removed.** Only Budget Summary (3 amounts) + Budget Breakdown (Excel reference) + Start/End Dates remain.

## 5. Testing Checklist

1. **Normal submission** — Full PDF generated with all fields populated
2. **Government/SOE** — Registration Date and Number rows hidden
3. **Housing = "No"** — Vulnerability context description disappears
4. **Value Model switching** — Only selected model visible, no empty boxes
5. **Gender/GBV false** — Conditional blocks not rendered
6. **Print test** — Clean A4 output with no content cut-off

Use `sample-applicationData.json` for initial testing.

## 6. Remaining Work for IT

One-time setup, ~15 minutes total — see `apps-script/SETUP.md`:

- Create the Google Sheet + Drive folder; copy their IDs.
- Create the Apps Script project; paste `Code.gs`, `Email_Applicant.html`, `Email_Grants.html`.
- Set `SHEET_ID`, `DRIVE_FOLDER_ID`, `GRANTS_EMAIL` in `Code.gs`.
- Deploy as Web App ("Anyone" access); copy the URL.
- Paste the URL into `APPS_SCRIPT_URL` in the form HTML.
- Test end-to-end with the sample payload.

## 7. Recommendations

- Always treat `J-USE_REOI_2026_Application_Form.html` as the canonical field definition
- Maintain the modular split (core/sections/tables) for maintainability
- Test with different `pathway` values (market, hybrid, public) before go-live
- Verify emoji rendering in PDF (🟢🟡⚪ may render differently in some PDF engines)

---

**End of Handover Report**
