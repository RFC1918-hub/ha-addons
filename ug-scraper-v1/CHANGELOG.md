# Changelog

All notable changes to this project are documented here.

## [0.1.0] — 2026-03-21

### Added

- Initial Phase 1 implementation
- Backend: Fastify server with three API routes (`/api/search`, `/api/tab/:id`, `/api/resolve-url`)
- Backend: UG Android API client — tab search via `/api/v1/tab/search` (Option D confirmed in spike)
- Backend: UG tab fetch via `/api/v1/tab/info` with Android authentication headers
- Backend: MD5 API key generation (`lib/api-key.ts`) using Node.js built-in `crypto`
- Backend: UG proprietary markup parser — converts `[ch]`, `[tab]`, section labels to typed `ContentNode[]`
- Backend: `@fastify/static` production serving of built frontend with `index.html` fallback
- Backend: `@fastify/cors` for development (origin: localhost:5173)
- Frontend: React 18 + Vite + MUI v6 SPA with HashRouter
- Frontend: System-preference dark/light mode via `useMediaQuery`
- Frontend: Deep amber / cyan M3-inspired colour scheme
- Frontend: `SearchPage` with title + artist search, URL paste fallback, empty/error/loading states
- Frontend: `TabPage` with metadata header, back navigation, skeleton loading, retry on error
- Frontend: `TabViewer` — renders `ContentNode[]`; chord tokens as `ChordChip`, tab blocks as monospace pre
- Frontend: Typed API service layer (`services/api.ts`)
- Docker: single-stage Dockerfile using `node:20-alpine` (~100MB, no Playwright)
- Docker: `docker-compose.yml` for one-command production deployment
- Tests: 48 unit tests across 8 suites; 97.52% statement / 99.08% line coverage
