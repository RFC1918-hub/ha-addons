ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.20

# Stage 1: Build (use Node Alpine for build tools)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/frontend/package*.json ./packages/frontend/
RUN npm ci
COPY . .
RUN npm run build --workspace=packages/frontend
RUN npm run build --workspace=packages/backend

# Stage 2: HA Runtime (HA base image + Node.js)
FROM ${BUILD_FROM}
RUN apk add --no-cache nodejs

WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/packages/backend/package*.json ./packages/backend/
COPY --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --from=build /app/packages/frontend/dist ./packages/frontend/dist
COPY --from=build /app/package-lock.json ./

RUN apk add --no-cache npm && npm ci --omit=dev --workspace=packages/backend && apk del npm

COPY run.sh /run.sh
RUN sed -i 's/\r$//' /run.sh && chmod a+x /run.sh

CMD ["/run.sh"]
