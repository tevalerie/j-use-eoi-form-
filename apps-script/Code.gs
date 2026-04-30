/**
 * J-USE REOI 2026 — Application Backend (Google Apps Script Web App)
 *
 * Receives form submissions from J-USE_REOI_2026_Application_Form.html,
 * stores data in Google Sheets, saves attachments + generated PDF to Drive,
 * and sends confirmation emails to the applicant and grants team.
 *
 * Setup: see SETUP.md in this folder.
 */

// =====================================================================
// CONFIG — only these values need editing. Everything else is auto-set
// by running setup() once from the Apps Script editor.
// =====================================================================
const GRANTS_EMAIL          = 'grants@efj.org.jm';

// Direct ID of the "Applications" folder in your Google Drive.
// Each submission becomes a subfolder inside this folder, and the
// submissions Google Sheet is created here too (on first setup() run).
const APPLICATIONS_FOLDER_ID = '1SByBGFPCa5BtEtQfmvuQVnO5SRiTZX_Y';
// =====================================================================

// IDs are loaded from Script Properties (populated by setup()).
function getSheetId_()   { return PropertiesService.getScriptProperties().getProperty('SHEET_ID'); }
function getFolderId_()  { return PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID'); }


/**
 * ONE-CLICK SETUP — run this once from the Apps Script editor.
 *
 *   1. Open this script in https://script.google.com.
 *   2. Select function: setup  →  click ▶ Run.
 *   3. Approve the permissions prompt (first time only).
 *   4. Check the Execution log — it prints the Sheet URL, Drive folder URL,
 *      and confirms everything is wired up.
 *
 * Safe to re-run. If a Sheet/folder is already configured, it reuses them.
 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('SHEET_ID');
  let folderId = props.getProperty('DRIVE_FOLDER_ID');

  // 1. Resolve the Applications folder by ID
  const applicationsFolder = DriveApp.getFolderById(APPLICATIONS_FOLDER_ID);
  folderId = APPLICATIONS_FOLDER_ID;
  props.setProperty('DRIVE_FOLDER_ID', folderId);
  Logger.log('✓ Submissions folder: ' + applicationsFolder.getUrl());

  // 2. Sheet — create inside the Applications folder so everything is co-located
  if (!sheetId || !canOpenSheet_(sheetId)) {
    const ss = SpreadsheetApp.create('J-USE REOI 2026 — Submissions');
    sheetId = ss.getId();
    try { DriveApp.getFileById(sheetId).moveTo(applicationsFolder); } catch (e) { /* older Drive APIs */ }
    props.setProperty('SHEET_ID', sheetId);
    ensureSheetHeaders_(ss.getSheets()[0]);
    Logger.log('✓ Created Submissions Sheet: ' + ss.getUrl());
  } else {
    Logger.log('✓ Sheet already configured: https://docs.google.com/spreadsheets/d/' + sheetId);
  }

  // 3. Confirm grants email
  Logger.log('✓ Grants notifications will be sent to: ' + GRANTS_EMAIL);

  // 4. Sanity check
  Logger.log('');
  Logger.log('Setup complete. Next:');
  Logger.log('  1. Click Deploy → New deployment → Web app');
  Logger.log('     - Execute as: Me');
  Logger.log('     - Who has access: Anyone');
  Logger.log('  2. Copy the Web app URL.');
  Logger.log('  3. Paste it into APPS_SCRIPT_URL in J-USE_REOI_2026_Application_Form.html');

  return {
    sheetUrl:  'https://docs.google.com/spreadsheets/d/' + sheetId,
    folderUrl: 'https://drive.google.com/drive/folders/' + folderId,
    grantsEmail: GRANTS_EMAIL
  };
}

function canOpenSheet_(id) {
  try { SpreadsheetApp.openById(id); return true; } catch (e) { return false; }
}
function canOpenFolder_(id) {
  try { DriveApp.getFolderById(id); return true; } catch (e) { return false; }
}


/**
 * One-shot cleanup helper. Trashes any empty JUSE-2026-XXXXXX subfolders
 * inside the Applications folder AND clears matching rows from the Sheet
 * AND resets the ref-number counter to the highest non-empty submission.
 *
 * Run from the Apps Script editor: function picker → cleanupProbes → ▶
 */
