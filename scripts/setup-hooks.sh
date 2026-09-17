#!/usr/bin/env bash
# Active les hooks git du depot (.githooks/). A lancer une fois apres le clone.
set -euo pipefail
cd "$(dirname "$0")/.."
git config core.hooksPath .githooks
echo "Hooks git actives (core.hooksPath = .githooks)."
