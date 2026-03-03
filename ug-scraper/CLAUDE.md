# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A Home Assistant add-on that scrapes Ultimate Guitar tabs, converts them to OnSong/ChordPro format, and delivers them via webhook. It runs as a single binary (Go backend + embedded React frontend) on port 8080 with HA ingress support.

## Build Commands

**Frontend** (must be built before Go embeds it):
```bash
cd frontend && npm install
npm run build       # TypeScript compile + Vite build → frontend/dist/
npm run dev         # Dev server (proxies /api to localhost:8080)
npm run lint        # ESLint
```

**Backend:**
```bash
go build ./cmd/server        # Build binary
go run ./cmd/server          # Run locally (frontend/dist must exist)
```

**Docker (production):**
```bash
docker build -f Dockerfile .  # Multi-stage: Node 20 → Go 1.24 → HA base image
```

The Dockerfile compiles the frontend first, then embeds it into the Go binary via `go:embed`.

## Architecture

### Request Flow
1. React frontend → `GET /api/search?q=` → SearchScraper (multi-strategy HTML scraping)
2. User selects result → `GET /api/tab/{id}` → UGClient (mimics Android app API)
3. Result auto-converted to OnSong format → displayed in PreviewPane
4. User sends to webhook → `POST /api/webhook/send` → WebhookClient (exponential backoff)

### Backend Structure (`internal/`)

- **`scraper/search_scraper.go`** — Primary search with three fallback strategies: UG Android API (currently returns 404), FlareSolverr (optional Cloudflare bypass), direct HTML scraping via goquery parsing React DOM JSON
- **`scraper/ug_client.go`** — Fetches full tab via `api.ultimate-guitar.com/api/v1/tab/info`; mimics Android app with dynamic MD5 auth header and random device ID
- **`converter/onsong.go`** — Converts `[ch]chord[/ch]` UG format to `[chord]` OnSong inline format; handles section headers, capo, tuning, key detection
- **`converter/chord_parser.go`** — Extracts chords via regex, detects musical key by root note frequency + major/minor analysis
- **`webhook/retry.go`** — Delivers payload (title, artist, key, capo, onsong_format) with exponential backoff (1s→16s, max 6 retries)
- **`config/storage.go`** — Thread-safe JSON config persisted to `/data/webhook-config.json`
- **`api/routes.go`** — Dependency injection: initializes all components, wires them into handlers

### Frontend Structure (`frontend/src/`)

React 19 + Material UI 7. Two-column desktop layout (40% results / 60% preview), tabbed (Search | Manual Entry).

- **`App.tsx`** — Root state: search results, selected tab, loading, webhook status
- **`services/api.ts`** — Axios client with all typed API methods
- **`components/WebhookConfig.tsx`** — Modal; auto-enables webhook on save

### Key Design Decisions

- **Embedded frontend**: `cmd/server/main.go` uses `//go:embed frontend/dist` so the binary is self-contained
- **Dependency injection**: All handler dependencies (scraper, converter, webhook client, config store) initialized in `routes.go`, not in handlers
- **Search fallbacks**: The UG API no longer works; HTML scraping is the actual primary path. FlareSolverr is optional for Cloudflare-blocked requests
- **Config persistence**: HA add-ons store state in `/data/`; config is loaded at startup from both `/data/webhook-config.json` and HA options environment variables

## Configuration

Set via Home Assistant add-on options (`config.yaml`), passed as env vars by `run.sh`:
- `FLARESOLVERR_URL` — Optional; enables FlareSolverr fallback in search
- `WEBHOOK_URL` — Pre-configured webhook destination
- `WEBHOOK_ENABLED` — `"true"` / `"false"`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search?q=` | Search Ultimate Guitar |
| GET | `/api/tab/{id}` | Fetch and convert a tab |
| POST | `/api/onsong` | Convert raw tab content to OnSong |
| POST | `/api/format` | Format manual input |
| GET/PUT | `/api/webhook/config` | Get/save webhook config |
| POST | `/api/webhook/send` | Send tab to webhook |
| GET | `/api/health` | Health check |

## No Tests

There are no automated tests. Manual testing is done by running the server locally and hitting the API endpoints.
