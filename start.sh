#!/bin/bash

# Reader — Research Paper Manager
# Starts the app and opens it as a standalone Mac window

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3777
URL="http://localhost:$PORT"

cd "$APP_DIR"

# Kill any existing instance on this port
lsof -ti:$PORT 2>/dev/null | xargs kill 2>/dev/null

# Build if .next doesn't exist
if [ ! -d ".next" ]; then
  echo "Building Reader..."
  npx next build
fi

# Start the server in the background
npx next start -p $PORT &
SERVER_PID=$!

# Wait for server to be ready
echo "Starting Reader..."
for i in {1..30}; do
  if curl -s -o /dev/null "http://localhost:$PORT" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

# Open as a standalone app window (no browser chrome)
# Try Chrome first (app mode), then Safari, then default browser
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$URL" --new-window
elif [ -d "/Applications/Chromium.app" ]; then
  open -na "Chromium" --args --app="$URL" --new-window
elif [ -d "/Applications/Brave Browser.app" ]; then
  open -na "Brave Browser" --args --app="$URL" --new-window
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="$URL" --new-window
else
  # Fallback: open in default browser
  open "$URL"
fi

echo "Reader is running at $URL (PID: $SERVER_PID)"
echo "Press Ctrl+C to stop"

# Wait for server process — stop on Ctrl+C
trap "kill $SERVER_PID 2>/dev/null; exit 0" INT TERM
wait $SERVER_PID