function cleanupProbes() {
  const folder = DriveApp.getFolderById(APPLICATIONS_FOLDER_ID);
  const subs = folder.getFolders();
  let trashed = 0;
  let kept = 0;
  let highestKept = 0;
  while (subs.hasNext()) {
    const f = subs.next();
    const name = f.getName();
    if (!/^JUSE-2026-/.test(name)) continue;
    const fileCount = (function () { let n = 0; const it = f.getFiles(); while (it.hasNext()) { it.next(); n++; } return n; })();
    if (fileCount === 0) {
      f.setTrashed(true);
      trashed++;
      Logger.log('🗑  Trashed empty: ' + name);
    } else {
      kept++;
      const m = name.match(/JUSE-2026-(\d+)/);
      if (m) highestKept = Math.max(highestKept, parseInt(m[1], 10));
    }
  }
  // Wipe matching Sheet rows for trashed folders (any row whose folder URL points at a trashed folder).
  // Simpler approach: rebuild the sheet by keeping only rows whose Ref Number corresponds to a still-present folder.
  const sheet = SpreadsheetApp.openById(getSheetId_()).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  if (data.length > 1) {
    const header = data[0];
    const refIdx = header.indexOf('Ref Number');
    const liveRefs = {};
    const it2 = folder.getFolders();
    while (it2.hasNext()) {
      const m = it2.next().getName().match(/JUSE-2026-(\d+)/);
      if (m) liveRefs['JUSE-2026-' + m[1]] = true;
    }
    const rowsToDelete = [];
    for (let i = 1; i < data.length; i++) {
      if (refIdx >= 0 && data[i][refIdx] && !liveRefs[data[i][refIdx]]) {
        rowsToDelete.push(i + 1); // 1-indexed sheet row
      }
    }
    rowsToDelete.reverse().forEach(function (r) { sheet.deleteRow(r); });
    Logger.log('🗑  Deleted ' + rowsToDelete.length + ' orphan sheet rows');
  }
  // Reset ref counter so the next submission picks up where the highest kept folder left off.
  PropertiesService.getScriptProperties().setProperty('refCounter', String(highestKept));
  Logger.log('✓ Cleanup done. Trashed=' + trashed + ', Kept=' + kept + ', Counter reset to ' + highestKept);
  return { trashed: trashed, kept: kept, counter: highestKept };
}


