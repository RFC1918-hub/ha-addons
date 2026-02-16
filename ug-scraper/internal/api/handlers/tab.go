package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/converter"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/scraper"
)

// TabHandler handles tab fetch requests
type TabHandler struct {
	ugClient  *scraper.UGClient
	converter *converter.OnSongConverter
}

// NewTabHandler creates a new tab handler
func NewTabHandler(ugClient *scraper.UGClient, conv *converter.OnSongConverter) *TabHandler {
	return &TabHandler{
		ugClient:  ugClient,
		converter: conv,
	}
}

// Handle processes tab fetch requests
func (h *TabHandler) Handle(c *fiber.Ctx) error {
	tabID := c.Params("id")
	if tabID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "tab ID is required",
		})
	}

	fmt.Printf("\n🎼 Fetching tab: ID=%s\n", tabID)

	// Fetch tab from Ultimate Guitar
	tab, err := h.ugClient.GetTabByID(tabID)
	if err != nil {
		fmt.Printf("❌ Failed to fetch tab: %v\n\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to fetch tab",
			"details": err.Error(),
		})
	}

	fmt.Printf("✅ Tab fetched: %s - %s\n", tab.ArtistName, tab.SongName)

	// Validate tab
	if err := h.converter.ValidateTab(tab); err != nil {
		fmt.Printf("⚠️  Validation failed: %v\n\n", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid tab data",
			"details": err.Error(),
		})
	}

	fmt.Println("🔄 Converting to OnSong format...")
	// Convert to OnSong format
	result, err := h.converter.Convert(tab)
	if err != nil {
		fmt.Printf("❌ Conversion failed: %v\n\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "conversion failed",
			"details": err.Error(),
		})
	}

	fmt.Printf("✅ Conversion complete: key=%s, capo=%d, %d chords\n\n", result.DetectedKey, tab.Capo, result.ChordCount)

	// Return both raw and formatted content
	return c.JSON(fiber.Map{
		"id":            tab.TabID,
		"title":         tab.SongName,
		"artist":        tab.ArtistName,
		"key":           result.DetectedKey,
		"capo":          tab.Capo,
		"tuning":        tab.Tuning,
		"difficulty":    tab.Difficulty,
		"rating":        tab.Rating,
		"votes":         tab.Votes,
		"content":       tab.Content,
		"onsong_format": result.OnSongFormat,
		"chords":        result.Chords,
		"chord_count":   result.ChordCount,
		"url":           tab.URLWeb,
	})
}
