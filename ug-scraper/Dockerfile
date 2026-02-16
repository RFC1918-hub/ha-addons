ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.20
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY frontend/ /app/frontend/
WORKDIR /app/frontend
RUN ls -la /app/frontend/
RUN npm install
RUN npx vite build

# Stage 2: Build backend
FROM golang:1.24-alpine AS backend-build

WORKDIR /app
RUN apk add --no-cache git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-build /app/frontend/dist ./cmd/server/frontend/dist
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /app/server \
    ./cmd/server

# Stage 3: Home Assistant add-on runtime
FROM ${BUILD_FROM}

RUN apk add --no-cache bash

COPY --from=backend-build /app/server /server
COPY run.sh /run.sh
RUN chmod +x /run.sh

CMD ["/run.sh"]
