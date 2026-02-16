#!/usr/bin/with-contenv bashio
# Home Assistant Add-on: Ultimate Guitar Scraper

# Read options from Home Assistant
FLARESOLVERR_URL=$(bashio::config 'flaresolverr_url' '')
WEBHOOK_URL=$(bashio::config 'webhook_url' '')
WEBHOOK_ENABLED=$(bashio::config 'webhook_enabled' 'false')

# Export environment variables for the Go server
export FLARESOLVERR_URL
export PORT=8080
export CONFIG_FILE=/data/webhook-config.json

# Pre-configure webhook if set in HA options
if [ -n "$WEBHOOK_URL" ]; then
    mkdir -p /data
    cat > /data/webhook-config.json <<EOF
{
  "url": "${WEBHOOK_URL}",
  "enabled": ${WEBHOOK_ENABLED},
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    bashio::log.info "Webhook configured: ${WEBHOOK_URL}"
fi

bashio::log.info "Starting Ultimate Guitar Scraper..."
exec /server