function doPost(e) {
  try {
    if (!getSheetId_() || !getFolderId_()) setup();
    const payload   = JSON.parse(e.postData.contents);
    const phase     = String(payload.phase || 'all').toLowerCase();

    // ---- Phase: LEAD — capture incomplete / parish-ineligible exits in the leads tab ----
    if (phase === 'lead') {
      ensureSchemaTabs_();
      const sheet = SpreadsheetApp.openById(getSheetId_()).getSheetByName('leads');
      if (sheet) {
        const data = payload.formData || {};
        const leadId = 'LEAD-' + new Date().getTime() + '-' + Math.floor(Math.random()*1000);
        sheet.appendRow(buildRow_('leads', {
          lead_id: leadId,
          reference_id: '',
          submission_timestamp: data.timestamp || new Date().toISOString(),
          lead_status: 'captured',
          source_flow: data.exit_flag ? 'parish_ineligible_exit' : 'incomplete_submission',
          project_parish_eligibility_status: data.parishStatus || (data.exit_flag ? 'ineligible' : ''),
          org_name: data.orgName || '',
          registration_type: data.regType || '',
          organization_category: data.orgCategory || '',
          contact_name: data.contactName || '',
          contact_title: data.contactTitle || '',
          contact_email: data.email || '',
          contact_phone: data.phone || '',
          contact_gender: data.contactGender || '',
          org_parish: data.orgParish || '',
          project_parish: data.parish || '',
          project_location: data.location || '',
          project_area_type: data.classification || '',
          climate_challenge_primary: Array.isArray(data.climateChallenge) ? data.climateChallenge.join(', ') : (data.climateChallenge || ''),
          climate_challenge_secondary: '',
          exposure_description: data.exposureDescription || '',
          vulnerability_description: data.vulnerabilityDescription || '',
          adaptive_capacity_description: data.adaptiveCapacity || '',
          coping_strategy_description: data.copingDescription || '',
          notes: data.exit_flag ? 'Parish ineligibility exit — applicant left form at Step 2.' : ''
        }));
      }
      return jsonResponse_({ ok: true, leadId: 'captured' });
    }

    // ---- Phase 1: INIT — reserve a refNumber + create folder + draft sheet row ----
    if (phase === 'init') {
      const formData  = payload.formData || {};
      const refNumber = generateRefNumber_();
      const folder    = createSubmissionFolder_(refNumber, formData);
      // Stash folder ID so phase 2 can find it without a second client round-trip
      PropertiesService.getScriptProperties().setProperty('refFolder:' + refNumber, folder.getId());
      // Draft sheet row (no PDF URL yet)
      appendToSheet_(refNumber, formData, '', folder.getUrl());
      return jsonResponse_({ ok: true, refNumber: refNumber, folderUrl: folder.getUrl(), phase: 'init' });
    }

    // ---- Phase 2: COMPLETE — append files + PDF to existing folder + send emails ----
    if (phase === 'complete') {
      const formData  = payload.formData  || {};
      const files     = payload.files     || [];
      const pdfBase64 = payload.pdfBase64 || '';
      const refNumber = String(payload.refNumber || '').trim();
      if (!refNumber) return jsonResponse_({ ok: false, error: 'phase=complete requires refNumber' });

      const folderId = PropertiesService.getScriptProperties().getProperty('refFolder:' + refNumber);
      let folder;
      if (folderId) {
        try { folder = DriveApp.getFolderById(folderId); } catch (e) { folder = null; }
      }
      // If we lost the folder reference, create one (fallback for orphaned phase-2 calls)
      if (!folder) folder = createSubmissionFolder_(refNumber, formData);

      const fileLinks = saveFiles_(folder, files);
      const pdfUrl    = savePDF_(folder, refNumber, pdfBase64);
      // Update existing sheet row's PDF URL (phase 1 left it empty)
      updateSheetRowPdfUrl_(refNumber, pdfUrl);

      // Populate the structured spec tabs (applications_master + 8 child tabs).
      // Sheet1 (the original 12-column quick-view) is left untouched.
      try { writeToSchemaTabs_(refNumber, formData, pdfUrl, folder.getUrl(), fileLinks); }
      catch (e) { console.warn('writeToSchemaTabs_ failed: ' + e.message); }

      let pdfAttachment = null;
      if (pdfBase64) {
        try {
          pdfAttachment = Utilities.newBlob(
            Utilities.base64Decode(pdfBase64),
            'application/pdf',
            refNumber + ' - Application.pdf'
          );
        } catch (e) { console.warn('PDF attachment build failed: ' + e.message); }
      }
      sendApplicantEmail_(formData, refNumber, pdfUrl, pdfAttachment);
      sendGrantsEmail_(formData, refNumber, pdfUrl, fileLinks, folder.getUrl(), pdfAttachment);

      // Cleanup the temp property
      PropertiesService.getScriptProperties().deleteProperty('refFolder:' + refNumber);
      return jsonResponse_({ ok: true, refNumber: refNumber, pdfUrl: pdfUrl, phase: 'complete' });
    }

    // ---- Phase ALL (legacy single-shot mode) ----
    const formData  = payload.formData  || {};
    const files     = payload.files     || [];
    const pdfBase64 = payload.pdfBase64 || '';

    const refNumber = generateRefNumber_();
    const folder    = createSubmissionFolder_(refNumber, formData);
    const fileLinks = saveFiles_(folder, files);
    const pdfUrl    = savePDF_(folder, refNumber, pdfBase64);
    appendToSheet_(refNumber, formData, pdfUrl, folder.getUrl());

    // Populate the structured spec tabs alongside Sheet1 (legacy single-shot).
    try { writeToSchemaTabs_(refNumber, formData, pdfUrl, folder.getUrl(), fileLinks); }
    catch (e) { console.warn('writeToSchemaTabs_ failed: ' + e.message); }

    let pdfAttachment = null;
    if (pdfBase64) {
      try {
        pdfAttachment = Utilities.newBlob(
          Utilities.base64Decode(pdfBase64),
          'application/pdf',
          refNumber + ' - Application.pdf'
        );
      } catch (e) { console.warn('PDF attachment build failed: ' + e.message); }
    }
    sendApplicantEmail_(formData, refNumber, pdfUrl, pdfAttachment);
    sendGrantsEmail_(formData, refNumber, pdfUrl, fileLinks, folder.getUrl(), pdfAttachment);

    return jsonResponse_({ ok: true, refNumber: refNumber, pdfUrl: pdfUrl });
  } catch (err) {
    console.error(err);
    return jsonResponse_({ ok: false, error: String(err && err.message || err) });
  }
}

// =====================================================================
// Schema tabs — writes a structured representation of each submission
// across the 9 form-fed tabs in the same workbook (per the spec
// J_USE_Complete_GoogleSheet_Output_Workbook.xlsx). The original Sheet1
// (the simple 12-column quick-view) remains untouched.
// =====================================================================

function ensureSchemaTabs_() {
  const ss = SpreadsheetApp.openById(getSheetId_());
  Object.keys(SCHEMA_TAB_HEADERS).forEach(function (tabName) {
    const headers = SCHEMA_TAB_HEADERS[tabName];
    if (!headers || !headers.length) return;
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }
  });
  populateStaticTabs_();
}

