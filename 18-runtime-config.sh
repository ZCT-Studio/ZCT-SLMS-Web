#!/bin/sh
set -eu
url="${ZCT_SLMS_WEB_API_URL:-}"
valid=1
case "$url" in *[!A-Za-z0-9:/.-]*) valid=0 ;; esac
if [ -n "$url" ] && ! printf '%s\n' "$url" | grep -Eq '^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$|^http://(localhost|127\.0\.0\.1)(:[0-9]+)?/?$'; then
 valid=0
fi
if [ "$valid" -eq 0 ]; then
 echo 'Invalid ZCT_SLMS_WEB_API_URL: HTTPS origin required (HTTP localhost allowed)' >&2
 exit 1
fi
printf 'window.__ZCT_SLMS_CONFIG__ = { apiBaseUrl: "%s" };\n' "$url" > /usr/share/nginx/html/runtime-config.js
