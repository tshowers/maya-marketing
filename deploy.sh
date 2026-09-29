#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

trap 'echo "Deploy aborted - a previous step failed, nothing was committed or deployed." >&2' ERR

echo "Running Maya production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Building the production Maya bundle..."
npm run build

echo "Running Maya tests..."
npm test

echo "Running TypeScript validation..."
npm run typecheck

if [ -n "$(git status --porcelain)" ]; then
  echo "Build and checks passed - committing changes before deploy..."
  VERSION="$(node -p "require('./package.json').version")"
  git add -A
  git commit -m "Deploy: v${VERSION}"
else
  echo "No changes to commit - working tree already clean."
fi

echo "Deploying Maya to Firebase Hosting site maya-marketing..."
firebase deploy --project taliferrotech --only hosting:maya-marketing

echo "Maya hosting deploy complete."
