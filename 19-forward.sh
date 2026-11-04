#!/bin/sh
# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 ZCT Studio

set -eu
proxy_url="${ZCT_SLMS_WEB_PROXY_URL:-http://host.docker.internal:17112}"
case "${ZCT_SLMS_WEB_FORWARD_MODE:-proxy}" in
 off) printf '%s\n' 'default_type text/plain; return 403 "Backend forwarding is disabled";' > /etc/nginx/forward.conf ;;
 proxy) printf '%s\n' "proxy_pass ${proxy_url%/};" 'proxy_set_header X-Real-IP $remote_addr;' 'proxy_set_header X-Forwarded-For $remote_addr;' 'proxy_set_header X-Forwarded-Proto $scheme;' > /etc/nginx/forward.conf ;;
 redirect) printf '%s\n' "return 308 ${ZCT_SLMS_WEB_REDIRECT_URL:-${proxy_url%/}}\$request_uri;" > /etc/nginx/forward.conf ;;
 *) echo 'Invalid ZCT_SLMS_WEB_FORWARD_MODE' >&2; exit 1 ;;
esac
