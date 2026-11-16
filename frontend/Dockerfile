FROM node:24-alpine AS base

WORKDIR /app
COPY package*.json ./

FROM base AS development

RUN npm ci
COPY . ./

EXPOSE 5173
CMD ["./node_modules/.bin/vite", "--host", "0.0.0.0"]

FROM base AS build

RUN npm ci
COPY . ./
RUN npm run build

FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.d/20-runtime-config.sh /docker-entrypoint.d/20-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/20-runtime-config.sh

EXPOSE 80
