# Ultimate Guitar Scraper - Home Assistant Add-on

A Home Assistant add-on that scrapes chord tabs from Ultimate Guitar, converts them to OnSong format, and delivers them via webhooks.

## Features

- **Search Ultimate Guitar** - Find tabs by song name or artist
- **OnSong Format Conversion** - Automatic conversion with chord analysis and key detection
- **Webhook Delivery** - Send formatted tabs to any webhook URL with retry logic
- **Home Assistant Ingress** - Access directly from the HA sidebar
- **Persistent Config** - Webhook settings saved across restarts

## Installation

1. Add this repository to your Home Assistant Add-on Store
2. Install the "Ultimate Guitar Scraper" add-on
3. Configure options (optional)
4. Start the add-on
5. Click "Open Web UI" in the sidebar

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `flaresolverr_url` | FlareSolverr instance URL for web search fallback | _(empty)_ |
| `webhook_url` | Pre-configure webhook destination URL | _(empty)_ |
| `webhook_enabled` | Enable webhook delivery | `false` |

### FlareSolverr

For web-based search (fallback when API search fails), you can run FlareSolverr as a separate add-on or container:

```yaml
flaresolverr_url: "http://flaresolverr:8191"
```

## Usage

1. **Search** - Type a song name or artist in the search bar
2. **Select** - Click a tab from the results
3. **Preview** - View the OnSong formatted tab
4. **Send** - Configure a webhook and send the tab

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/search?q={query}` - Search tabs
- `GET /api/tab/:id` - Fetch tab by ID
- `POST /api/onsong` - Convert tab to OnSong
- `POST /api/format` - Format manual content
- `GET /api/webhook/config` - Get webhook config
- `POST /api/webhook/config` - Save webhook config
- `POST /api/webhook/send` - Send tab via webhook

## Architecture

```
ug-scraper/
├── config.yaml          # HA add-on manifest
├── Dockerfile           # Multi-stage build
├── run.sh               # HA add-on entrypoint
├── cmd/server/          # Go server entry point
├── internal/
│   ├── api/             # HTTP handlers & routes
│   ├── scraper/         # UG API client & search
│   ├── converter/       # OnSong format conversion
│   ├── webhook/         # Webhook delivery with retry
│   ├── config/          # Persistent config store
│   └── middleware/      # CORS & logging
└── frontend/            # React + Material UI + Vite
```

## License

MIT
