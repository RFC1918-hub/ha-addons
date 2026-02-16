package handlers

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/config"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/webhook"
)

// WebhookHandler handles webhook configuration and delivery
type WebhookHandler struct {
	configStore   *config.ConfigStore
	webhookClient *webhook.Client
}

// NewWebhookHandler creates a new webhook handler
func NewWebhookHandler(
	configStore *config.ConfigStore,
	webhookClient *webhook.Client,
) *WebhookHandler {
	return &WebhookHandler{
		configStore:   configStore,
		webhookClient: webhookClient,
	}
}

// GetConfig returns the current webhook configuration
func (h *WebhookHandler) GetConfig(c *fiber.Ctx) error {
	config := h.configStore.Get()
	if config == nil || config.URL == "" {
		return c.JSON(fiber.Map{
			"configured": false,
		})
	}

	return c.JSON(fiber.Map{
		"configured": true,
		"url":        config.URL,
		"enabled":    config.Enabled,
		"created_at": config.CreatedAt,
		"updated_at": config.UpdatedAt,
	})
}

// SaveConfig updates the webhook configuration
func (h *WebhookHandler) SaveConfig(c *fiber.Ctx) error {
	var req struct {
		URL     string `json:"url"`
		Enabled bool   `json:"enabled"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid request body",
			"details": err.Error(),
		})
	}

	fmt.Printf("\n🔗 Webhook Config: url=%s enabled=%v\n", req.URL, req.Enabled)

	// Create config
	webhookConfig := &config.WebhookConfig{
		URL:     req.URL,
		Enabled: req.Enabled,
	}

	// Validate config
	if err := webhookConfig.Validate(); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid webhook configuration",
			"details": err.Error(),
		})
	}

	// Save config
	if err := h.configStore.Save(webhookConfig); err != nil {
		fmt.Printf("❌ Failed to save webhook config: %v\n\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to save configuration",
			"details": err.Error(),
		})
	}

	fmt.Println("✅ Webhook configuration saved\n")
	return c.JSON(fiber.Map{
		"success": true,
		"message": "webhook configuration saved",
	})
}

// TestWebhook sends a test payload to the configured webhook
func (h *WebhookHandler) TestWebhook(c *fiber.Ctx) error {
	webhookURL := h.configStore.GetURL()
	if webhookURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "webhook not configured",
		})
	}

	// Send test webhook
	if err := h.webhookClient.TestWebhook(webhookURL); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "test webhook failed",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "test webhook sent successfully",
	})
}

// SendTab sends tab data to the webhook
func (h *WebhookHandler) SendTab(c *fiber.Ctx) error {
	var req struct {
		Title   string `json:"title"`
		Artist  string `json:"artist"`
		Content string `json:"content"`
		Key     string `json:"key"`
		Capo    int    `json:"capo"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid request body",
			"details": err.Error(),
		})
	}

	if req.Title == "" || req.Content == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "title and content are required",
		})
	}

	fmt.Printf("\n📤 Sending to webhook: %s - %s\n", req.Artist, req.Title)

	// Check if webhook is configured
	webhookURL := h.configStore.GetURL()
	if webhookURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "webhook not configured or not enabled",
		})
	}

	// Create webhook payload directly from the provided data
	payload := &webhook.WebhookPayload{
		Title:        req.Title,
		Artist:       req.Artist,
		Key:          req.Key,
		Capo:         req.Capo,
		OnSongFormat: req.Content,
		Timestamp:    time.Now(),
		Source:       "Ultimate Guitar Scraper",
	}

	// Send with retry
	deliveryResult, err := h.webhookClient.SendWithRetry(webhookURL, payload)
	if err != nil {
		fmt.Printf("❌ Webhook delivery failed: %v\n\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"success": false,
			"error":   "webhook delivery failed",
			"details": err.Error(),
			"result":  deliveryResult,
		})
	}

	fmt.Printf("✅ Webhook delivered successfully (attempts=%d)\n\n", deliveryResult.Attempts)
	return c.JSON(deliveryResult)
}

// ClearConfig removes the webhook configuration
func (h *WebhookHandler) ClearConfig(c *fiber.Ctx) error {
	if err := h.configStore.Clear(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to clear configuration",
			"details": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "webhook configuration cleared",
	})
}
