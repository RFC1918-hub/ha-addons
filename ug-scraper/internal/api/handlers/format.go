package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/converter"
)

// FormatHandler handles manual content formatting to OnSong format
type FormatHandler struct {
	converter *converter.OnSongConverter
}

// NewFormatHandler creates a new format handler
func NewFormatHandler(conv *converter.OnSongConverter) *FormatHandler {
	return &FormatHandler{
		converter: conv,
	}
}

// Handle processes format requests for manual content
func (h *FormatHandler) Handle(c *fiber.Ctx) error {
	var req struct {
		Title   string `json:"title"`
		Artist  string `json:"artist"`
		Content string `json:"content"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid request body",
			"details": err.Error(),
		})
	}

	if req.Title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "title is required",
		})
	}

	if req.Artist == "" {
		req.Artist = "Unknown Artist"
	}

	formatted := h.converter.FormatManualContent(req.Title, req.Artist, req.Content)

	return c.JSON(fiber.Map{
		"formatted": formatted,
	})
}
