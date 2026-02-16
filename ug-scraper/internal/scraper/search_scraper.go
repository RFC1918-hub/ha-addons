package scraper

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

const (
	ugSearchURL    = "https://www.ultimate-guitar.com/search.php"
	ugAppSearchURL = "https://api.ultimate-guitar.com/api/v1/search"
	ugSuggestURL   = "https://api.ultimate-guitar.com/api/v1/suggest"
	ugTabSearchURL = "https://api.ultimate-guitar.com/api/v1/tab-search"
)

// SearchScraper handles searching Ultimate Guitar
type SearchScraper struct {
	httpClient      *http.Client
	ugClient        *UGClient
	flareSolverrURL string
}

// NewSearchScraper creates a new search scraper with UG client authentication
func NewSearchScraper() *SearchScraper {
	// Check for FlareSolverr URL from environment
	flareSolverrURL := ""
	if url := os.Getenv("FLARESOLVERR_URL"); url != "" {
		flareSolverrURL = url
	}

	return &SearchScraper{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		ugClient:        NewUGClient(),
		flareSolverrURL: flareSolverrURL,
	}
}

// SearchOptions contains search filter options
type SearchOptions struct {
	Query      string
	Type       string // chords, tabs, bass, etc.
	Difficulty string // beginner, intermediate, advanced
}

// SearchTabs searches Ultimate Guitar and returns tab results
// First tries API search, falls back to HTML scraping if API fails
func (s *SearchScraper) SearchTabs(opts SearchOptions) ([]SearchResult, error) {
	if opts.Query == "" {
		return nil, fmt.Errorf("search query cannot be empty")
	}

	fmt.Printf("🔍 Searching for: %q (type=%s, difficulty=%s)\n", opts.Query, opts.Type, opts.Difficulty)

	// Try API search first
	fmt.Println("📡 Attempting API search...")
	results, err := s.searchViaAPI(opts)
	if err == nil && len(results) > 0 {
		fmt.Printf("✅ API search successful: %d results\n", len(results))
		return filterTopResults(results), nil
	}
	fmt.Printf("⚠️  API search failed: %v\n", err)

	// Fallback to HTML scraping if API fails
	fmt.Println("🌐 Falling back to HTML scraping...")
	results, err = s.searchViaHTML(opts)
	if err != nil {
		fmt.Printf("❌ HTML scraping failed: %v\n", err)
		return nil, err
	}

	fmt.Printf("✅ HTML scraping successful: %d results\n", len(results))
	return filterTopResults(results), nil
}

// searchViaAPI searches using Ultimate Guitar's Android app API with authentication
func (s *SearchScraper) searchViaAPI(opts SearchOptions) ([]SearchResult, error) {
	// Try multiple endpoints
	endpoints := []string{
		fmt.Sprintf("%s?value=%s", ugSuggestURL, url.QueryEscape(opts.Query)),
		fmt.Sprintf("%s?query=%s", ugTabSearchURL, url.QueryEscape(opts.Query)),
		fmt.Sprintf("%s?title=%s", ugAppSearchURL, url.QueryEscape(opts.Query)),
	}

	fmt.Printf("   Trying %d API endpoints...\n", len(endpoints))
	var lastErr error
	for i, apiURL := range endpoints {
		if opts.Type != "" {
			apiURL += fmt.Sprintf("&type=%s", opts.Type)
		}

		fmt.Printf("   [%d/%d] %s\n", i+1, len(endpoints), apiURL)
		results, err := s.trySearchEndpoint(apiURL)
		if err == nil && len(results) > 0 {
			fmt.Printf("   ✓ Endpoint returned %d results\n", len(results))
			return results, nil
		}
		fmt.Printf("   ✗ Endpoint failed: %v\n", err)
		lastErr = err
	}

	return nil, lastErr
}

