package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/config"
)

var startTime = time.Now()

// HealthHandler handles health check requests
type HealthHandler struct {
	configStore *config.ConfigStore
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(configStore *config.ConfigStore) *HealthHandler {
	return &HealthHandler{
		configStore: configStore,
	}
}

// Handle processes health check requests
func (h *HealthHandler) Handle(c *fiber.Ctx) error {
	uptime := time.Since(startTime)

	response := fiber.Map{
		"status":              "healthy",
		"uptime":              uptime.String(),
		"version":             "1.0.0",
		"webhook_configured":  h.configStore.IsConfigured(),
		"timestamp":           time.Now(),
	}

	return c.JSON(response)
}