// Populate the 5 static-metadata tabs (chart_specs, formula_library,
// validation_rules, lookups, field_inventory_reference) ONCE from the
// spec workbook's reference rows. Idempotent: only writes if the tab has
// just its header row (i.e. no data rows yet).
function populateStaticTabs_() {
  if (typeof SCHEMA_STATIC_ROWS === 'undefined') return;
  const ss = SpreadsheetApp.openById(getSheetId_());
  Object.keys(SCHEMA_STATIC_ROWS).forEach(function (tabName) {
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    if (sheet.getLastRow() > 1) return; // Already has data rows
    const rows = SCHEMA_STATIC_ROWS[tabName] || [];
    if (rows.length === 0) return;
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  });
}

function writeToSchemaTabs_(refNumber, formData, pdfUrl, folderUrl, fileLinks) {
  ensureSchemaTabs_();
  const ss = SpreadsheetApp.openById(getSheetId_());
  const applicationId = Utilities.getUuid();
  const submittedAt = formData.submittedAt || new Date().toISOString();

  // ----- 1. applications_master ----- (1 row per submission)
  appendMasterRow_(ss, applicationId, refNumber, submittedAt, formData, pdfUrl);

  // ----- 2. multiselect_selections ----- (n rows per submission)
  appendMultiselectRows_(ss, applicationId, refNumber, formData);

  // ----- 3. outcome_metrics -----
  appendOutcomeMetricsRows_(ss, applicationId, refNumber, formData);

  // ----- 4. implementation_roles -----
  appendImplementationRolesRows_(ss, applicationId, refNumber, formData);

  // ----- 5. tna_scores -----
  appendTnaScoresRows_(ss, applicationId, refNumber, formData);

  // ----- 6. documents -----
  appendDocumentsRows_(ss, applicationId, refNumber, formData, fileLinks);

  // ----- 7. benefit_traceability -----
  appendBenefitTraceabilityRows_(ss, applicationId, refNumber, formData);

  // ----- 8. focus_lens_selections -----
  appendFocusLensRows_(ss, applicationId, refNumber, formData);

  // ----- 9. enablers_detail -----
  appendEnablersDetailRows_(ss, applicationId, refNumber, formData);

  // ----- 10–12. Analyst-output tabs: stub rows with identity pre-filled,
  //              assessment columns left blank for the reviewer/analyst.
  appendAnalystStub_(ss, 'tna_analytics',          applicationId, refNumber, formData);
  appendAnalystStub_(ss, 'iucn_alignment_report',  applicationId, refNumber, formData);
  appendAnalystStub_(ss, 'capital_alignment_report', applicationId, refNumber, formData);
}

// Pre-fill the identity columns on a reviewer/analyst tab so each
// submission has its own row from day one. The assessment columns are
// left blank — they're for human review (TNA scoring, IUCN alignment,
// capital pathway recommendation, etc.).
function appendAnalystStub_(ss, tabName, appId, refNumber, formData) {
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return;
  // Standard identity columns present across all 3 analyst tabs
  const values = {
    application_id:     appId,
    reference_id:       refNumber,
    organization_name:  formData.orgName || '',
    project_title:      formData.projectTitle || '',
    // capital_alignment_report has 2 extra identity columns
    project_parish:     formData.parish || '',
    value_pathway:      formData.pathway || ''
  };
  sheet.appendRow(buildRow_(tabName, values));
}

// ---- helpers: build a row matching a tab's header order from a value-map ----
function buildRow_(tabName, valuesByHeader) {
  const headers = SCHEMA_TAB_HEADERS[tabName] || [];
  return headers.map(function (h) {
    const v = valuesByHeader[h];
    if (v == null) return '';
    if (Array.isArray(v)) return v.join(', ');
    return v;
  });
}

function appendMasterRow_(ss, appId, refNumber, submittedAt, data, pdfUrl) {
  const sheet = ss.getSheetByName('applications_master');
  if (!sheet) return;
  const values = {
    application_id:           appId,
    reference_id:             refNumber,
    submission_timestamp:     submittedAt,
    application_status:       'submitted',
    is_test_submission:       data._isTestSubmission ? 'true' : 'false',
    full_application_pdf_url: pdfUrl || '',
    summary_pdf_url:          '',
    document_urls_summary:    ''
  };
  // Map every html_name → its destination_column from APPLICATIONS_MASTER_MAP
  Object.keys(APPLICATIONS_MASTER_MAP).forEach(function (htmlName) {
    const col = APPLICATIONS_MASTER_MAP[htmlName];
    if (data[htmlName] !== undefined) values[col] = data[htmlName];
  });
  sheet.appendRow(buildRow_('applications_master', values));
}

