#!/bin/sh
set -eu
case "${BACKEND_FORWARD_MODE:-off}" in
 off) printf '%s\n' 'default_type text/plain; return 403 "Backend forwarding is disabled";' > /etc/nginx/forward.conf ;;
 proxy) printf '%s\n' "proxy_pass ${BACKEND_URL%/};" 'proxy_set_header X-Real-IP $remote_addr;' 'proxy_set_header X-Forwarded-For $remote_addr;' 'proxy_set_header X-Forwarded-Proto $scheme;' > /etc/nginx/forward.conf ;;
 redirect) printf '%s\n' "return 308 ${BACKEND_PUBLIC_URL:-${BACKEND_URL%/}}\$request_uri;" > /etc/nginx/forward.conf ;;
 *) echo 'Invalid BACKEND_FORWARD_MODE' >&2; exit 1 ;;
esac
