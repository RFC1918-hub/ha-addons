package api

import (
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/api/handlers"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/config"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/converter"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/scraper"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/webhook"
)

// SetupRoutes configures all API routes
func SetupRoutes(app *fiber.App) {
	// Initialize components - use CONFIG_FILE env var or default to /data/webhook-config.json
	configFile := "/data/webhook-config.json"
	if cf := os.Getenv("CONFIG_FILE"); cf != "" {
		configFile = cf
	}
	configStore := config.NewConfigStore(configFile)
	ugClient := scraper.NewUGClient()
	searchScraper := scraper.NewSearchScraper()
	onSongConverter := converter.NewOnSongConverter()
	webhookClient := webhook.NewClient()

	// Create handlers
	healthHandler := handlers.NewHealthHandler(configStore)
	searchHandler := handlers.NewSearchHandler(searchScraper)
	tabHandler := handlers.NewTabHandler(ugClient, onSongConverter)
	onSongHandler := handlers.NewOnSongHandler(ugClient, onSongConverter)
	webhookHandler := handlers.NewWebhookHandler(configStore, webhookClient)
	formatHandler := handlers.NewFormatHandler(onSongConverter)

	// API routes group
	api := app.Group("/api")

	// Health check
	api.Get("/health", healthHandler.Handle)

	// Search endpoints
	api.Get("/search", searchHandler.Handle)

	// Tab endpoints
	api.Get("/tab/:id", tabHandler.Handle)
	api.Post("/onsong", onSongHandler.Handle)

	// Format endpoint (manual content)
	api.Post("/format", formatHandler.Handle)

	// Webhook endpoints
	api.Get("/webhook/config", webhookHandler.GetConfig)
	api.Post("/webhook/config", webhookHandler.SaveConfig)
	api.Delete("/webhook/config", webhookHandler.ClearConfig)
	api.Post("/webhook/test", webhookHandler.TestWebhook)
	api.Post("/webhook/send", webhookHandler.SendTab)
}