function appendMultiselectRows_(ss, appId, refNumber, data) {
  const sheet = ss.getSheetByName('multiselect_selections');
  if (!sheet) return;
  MULTISELECT_FIELDS.forEach(function (def) {
    const v = data[def.html_name];
    if (v == null || v === '') return;
    const arr = Array.isArray(v) ? v : String(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    arr.forEach(function (opt) {
      sheet.appendRow(buildRow_('multiselect_selections', {
        application_id: appId,
        reference_id:   refNumber,
        field_name:     def.html_name,
        selected_option: opt,
        selected_option_label: opt,
        source_step:    def.source_step
      }));
    });
  });
}

function appendOutcomeMetricsRows_(ss, appId, refNumber, data) {
  const sheet = ss.getSheetByName('outcome_metrics');
  if (!sheet) return;
  const arr = Array.isArray(data.outcomeMetrics) ? data.outcomeMetrics : [];
  arr.forEach(function (row, idx) {
    sheet.appendRow(buildRow_('outcome_metrics', {
      application_id: appId,
      reference_id:   refNumber,
      outcome_row_id: 'OM-' + (idx + 1),
      outcome_type:   '',
      metric_name:    row.outcomeName || row.metric_name || '',
      baseline_value: row.outcomeBaseline || row.baseline_value || '',
      target_value:   row.outcomeExpected || row.target_value || '',
      unit:           '',
      how_measured:   row.outcomeMeasured || row.how_measured || '',
      time_horizon:   ''
    }));
  });
}

function appendImplementationRolesRows_(ss, appId, refNumber, data) {
  const sheet = ss.getSheetByName('implementation_roles');
  if (!sheet) return;
  let arr = Array.isArray(data.implementation_roles) ? data.implementation_roles
          : Array.isArray(data.implementationStructure) ? data.implementationStructure
          : [];
  // Fall back to flat fields
  if (!arr.length) {
    [
      ['Implementation Lead',  data.implLead,        data.implLeadResp],
      ['Technical Partner',    data.implTechnical,   data.implTechnicalResp],
      ['Community Partner',    data.implCommunity,   data.implCommunityResp],
      ['Financial Manager',    data.implFinancial,   data.implFinancialResp],
      ['Government Partner',   data.implGovernment,  data.implGovernmentResp],
      ['M&E Lead',             data.implME,          data.implMEResp]
    ].forEach(function (t) {
      if (t[1] || t[2]) arr.push({ role: t[0], name: t[1] || '', responsibility: t[2] || '' });
    });
  }
  arr.forEach(function (row, idx) {
    sheet.appendRow(buildRow_('implementation_roles', {
      application_id:    appId,
      reference_id:      refNumber,
      role_row_id:       'IR-' + (idx + 1),
      role_name:         row.role || row.roleName || '',
      organization_name: row.name || row.organization || row.organizationName || '',
      responsibility:    row.responsibility || row.resp || ''
    }));
  });
}

function appendTnaScoresRows_(ss, appId, refNumber, data) {
  const sheet = ss.getSheetByName('tna_scores');
  if (!sheet) return;
  let arr = Array.isArray(data.tna_scores) ? data.tna_scores
          : Array.isArray(data.tnaMatrix) ? data.tnaMatrix
          : [];
  // Fall back to flat tna_X fields
  if (!arr.length) {
    Object.keys(data).forEach(function (k) {
      if (k.indexOf('tna_') === 0 && data[k]) {
        arr.push({ competency: k.replace(/^tna_/, ''), score: data[k] });
      }
    });
  }
  arr.forEach(function (row) {
    sheet.appendRow(buildRow_('tna_scores', {
      application_id: appId,
      reference_id:   refNumber,
      competency_area: row.competency || row.competency_area || row.key || '',
      score:           row.score || '',
      priority_flag:   row.priority || row.priority_flag || '',
      notes:           row.notes || ''
    }));
  });
}

function appendDocumentsRows_(ss, appId, refNumber, data, fileLinks) {
  const sheet = ss.getSheetByName('documents');
  if (!sheet) return;
  const links = Array.isArray(fileLinks) ? fileLinks : [];
  links.forEach(function (f, idx) {
    sheet.appendRow(buildRow_('documents', {
      application_id:     appId,
      reference_id:       refNumber,
      document_row_id:    'DOC-' + (idx + 1),
      document_type:      f.key || '',
      file_name:          f.name || '',
      file_url:           f.url || '',
      mime_type:          f.mime || '',
      uploaded_timestamp: new Date().toISOString()
    }));
  });
}

function appendBenefitTraceabilityRows_(ss, appId, refNumber, data) {
  const sheet = ss.getSheetByName('benefit_traceability');
  if (!sheet) return;
  const arr = Array.isArray(data.benefitTraceability) ? data.benefitTraceability : [];
  arr.forEach(function (row, idx) {
    sheet.appendRow(buildRow_('benefit_traceability', {
      application_id:      appId,
      reference_id:        refNumber,
      traceability_row_id: 'BT-' + (idx + 1),
      outcome_label:       row.outcomeLabel || '',
      sector_system:       row.sector || row.sectorSystem || '',
      target_groups:       Array.isArray(row.groups) ? row.groups.join(', ') : (row.groups || row.targetGroups || ''),
      benefit_mechanism:   row.how || row.benefitMechanism || ''
    }));
  });
}

function appendFocusLensRows_(ss, appId, refNumber, data) {
  const sheet = ss.getSheetByName('focus_lens_selections');
  if (!sheet) return;
  const arr = Array.isArray(data.focusLenses) ? data.focusLenses : [];
  arr.forEach(function (row, idx) {
    sheet.appendRow(buildRow_('focus_lens_selections', {
      application_id:        appId,
      reference_id:          refNumber,
      lens_row_id:           'FL-' + (idx + 1),
      lens_name:             row.lensName || row.name || '',
      selected_option:       row.selectedOption || row.option || '',
      selected_option_label: row.selectedLabel || row.selectedOption || ''
    }));
  });
}

function appendEnablersDetailRows_(ss, appId, refNumber, data) {
  const sheet = ss.getSheetByName('enablers_detail');
  if (!sheet) return;
  const arr = Array.isArray(data.enablersDetail) ? data.enablersDetail : [];
  arr.forEach(function (row, idx) {
    sheet.appendRow(buildRow_('enablers_detail', {
      application_id: appId,
      reference_id:   refNumber,
      enabler_row_id: 'EN-' + (idx + 1),
      enabler_name:   row.enablerName || row.enablerLabel || '',
      status:         row.status || '',
      notes:          row.notes || ''
    }));
  });
}


// Update the PDF URL of an existing row identified by Ref Number. Used by
// the two-phase flow: phase 1 writes the row with empty PDF URL; phase 2
// fills it in once the PDF has been uploaded.
function updateSheetRowPdfUrl_(refNumber, pdfUrl) {
  const sheet = SpreadsheetApp.openById(getSheetId_()).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return;
  const headers = data[0];
  const refIdx = headers.indexOf('Ref Number');
  const pdfIdx = headers.indexOf('PDF URL');
  if (refIdx < 0 || pdfIdx < 0) return;
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][refIdx]).trim() === refNumber) {
      sheet.getRange(r + 1, pdfIdx + 1).setValue(pdfUrl);
      return;
    }
  }
}

