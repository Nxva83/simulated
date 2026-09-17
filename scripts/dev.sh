#!/usr/bin/env bash
# Lance EPIKODI en mode developpement : build Debug + hot-reload QML.
set -euo pipefail
cd "$(dirname "$0")/.."
cmake --preset debug > /dev/null
cmake --build --preset debug
exec ./build/debug/src/epikodi "$@"
