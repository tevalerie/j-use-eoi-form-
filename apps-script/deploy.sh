#!/usr/bin/env bash
# =============================================================================
# J-USE REOI 2026 — One-command deploy
# =============================================================================
# Run this from the apps-script/ folder:
#
#     ./deploy.sh
#
# What it does:
#   1. Checks Node.js + clasp are installed (installs clasp locally if needed).
#   2. Logs you into Google (browser opens) — first run only.
#   3. Creates a new Apps Script project in your Google account, OR pushes
#      to the existing one if .clasp.json is already present.
#   4. Pushes Code.gs + Email_Applicant.html + Email_Grants.html.
#   5. Runs setup() to create the Submissions Sheet inside your Applications
#      folder.
#   6. Deploys as a Web App with "Anyone" access and prints the URL.
#   7. Patches J-USE_REOI_2026_Application_Form.html with the deployed URL.
#
# After it finishes you have a fully wired backend. No web-UI clicking.
# =============================================================================

set -euo pipefail

cd "$(dirname "$0")"
SCRIPT_DIR="$(pwd)"
PROJECT_ROOT="$(cd .. && pwd)"
FORM_FILE="$PROJECT_ROOT/J-USE_REOI_2026_Application_Form.html"

# Auto-prepend project-local Node if present (installed by Claude on first run).
if [ -d "$PROJECT_ROOT/.node/bin" ]; then
  export PATH="$PROJECT_ROOT/.node/bin:$PATH"
fi

echo "→ J-USE REOI 2026 Backend — one-command deploy"
echo

# 1) Check prerequisites ------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Two options:"
  echo
  echo "  [A] Quickest — install via the official installer (~1 min):"
  echo "      1. Open https://nodejs.org in your browser"
  echo "      2. Click the green 'LTS' button to download the .pkg"
  echo "      3. Open the downloaded file → click Continue → Install"
  echo "      4. Re-run ./deploy.sh"
  echo
  echo "  [B] Skip the CLI altogether and use the web UI instead:"
  echo "      Follow apps-script/SETUP.md (~10 min, no Node needed)."
  echo
  exit 1
fi
echo "✓ Node $(node --version) found"

if [ ! -d "node_modules/@google/clasp" ]; then
  echo "→ Installing clasp locally (one time only)…"
  npm install --silent
fi
CLASP="./node_modules/.bin/clasp"
echo "✓ clasp ready"

# 2) Login --------------------------------------------------------------------
if [ ! -f "$HOME/.clasprc.json" ]; then
  echo
  echo "→ A browser window will open. Sign in with the Google account that"
  echo "  owns the Applications Drive folder."
  read -p "  Press Enter to continue… " _
  "$CLASP" login
fi
echo "✓ Logged into Google"

# 3) Create OR re-use project -------------------------------------------------
if [ ! -f ".clasp.json" ]; then
  echo "→ Creating new Apps Script project in your Google account…"
  "$CLASP" create --type webapp --title "J-USE REOI 2026 Backend" --rootDir .
else
  echo "✓ Using existing Apps Script project ($(grep -o '"scriptId"[^,]*' .clasp.json))"
fi

# 4) Push code ----------------------------------------------------------------
echo "→ Pushing Code.gs + email templates…"
"$CLASP" push --force >/dev/null
echo "✓ Code pushed"

# 5) Run setup() to provision Sheet inside the Applications folder -----------
echo "→ Running setup() to create the Submissions Sheet…"
"$CLASP" run setup 2>/dev/null || {
  echo "  (setup() will run automatically on the first submission instead;"
  echo "   you can also run it manually by opening the project: ./node_modules/.bin/clasp open)"
}

# 6) Deploy as Web App --------------------------------------------------------
echo "→ Deploying as Web App…"
DEPLOY_OUT="$("$CLASP" deploy --description "J-USE REOI 2026 production" 2>&1)"
echo "$DEPLOY_OUT"

DEPLOYMENT_ID="$(echo "$DEPLOY_OUT" | grep -oE 'AKfycb[A-Za-z0-9_-]+' | head -1 || true)"
if [ -z "$DEPLOYMENT_ID" ]; then
  echo
  echo "⚠  Couldn't auto-extract the deployment URL. Run:"
  echo "     ./node_modules/.bin/clasp deployments"
  echo "   and copy the AKfycb… URL into APPS_SCRIPT_URL in the form HTML."
  exit 0
fi
WEB_APP_URL="https://script.google.com/macros/s/${DEPLOYMENT_ID}/exec"
echo "✓ Deployed: $WEB_APP_URL"

# 7) Patch the form HTML ------------------------------------------------------
if [ -f "$FORM_FILE" ]; then
  echo "→ Wiring the form HTML to the deployed URL…"
  # macOS BSD sed needs an empty backup arg
  sed -i '' "s|PASTE_APPS_SCRIPT_WEB_APP_URL_HERE|${WEB_APP_URL}|g" "$FORM_FILE"
  echo "✓ Patched $FORM_FILE"
fi

echo
echo "─────────────────────────────────────────────────────────────"
echo "  ✓ Deploy complete."
echo
echo "  Web App URL:  $WEB_APP_URL"
echo "  Form file:    $FORM_FILE"
echo
echo "  Next:"
echo "    • Open the form locally to test:"
echo "        open $FORM_FILE"
echo "    • Or upload the whole project folder to your hosting."
echo "─────────────────────────────────────────────────────────────"