function doGet() {
  return ContentService.createTextOutput('J-USE REOI 2026 backend is running.');
}


// =====================================================================
// Reference number — sequential JUSE-2026-000001, 000002, ...
// =====================================================================
function generateRefNumber_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const next  = (parseInt(props.getProperty('refCounter') || '0', 10) + 1);
    props.setProperty('refCounter', String(next));
    return 'JUSE-2026-' + String(next).padStart(6, '0');
  } finally {
    lock.releaseLock();
  }
}


// =====================================================================
// Drive — one subfolder per submission
// =====================================================================
function createSubmissionFolder_(refNumber, formData) {
  let root;
  try { root = DriveApp.getFolderById(getFolderId_()); }
  catch (e) { throw new Error('createSubmissionFolder_: getFolderById(' + getFolderId_() + ') → ' + e.message); }
  const slug = String(formData.orgName || 'Unknown')
    .replace(/[^a-zA-Z0-9 ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'Unknown';
  try { return root.createFolder(refNumber + ' — ' + slug); }
  catch (e) { throw new Error('createSubmissionFolder_: createFolder → ' + e.message); }
}

function saveFiles_(folder, files) {
  const links = [];
  files.forEach(function (f, idx) {
    if (!f || !f.base64) return;
    let blob, file;
    try {
      blob = Utilities.newBlob(
        Utilities.base64Decode(f.base64),
        f.mime || 'application/octet-stream',
        f.name || ('attachment-' + idx)
      );
    } catch (e) {
      throw new Error('saveFiles_[' + idx + ' key=' + (f.key||'?') + ']: newBlob → ' + e.message);
    }
    try {
      file = folder.createFile(blob);
    } catch (e) {
      throw new Error('saveFiles_[' + idx + ' key=' + (f.key||'?') + ' name=' + f.name + ']: createFile → ' + e.message);
    }
    trySetSharing_(file);
    links.push({ key: f.key || '', name: file.getName(), url: file.getUrl() });
  });
  return links;
}

function savePDF_(folder, refNumber, pdfBase64) {
  if (!pdfBase64) return '';
  let blob, file;
  try {
    blob = Utilities.newBlob(
      Utilities.base64Decode(pdfBase64),
      'application/pdf',
      refNumber + '.pdf'
    );
  } catch (e) { throw new Error('savePDF_: newBlob → ' + e.message); }
  try {
    file = folder.createFile(blob);
  } catch (e) {
    const sizeKB = Math.round((pdfBase64.length * 3 / 4) / 1024);
    throw new Error('savePDF_: createFile (' + sizeKB + 'KB) → ' + e.message);
  }
  trySetSharing_(file);
  return file.getUrl();
}


// =====================================================================
// Sheets — key columns + full JSON dump for completeness
// =====================================================================
function ensureSheetHeaders_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    'Ref Number', 'Submitted At', 'Org Name', 'Project Title',
    'Contact Name', 'Contact Email', 'Parish', 'Reg Type',
    'Pathway', 'PDF URL', 'Folder URL', 'Full Form Data (JSON)'
  ]);
  sheet.setFrozenRows(1);
}

