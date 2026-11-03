ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:alpine
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org/
COPY package*.json ./
RUN npm install --no-audit --no-fund --registry=${NPM_REGISTRY}
COPY . .
RUN npm run build
FROM ${NGINX_IMAGE}
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY 19-forward.sh /docker-entrypoint.d/19-forward.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/19-forward.sh && chmod +x /docker-entrypoint.d/19-forward.sh
EXPOSE 80
