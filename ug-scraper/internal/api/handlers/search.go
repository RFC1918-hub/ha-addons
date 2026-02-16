package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/scraper"
)

// SearchHandler handles tab search requests
type SearchHandler struct {
	searchScraper *scraper.SearchScraper
}

// NewSearchHandler creates a new search handler
func NewSearchHandler(searchScraper *scraper.SearchScraper) *SearchHandler {
	return &SearchHandler{
		searchScraper: searchScraper,
	}
}

// Handle processes search requests
func (h *SearchHandler) Handle(c *fiber.Ctx) error {
	// Support both 'q' and 'title' parameters
	query := c.Query("title")
	if query == "" {
		query = c.Query("q")
	}
	if query == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "search query 'title' or 'q' parameter is required",
		})
	}

	tabType := c.Query("type", "")
	difficulty := c.Query("difficulty", "")

	fmt.Printf("\n🎸 Search Request: q=%q type=%s difficulty=%s\n", query, tabType, difficulty)

	opts := scraper.SearchOptions{
		Query:      query,
		Type:       tabType,
		Difficulty: difficulty,
	}

	results, err := h.searchScraper.SearchTabs(opts)
	if err != nil {
		fmt.Printf("❌ Search failed: %v\n", err)
		// Return empty array instead of error (UG blocks automated search)
		// Frontend can handle empty results gracefully
		return c.JSON([]fiber.Map{})
	}

	// Return results array directly (as your frontend expects)
	// The frontend expects: { id, song, artist, type, rating }
	formattedResults := make([]fiber.Map, len(results))
	for i, r := range results {
		formattedResults[i] = fiber.Map{
			"id":         r.ID,
			"title":      r.Title,
			"artist":     r.Artist,
			"type":       r.Type,
			"rating":     r.Rating,
			"votes":      r.Votes,
			"difficulty": r.Difficulty,
			"url":        r.URL,
		}
	}

	fmt.Printf("✅ Returning %d results\n\n", len(formattedResults))
	return c.JSON(formattedResults)
}