function appendToSheet_(refNumber, data, pdfUrl, folderUrl) {
  const sheet = SpreadsheetApp.openById(getSheetId_()).getSheets()[0];
  ensureSheetHeaders_(sheet);
  sheet.appendRow([
    refNumber,
    data.submittedAt || new Date().toISOString(),
    data.orgName || '',
    data.projectTitle || '',
    data.contactName || data.primaryContactName || '',
    data.email || data.contactEmail || '',
    data.parish || '',
    data.regType || '',
    data.pathway || '',
    pdfUrl,
    folderUrl,
    JSON.stringify(data)
  ]);
}


// =====================================================================
// Emails — template files: Email_Applicant.html, Email_Grants.html
// =====================================================================
function sendApplicantEmail_(data, refNumber, pdfUrl, pdfAttachment) {
  if (!data.email) return;
  // EMAIL_APPLICANT_HTML lives in Templates.gs (auto-generated). We avoid
  // HtmlService.createHtmlOutputFromFile() because its validator rejects
  // Outlook-specific VML and conditional-comment markup in the template.
  const tpl  = EMAIL_APPLICANT_HTML;

  // Only render the "View / Download Full Application PDF" block when a
  // PDF URL is actually present. Empty pdfUrl → empty block (clean email).
  const pdfButtonBlock = pdfUrl ? (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 30px;">' +
      '<tr><td>' +
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #e8f4fd; border-left: 4px solid #2196F3; border-radius: 4px;">' +
          '<tr><td style="padding: 16px 22px;">' +
            '<p style="margin: 0 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Your Application</p>' +
            '<p style="margin: 0 0 10px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333333; line-height: 1.5;">A PDF copy of your submission is attached to this email. You may also view or download your full application using the link below.</p>' +
            '<a href="' + pdfUrl + '" style="display: inline-block; background-color: #2196F3; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; padding: 10px 22px; border-radius: 6px; letter-spacing: 0.3px;">View / Download Full Application PDF</a>' +
          '</td></tr>' +
        '</table>' +
      '</td></tr>' +
    '</table>'
  ) : '';

  const html = renderTemplate_(tpl, {
    CONTACT_NAME:      data.contactName || data.primaryContactName || 'Applicant',
    REF_NUMBER:        refNumber,
    ORG_NAME:          data.orgName || '',
    PROJECT_TITLE:     data.projectTitle || '',
    PARISH:            data.parish || '',
    SUBMISSION_DATE:   formatDate_(data.submittedAt),
    SUBMISSION_TIME:   formatTime_(data.submittedAt),
    EMAIL:             data.email,
    FULL_PDF_URL:      pdfUrl,
    PDF_LINK:          pdfUrl,
    PDF_BUTTON_BLOCK:  pdfButtonBlock
  });
  const opts = {
    to:       data.email,
    subject:  'J-USE REOI 2026 — Application Received (' + refNumber + ')',
    htmlBody: html,
    // Branded display name so applicants don't see a personal address
    name:     'EFJ J-USE Grants Programme',
    // Replies route to the grants team, not the script-owning mailbox
    replyTo:  GRANTS_EMAIL
  };
  if (pdfAttachment) opts.attachments = [pdfAttachment];
  MailApp.sendEmail(opts);
}

