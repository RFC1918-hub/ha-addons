# Chord Finder

A self-hosted web app for searching and reading guitar chord tabs from Ultimate Guitar, optimised for deployment on a Home Assistant host.

## Overview

Chord Finder lets you search for chord tabs by song title and optional artist, view results sorted by rating, and read tab content with chord names visually highlighted. It uses the Ultimate Guitar Android API directly — no browser automation or Cloudflare workarounds required. A URL-paste input is available as a fallback for direct tab links.

Designed to run as a single Docker container on a Raspberry Pi 4 or x86 NUC running Home Assistant OS.

## Requirements

- Node.js 20 LTS
- npm 10+
- Docker (for production deployment)

## Setup

```bash
cd C:\Users\pietern\Documents\Projects\chord-finder

# Install all workspace dependencies
npm install
```

## Development

Start both backend and frontend in watch mode with a single command:

```bash
npm run dev
```

- Frontend: http://localhost:5173 (Vite dev server with HMR)
- Backend: http://localhost:3001
- Vite proxies `/api` requests to the backend — no CORS issues

### Running tests

```bash
# Backend unit tests (48 tests, ~98% line coverage)
npm run test --workspace=packages/backend

# With coverage report
npm run test:coverage --workspace=packages/backend
```

### Building

```bash
# Build both packages
npm run build
```

Output:
- `packages/backend/dist/` — compiled backend JS
- `packages/frontend/dist/` — Vite-built frontend assets

## Production (Docker)

```bash
# Build and start the container
docker compose up --build

# Access at http://localhost:3001
```

The Docker image uses `node:20-alpine` (~100MB). The backend serves the built frontend via `@fastify/static` in production mode. No separate nginx container is needed.

Environment variables:
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Listening port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | (unset) | Set to `production` to enable static file serving |

## Architecture

```
chord-finder/
├── packages/backend/    Fastify server — search, tab fetch, URL resolution, content parsing
└── packages/frontend/   React 18 + Vite + MUI v6 SPA
```

**Search:** Backend calls the UG Android API (`/api/v1/tab/search`) with Android auth headers, filters to `type === "Chords"`, sorts by rating descending. No browser automation needed.

**Tab display:** Raw UG proprietary markup (`[ch]Am[/ch]`, `[tab]...[/tab]`, `[Verse 1]`) is parsed server-side into typed `ContentNode[]` tokens. The frontend never sees raw markup.

**Routing:** React Router v6 with `HashRouter`. Single container — no nginx.

Full design rationale: `vega/edison/active/chord-finder/handoff/adr.md`

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/search?q={title}&artist={optional}` | Search for chord tabs |
| `GET /api/tab/:id` | Fetch and parse a specific tab |
| `POST /api/resolve-url` `{ url }` | Extract tab ID from a UG URL |

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
