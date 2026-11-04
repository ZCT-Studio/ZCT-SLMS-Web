# SPDX-License-Identifier: BSD-3-Clause
# Copyright (c) 2026 ZCT Studio

ARG ZCT_SLMS_BUILD_NODE_IMAGE=node:22-alpine
ARG ZCT_SLMS_BUILD_NGINX_IMAGE=nginx:alpine
FROM --platform=$BUILDPLATFORM ${ZCT_SLMS_BUILD_NODE_IMAGE} AS build
WORKDIR /app
ARG ZCT_SLMS_BUILD_NPM_REGISTRY=https://registry.npmjs.org/
COPY package*.json ./
RUN npm ci --no-audit --no-fund --registry=${ZCT_SLMS_BUILD_NPM_REGISTRY}
COPY . .
RUN npm run build && sed -i 's/\r$//' /app/19-forward.sh && chmod +x /app/19-forward.sh && sed -i 's/\r$//' /app/18-runtime-config.sh && chmod +x /app/18-runtime-config.sh
FROM ${ZCT_SLMS_BUILD_NGINX_IMAGE}
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/19-forward.sh /docker-entrypoint.d/19-forward.sh
COPY --from=build /app/18-runtime-config.sh /docker-entrypoint.d/18-runtime-config.sh
EXPOSE 80
