#!/usr/bin/with-contenv bashio

ONSONG_TOKEN=$(bashio::config 'onsong_token' '')
export ONSONG_TOKEN
export PORT=8080
export NODE_ENV=production

bashio::log.info "Starting Chord Finder..."
bashio::log.info "Port: 8080"

if [ -n "$ONSONG_TOKEN" ]; then
    bashio::log.info "OnSong Cloud: configured"
else
    bashio::log.warning "OnSong Cloud: token not set (send-to-OnSong disabled)"
fi

exec node /app/packages/backend/dist/index.js