// trySearchEndpoint attempts to search using a specific endpoint
func (s *SearchScraper) trySearchEndpoint(apiURL string) ([]SearchResult, error) {

	// Create request
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("creating API request: %w", err)
	}

	// Use the SAME headers as the Android app (from ug_client.go)
	req.Header.Set("Accept-Charset", "utf-8")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", ugUserAgent) // UGT_ANDROID/4.11.1 (Pixel; 8.1.0)
	req.Header.Set("Connection", "close")

	// Add authentication headers (device ID + API key)
	req.Header.Set("X-UG-CLIENT-ID", s.ugClient.deviceID)
	req.Header.Set("X-UG-API-KEY", s.ugClient.generateAPIKey())

	// Remove Accept-Encoding (as the app does)
	req.Header.Del("Accept-Encoding")

	resp, err := s.ugClient.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("      HTTP %d: %s\n", resp.StatusCode, string(body))
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse API response
	var apiResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("decoding API response: %w", err)
	}

	// Extract results from API response
	results := s.parseAPIResults(apiResp)
	if len(results) == 0 {
		return nil, fmt.Errorf("no results found in API response")
	}

	return results, nil
}

// searchViaHTML falls back to HTML scraping
func (s *SearchScraper) searchViaHTML(opts SearchOptions) ([]SearchResult, error) {
	// Build search URL with query parameters
	searchURL, err := s.buildSearchURL(opts)
	if err != nil {
		return nil, fmt.Errorf("building search URL: %w", err)
	}

	fmt.Printf("   URL: %s\n", searchURL)
	var body []byte

	// Try FlareSolverr first if configured
	if s.flareSolverrURL != "" {
		fmt.Printf("   Using FlareSolverr at %s\n", s.flareSolverrURL)
		htmlContent, err := s.searchViaFlareSolverr(searchURL)
		if err == nil {
			fmt.Println("   ✓ FlareSolverr bypass successful")
			body = []byte(htmlContent)
		} else {
			fmt.Printf("   ✗ FlareSolverr failed: %v\n", err)
		}
	} else {
		fmt.Println("   FlareSolverr not configured, using direct request")
	}

	// Fallback to direct request if FlareSolverr not configured or failed
	if body == nil {
		req, err := http.NewRequest("GET", searchURL, nil)
		if err != nil {
			return nil, fmt.Errorf("creating request: %w", err)
		}

		req.Header.Set("User-Agent", ugUserAgent)
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

		resp, err := s.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("making request: %w", err)
		}
		defer resp.Body.Close()

		body, err = io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("reading response: %w", err)
		}
	}

	// Optionally save HTML for debugging (commented out for production)
	// os.WriteFile("/tmp/ug_search.html", body, 0644)

	// Try regex parsing first (old format)
	fmt.Println("   Parsing HTML with regex...")
	results, err := s.parseHTMLWithRegex(string(body))
	if err == nil && len(results) > 0 {
		fmt.Printf("   ✓ Regex parsing found %d results\n", len(results))
		return results, nil
	}
	fmt.Printf("   ✗ Regex parsing failed: %v\n", err)

	// Fallback to DOM parsing for React-rendered content
	fmt.Println("   Trying DOM parsing...")
	results, err = s.parseReactDOM(string(body))
	if err != nil {
		return nil, fmt.Errorf("parsing search results: %w", err)
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("no results found")
	}

	return results, nil
}

