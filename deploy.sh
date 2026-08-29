#!/bin/bash
# Redeploys the app on the Truehost server from the latest pushed commit.
#
# Run this from anywhere; it always operates on the directory this script
# lives in. Frontend is NOT built here — it ships pre-built inside
# frontend/dist (committed to git), because npm/vite proved unreliable on
# this shared host. Build the frontend locally and commit frontend/dist
# before pushing:
#   cd frontend && npm run build && git add dist && git commit -m "..." && git push

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Pulling latest code from origin/main..."
git fetch origin main
git reset --hard origin/main

echo "==> Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
composer install --no-dev --optimize-autoloader

echo "==> Running database migrations..."
php artisan migrate --force

echo "==> Clearing and rebuilding cached config/routes/views..."
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "==> Ensuring storage symlink exists..."
if [ ! -L public/storage ]; then
    ln -s ../storage/app/public public/storage
    echo "    created public/storage symlink"
else
    echo "    already exists"
fi

echo "==> Ensuring frontend/dist -> backend/public symlink exists..."
cd "$SCRIPT_DIR/frontend/dist"
if [ ! -L backend ]; then
    ln -s ../../backend/public backend
    echo "    created frontend/dist/backend symlink"
else
    echo "    already exists"
fi

echo ""
echo "==> Deploy complete."
