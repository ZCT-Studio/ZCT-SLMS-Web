ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:alpine
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org/
COPY package*.json ./
RUN npm ci --no-audit --no-fund --registry=${NPM_REGISTRY}
COPY . .
RUN npm run build && sed -i 's/\r$//' /app/19-forward.sh && chmod +x /app/19-forward.sh
FROM ${NGINX_IMAGE}
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/19-forward.sh /docker-entrypoint.d/19-forward.sh
EXPOSE 80