// searchViaFlareSolverr uses FlareSolverr to bypass Cloudflare protection
func (s *SearchScraper) searchViaFlareSolverr(targetURL string) (string, error) {
	requestBody := map[string]interface{}{
		"cmd":        "request.get",
		"url":        targetURL,
		"maxTimeout": 60000,
		// Wait for search results to appear (React renders them)
		"postBody": "",
		"cookies":  []map[string]string{},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("marshaling request: %w", err)
	}

	resp, err := http.Post(
		fmt.Sprintf("%s/v1", s.flareSolverrURL),
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return "", fmt.Errorf("FlareSolverr request failed: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Status   string `json:"status"`
		Message  string `json:"message"`
		Solution struct {
			URL      string `json:"url"`
			Status   int    `json:"status"`
			Response string `json:"response"`
		} `json:"solution"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decoding FlareSolverr response: %w", err)
	}

	if result.Status != "ok" {
		return "", fmt.Errorf("FlareSolverr returned status: %s, message: %s", result.Status, result.Message)
	}

	return result.Solution.Response, nil
}

// buildSearchURL constructs the search URL with parameters
func (s *SearchScraper) buildSearchURL(opts SearchOptions) (string, error) {
	params := url.Values{}
	params.Set("search_type", "title")
	params.Set("value", opts.Query)

	if opts.Type != "" {
		params.Set("type", opts.Type)
	}

	return fmt.Sprintf("%s?%s", ugSearchURL, params.Encode()), nil
}

// parseTabResult converts a map to SearchResult
func (s *SearchScraper) parseTabResult(data map[string]interface{}) SearchResult {
	result := SearchResult{}

	if id, ok := data["id"].(float64); ok {
		result.ID = fmt.Sprintf("%.0f", id)
	} else if idStr, ok := data["id"].(string); ok {
		result.ID = idStr
	}

	if songName, ok := data["song_name"].(string); ok {
		result.Title = songName
	}

	if artistName, ok := data["artist_name"].(string); ok {
		result.Artist = artistName
	}

	if tabType, ok := data["type"].(string); ok {
		result.Type = tabType
	}

	if rating, ok := data["rating"].(float64); ok {
		result.Rating = rating
	}

	if votes, ok := data["votes"].(float64); ok {
		result.Votes = int(votes)
	}

	if difficulty, ok := data["difficulty"].(string); ok {
		result.Difficulty = difficulty
	}

	if tabURL, ok := data["tab_url"].(string); ok {
		result.URL = tabURL
	}

	return result
}

// parseAPIResults extracts search results from API response
func (s *SearchScraper) parseAPIResults(apiResp map[string]interface{}) []SearchResult {
	var results []SearchResult

	// Try to extract tabs from the response
	if tabs, ok := apiResp["tabs"].([]interface{}); ok {
		for _, tab := range tabs {
			if tabMap, ok := tab.(map[string]interface{}); ok {
				result := SearchResult{}

				if id, ok := tabMap["id"].(float64); ok {
					result.ID = fmt.Sprintf("%.0f", id)
				}
				if title, ok := tabMap["song_name"].(string); ok {
					result.Title = title
				}
				if artist, ok := tabMap["artist_name"].(string); ok {
					result.Artist = artist
				}
				if tabType, ok := tabMap["type"].(string); ok {
					result.Type = tabType
				}
				if rating, ok := tabMap["rating"].(float64); ok {
					result.Rating = rating
				}
				if votes, ok := tabMap["votes"].(float64); ok {
					result.Votes = int(votes)
				}
				if url, ok := tabMap["tab_url"].(string); ok {
					result.URL = url
				}

				if result.ID != "" {
					results = append(results, result)
				}
			}
		}
	}

	// Try alternative structure
	if len(results) == 0 {
		if data, ok := apiResp["data"].(map[string]interface{}); ok {
			if tabs, ok := data["results"].([]interface{}); ok {
				for _, tab := range tabs {
					if tabMap, ok := tab.(map[string]interface{}); ok {
						results = append(results, s.parseTabResult(tabMap))
					}
				}
			}
		}
	}

	return results
}

// parseHTMLWithRegex extracts JSON data from HTML using regex (for old format)
func (s *SearchScraper) parseHTMLWithRegex(html string) ([]SearchResult, error) {
	// Try old js-store format
	re := regexp.MustCompile(`<div class="js-store"[^>]*data-content="([^"]+)"`)
	matches := re.FindStringSubmatch(html)

	if len(matches) < 2 {
		return []SearchResult{}, nil // No results found with old format
	}

	// Decode HTML entities
	dataContent := decodeHTMLEntities(matches[1])

	// Parse JSON
	var store struct {
		Store struct {
			Page struct {
				Data struct {
					Results []struct {
						ID         int     `json:"id"`
						SongName   string  `json:"song_name"`
						ArtistName string  `json:"artist_name"`
						Type       string  `json:"type"`
						TabURL     string  `json:"tab_url"`
						Rating     float64 `json:"rating"`
					} `json:"results"`
				} `json:"data"`
			} `json:"page"`
		} `json:"store"`
	}

	if err := json.Unmarshal([]byte(dataContent), &store); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Convert to SearchResult slice
	results := make([]SearchResult, 0, len(store.Store.Page.Data.Results))
	for _, r := range store.Store.Page.Data.Results {
		results = append(results, SearchResult{
			ID:     fmt.Sprintf("%d", r.ID),
			Title:  r.SongName,
			Artist: r.ArtistName,
			Type:   r.Type,
			URL:    r.TabURL,
			Rating: r.Rating,
		})
	}

	// Filter to get top-rated Chords per artist
	filtered := filterTopResults(results)

	return filtered, nil
}

