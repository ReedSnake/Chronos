FROM node:24-alpine AS base

WORKDIR /app
COPY package*.json ./

FROM base AS development

RUN npm ci
COPY src ./src
COPY uploads ./uploads

ENV NODE_ENV=development
EXPOSE 3000
CMD ["node", "--watch", "src/server.js"]

FROM base AS production

RUN npm ci --omit=dev
COPY src ./src
COPY uploads ./uploads

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]