function sendGrantsEmail_(data, refNumber, pdfUrl, fileLinks, folderUrl, pdfAttachment) {
  const tpl = EMAIL_GRANTS_HTML;
  const fileLinksHtml = (fileLinks && fileLinks.length)
    ? fileLinks.map(function (f) { return '<a href="' + f.url + '">' + escapeHtml_(f.name) + '</a>'; }).join('<br>')
    : '—';
  const pdfLinkHtml = pdfUrl ? '<a href="' + pdfUrl + '">View PDF</a>' : '—';
  const sheetUrl    = 'https://docs.google.com/spreadsheets/d/' + getSheetId_();

  // "View Full Application" button — only render the button cell if a real
  // PDF URL exists. If the PDF is missing, show an "Open Folder" button
  // instead so the grants team can still access uploaded documents.
  const viewPdfButtonCell = pdfUrl
    ? ('<td style="padding-right: 12px; vertical-align: top;">' +
         '<a href="' + pdfUrl + '" style="display: inline-block; background-color: #2E8B57; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 22px; letter-spacing: 0.3px;">View Full Application</a>' +
       '</td>')
    : (folderUrl
        ? ('<td style="padding-right: 12px; vertical-align: top;">' +
             '<a href="' + folderUrl + '" style="display: inline-block; background-color: #2E8B57; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 22px; letter-spacing: 0.3px;">Open Submission Folder</a>' +
           '</td>')
        : ''
      );

  const html = renderTemplate_(tpl, {
    REF_NUMBER:          refNumber,
    ORG_NAME:            data.orgName || '',
    PROJECT_TITLE:       data.projectTitle || '',
    PROJECT_PARISH:      data.parish || '',
    PARISH:              data.parish || '',
    LOCATION:            data.location || '',
    REGISTRATION_TYPE:   data.regType || '',
    CONTACT_NAME:        data.contactName || data.primaryContactName || '',
    CONTACT_EMAIL:       data.email || '',
    SUBMISSION_DATE:     formatDate_(data.submittedAt),
    SUBMISSION_TIME:     formatTime_(data.submittedAt),
    CLIMATE_HAZARDS:     toList_(data.hazards),
    PRIMARY_NBCS:        toList_(data.nbcsIntervention),
    SECONDARY_NBCS:      toList_(data.nbcsSecondary),
    VALUE_PROPOSITION:   data.pathway || '',
    ESTIMATED_BUDGET:    data.estimatedBudget || data.totalBudget || '',
    PROJECT_DESCRIPTION: String(data.projectDescription || '').slice(0, 600),
    FULL_PDF_URL:        pdfUrl,
    FULL_PDF_LINK:       pdfLinkHtml,
    PDF_LINK:            pdfLinkHtml,
    FILE_LINKS:          fileLinksHtml,
    FOLDER_LINK:         folderUrl ? '<a href="' + folderUrl + '">Open folder</a>' : '—',
    SHEET_LINK:          '<a href="' + sheetUrl + '">Open submissions sheet</a>',
    GRANTS_VIEW_PDF_BUTTON_CELL: viewPdfButtonCell
  });

  const grantsOpts = {
    to:       GRANTS_EMAIL,
    subject:  'New J-USE REOI Submission — ' + (data.orgName || 'Unknown') + ' (' + refNumber + ')',
    htmlBody: html,
    name:     'J-USE Application System',
    // Reply goes straight to the applicant for fast turnaround
    replyTo:  data.email || GRANTS_EMAIL
  };
  if (pdfAttachment) grantsOpts.attachments = [pdfAttachment];
  MailApp.sendEmail(grantsOpts);
}


// =====================================================================
// Utilities
// =====================================================================
function renderTemplate_(tpl, vars) {
  return tpl.replace(/\{\{([A-Z_]+)\}\}/g, function (_, key) {
    return vars[key] != null ? String(vars[key]) : '';
  });
}

function toList_(value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function formatDate_(iso) {
  try {
    const d = iso ? new Date(iso) : new Date();
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Jamaica', 'MMMM d, yyyy');
  } catch (e) { return ''; }
}

function formatTime_(iso) {
  try {
    const d = iso ? new Date(iso) : new Date();
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Jamaica', 'h:mm a');
  } catch (e) { return ''; }
}

// Try to make a file accessible by anyone with the link. Some Google Workspace
// tenants restrict external link sharing via admin policy — in that case we
// silently fall back to folder-level permissions (the grants team still gets
// the file via the Submissions Drive folder, which they have access to).
function trySetSharing_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    console.warn('setSharing skipped (org policy?): ' + (e && e.message || e));
  }
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