// decodeHTMLEntities decodes common HTML entities
func decodeHTMLEntities(s string) string {
	replacements := map[string]string{
		"&quot;": "\"",
		"&amp;":  "&",
		"&#39;":  "'",
		"&lt;":   "<",
		"&gt;":   ">",
	}

	result := s
	for entity, replacement := range replacements {
		result = strings.ReplaceAll(result, entity, replacement)
	}

	return result
}

// filterTopResults picks the top-rated Chords version per artist
func filterTopResults(results []SearchResult) []SearchResult {
	// Map to store top result per artist
	topResults := make(map[string]SearchResult)

	for _, r := range results {
		artist := r.Artist
		if artist == "" {
			artist = "Unknown"
		}

		current, exists := topResults[artist]
		isChords := strings.ToLower(r.Type) == "chords"
		currentIsChords := strings.ToLower(current.Type) == "chords"

		if !exists {
			// No result for this artist yet
			topResults[artist] = r
		} else if isChords && !currentIsChords {
			// Replace non-Chords with Chords version
			topResults[artist] = r
		} else if isChords && currentIsChords && r.Rating > current.Rating {
			// Both are Chords, pick higher rated
			topResults[artist] = r
		} else if !isChords && !currentIsChords && r.Rating > current.Rating {
			// Neither are Chords, pick higher rated (fallback)
			topResults[artist] = r
		}
	}

	// Convert map to slice
	filtered := make([]SearchResult, 0, len(topResults))
	for _, result := range topResults {
		filtered = append(filtered, result)
	}

	return filtered
}

// parseReactDOM parses the rendered React DOM to extract search results
func (s *SearchScraper) parseReactDOM(html string) ([]SearchResult, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, fmt.Errorf("parsing HTML: %w", err)
	}

	var results []SearchResult

	// UG URL pattern: /tab/{artist}/{song-name}-{type}-{id}
	// Known tab types in URLs
	tabTypeMap := map[string]string{
		"chords":   "Chords",
		"tabs":     "Tab",
		"guitar":   "Guitar Pro", // guitar-pro
		"bass":     "Bass",
		"drums":    "Drums",
		"ukulele":  "Ukulele",
		"power":    "Power",
		"video":    "Video",
		"official": "Official",
	}

	// Look for links that match /tab/ pattern
	doc.Find("a[href*='/tab/']").Each(func(i int, sel *goquery.Selection) {
		href, exists := sel.Attr("href")
		if !exists {
			return
		}

		// Extract tab ID from URL (last number after final hyphen)
		parts := strings.Split(href, "-")
		if len(parts) == 0 {
			return
		}
		idStr := parts[len(parts)-1]

		// Validate ID is numeric
		if !regexp.MustCompile(`^\d+$`).MatchString(idStr) {
			return
		}

		// Extract artist from URL path: /tab/{artist}/{song-stuff}
		parsedURL, err := url.Parse(href)
		if err != nil {
			return
		}
		pathParts := strings.Split(strings.Trim(parsedURL.Path, "/"), "/")

		artist := ""
		if len(pathParts) >= 2 {
			// Artist is the segment after "tab"
			for i, p := range pathParts {
				if p == "tab" && i+1 < len(pathParts) {
					artist = pathParts[i+1]
					break
				}
			}
			// Format artist: replace hyphens with spaces, title case
			artist = strings.ReplaceAll(artist, "-", " ")
			artist = strings.Title(artist)
		}

		// Extract tab type from URL
		// URL ends with: {song}-{type}-{id} or {song}-{type}-pro-{id}
		tabType := ""
		if len(parts) >= 2 {
			// Check the second-to-last part for type
			typeCandidate := parts[len(parts)-2]
			if mapped, ok := tabTypeMap[typeCandidate]; ok {
				tabType = mapped
			}
			// Handle "guitar-pro" (type is two segments before ID)
			if typeCandidate == "pro" && len(parts) >= 3 {
				if parts[len(parts)-3] == "guitar" {
					tabType = "Guitar Pro"
				}
			}
		}

		// Get song name from the link text
		title := strings.TrimSpace(sel.Text())

		if title != "" && idStr != "" {
			results = append(results, SearchResult{
				ID:     idStr,
				Title:  title,
				Artist: artist,
				Type:   tabType,
				URL:    href,
			})
		}
	})

	// Remove duplicates
	seen := make(map[string]bool)
	unique := []SearchResult{}
	for _, r := range results {
		if !seen[r.ID] {
			seen[r.ID] = true
			unique = append(unique, r)
		}
	}

	return unique, nil
}
