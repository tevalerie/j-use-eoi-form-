#!/usr/bin/env bash
# =============================================================================
# Hypothetical test submission for the J-USE REOI 2026 backend
# =============================================================================
# Usage:
#   ./test-submission.sh <APPS_SCRIPT_WEB_APP_URL>
#
# Sends a realistic-looking submission to the deployed Apps Script. Result:
#   - One row appears in the Submissions Sheet
#   - One subfolder appears inside the Applications Drive folder
#   - tellyonu@gmail.com receives the applicant confirmation email
#   - grants@efj.org.jm receives the grants notification email
# =============================================================================

set -euo pipefail

URL="${1:-}"
if [ -z "$URL" ]; then
  echo "Usage: $0 <APPS_SCRIPT_WEB_APP_URL>"
  echo
  echo "Example:"
  echo "  $0 https://script.google.com/macros/s/AKfycbx.../exec"
  exit 1
fi

echo "→ Posting hypothetical submission to: $URL"
echo

PAYLOAD=$(cat <<'JSON'
{
  "formData": {
    "orgName": "Kingston Urban Greening Collective (TEST)",
    "regType": "NGO",
    "regNumber": "NGO-2024-TEST-001",
    "regDate": "2024-03-15",
    "orgCategory": "ngo",
    "bankAccount": "yes",
    "contactName": "Telly Valerie Onu",
    "primaryContactName": "Telly Valerie Onu",
    "contactTitle": "Programme Director",
    "email": "tellyonu@gmail.com",
    "contactPhone": "+1-876-555-0123",
    "projectTitle": "Tivoli Bioswales & Rain Gardens for Flood Resilience (TEST SUBMISSION)",
    "parish": "Kingston",
    "location": "Tivoli Gardens / Trench Town corridor",
    "hazards": ["flooding", "extreme_heat", "stormwater"],
    "climateChallenge": ["urban_flooding", "heat_islands"],
    "copingMechanisms": ["temporary_drainage", "community_cleanups"],
    "systemFlows": ["stormwater", "green_space"],
    "nbcsIntervention": ["bioswales", "rain_gardens"],
    "nbcsSecondary": ["urban_trees", "permeable_pavement"],
    "housingVulnerability": "direct",
    "housingVulnerabilityContext": "Households along the Tivoli corridor experience repeated flash flooding during the May–November rainy season; many homes lack adequate drainage and the area sits below sea level in places.",
    "pathway": "hybrid",
    "genderAnalysisConducted": true,
    "genderAnalysisFindings": "Women-headed households disproportionately bear the cost of post-flood recovery (cleanup, lost income from informal vending). The project will train and pay a women-led maintenance crew.",
    "gbvRiskConsidered": true,
    "gbvMitigationMeasures": "Worksite hours align with daylight; safeguarding policy adopted; community focal point identified for grievance reporting.",
    "estimatedBudget": "USD 145,000",
    "totalBudget": "145000",
    "startDate": "2026-07-01",
    "endDate": "2027-06-30",
    "projectDescription": "This is a TEST submission generated to verify the J-USE REOI 2026 backend. Please disregard for evaluation purposes — the project description here is illustrative only. The pilot would install ten bioswales and three rain gardens along the Tivoli–Trench Town flood corridor, paired with a women-led maintenance cooperative for long-term upkeep.",
    "additionalComments": "TEST SUBMISSION — verifying backend deployment. Intentionally fired by the SFM team to confirm the applicant + grants emails fire correctly and the Drive folder + Sheet are wired up.",
    "_isTestSubmission": true,
    "submittedAt": "REPLACE_AT_RUNTIME"
  },
  "files": [],
  "pdfBase64": ""
}
JSON
)

# Insert real timestamp
PAYLOAD="${PAYLOAD//REPLACE_AT_RUNTIME/$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

curl -sL -X POST "$URL" \
  -H "Content-Type: text/plain;charset=utf-8" \
  --data-binary "$PAYLOAD" | tee /tmp/juse-test-response.json
echo
echo

if grep -q '"ok":true' /tmp/juse-test-response.json; then
  REF=$(grep -oE '"refNumber":"[^"]+"' /tmp/juse-test-response.json | head -1)
  echo "✓ Test submission accepted. $REF"
  echo "  Check:"
  echo "    - tellyonu@gmail.com inbox (applicant confirmation)"
  echo "    - grants@efj.org.jm inbox (grants notification)"
  echo "    - Applications Drive folder for the new subfolder + PDF"
  echo "    - Submissions Sheet for the new row"
else
  echo "✗ Backend rejected the submission. Response above."
  exit 1
fi
