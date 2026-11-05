#!/bin/sh
# Serve the editor alpha mockups on your own computer. Needs only python3; no installs.
# Usage: ./run.sh            (port 8000)
#        PORT=9000 ./run.sh  (another port)
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8000}"
echo "Editor alpha mockups: http://localhost:${PORT}/  (Ctrl+C to stop)"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
