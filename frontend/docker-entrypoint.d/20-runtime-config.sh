#!/bin/sh
set -eu

api_url="${API_URL:-http://localhost:3000/api}"
case "$api_url" in
  http://*|https://*) ;;
  *)
    echo "API_URL must be an absolute http or https URL" >&2
    exit 1
    ;;
esac

escaped_api_url=$(printf '%s' "$api_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf 'window.__CHRONOS_CONFIG__ = { apiUrl: "%s" };\n' "$escaped_api_url" > /usr/share/nginx/html/config.js
echo "Deployment stage: frontend runtime configuration applied"
