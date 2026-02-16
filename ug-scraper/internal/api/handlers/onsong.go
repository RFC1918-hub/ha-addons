package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/converter"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/scraper"
)

// OnSongHandler handles OnSong format conversion
type OnSongHandler struct {
	ugClient  *scraper.UGClient
	converter *converter.OnSongConverter
}

// NewOnSongHandler creates a new OnSong handler
func NewOnSongHandler(ugClient *scraper.UGClient, conv *converter.OnSongConverter) *OnSongHandler {
	return &OnSongHandler{
		ugClient:  ugClient,
		converter: conv,
	}
}

// Handle processes OnSong format requests
// Expects POST body: { "id": "tab_id" }
func (h *OnSongHandler) Handle(c *fiber.Ctx) error {
	var req struct {
		ID interface{} `json:"id"` // Can be string or number
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid request body",
			"details": err.Error(),
		})
	}

	// Convert ID to string
	var tabID string
	switch v := req.ID.(type) {
	case string:
		tabID = v
	case float64:
		tabID = fmt.Sprintf("%.0f", v)
	case int:
		tabID = fmt.Sprintf("%d", v)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "tab ID must be a string or number",
		})
	}

	if tabID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "tab ID is required",
		})
	}

	// Fetch tab from Ultimate Guitar
	tab, err := h.ugClient.GetTabByID(tabID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to fetch tab",
			"details": err.Error(),
		})
	}

	// Validate tab
	if err := h.converter.ValidateTab(tab); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid tab data",
			"details": err.Error(),
		})
	}

	// Convert to OnSong format
	result, err := h.converter.Convert(tab)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "conversion failed",
			"details": err.Error(),
		})
	}

	// Return just the OnSong formatted string (as your frontend expects)
	return c.SendString(result.OnSongFormat)
}
