#!/bin/bash
# Run this locally (not on the server — npm/vite is unreliable there).
# Builds the frontend for production and pushes it to GitHub. After this,
# run ./deploy.sh on the Truehost server to pick up the new build plus any
# backend changes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/frontend"

echo "==> Building frontend..."
npm run build

cd "$SCRIPT_DIR"

echo "==> Committing frontend/dist..."
git add frontend/dist
if git diff --cached --quiet; then
    echo "    no changes to frontend/dist"
else
    git commit -m "Update frontend build"
fi

echo "==> Pushing to origin/main..."
git push origin main

echo ""
echo "==> Done. Now run ./deploy.sh on the Truehost server to go live."
