package scraper

import (
	"crypto/md5"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	ugAPIEndpoint = "https://api.ultimate-guitar.com/api/v1"
	ugUserAgent   = "UGT_ANDROID/4.11.1 (Pixel; 8.1.0)"
	ugTimeFormat  = "2006-01-02"
)

// UGClient handles communication with Ultimate Guitar API
type UGClient struct {
	deviceID   string
	httpClient *http.Client
}

// NewUGClient creates a new Ultimate Guitar API client with generated device ID
func NewUGClient() *UGClient {
	return &UGClient{
		deviceID:   generateDeviceID(),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// generateDeviceID creates a 16-byte random hex device ID
func generateDeviceID() string {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		// Fallback to time-based ID if random fails
		return fmt.Sprintf("%x", time.Now().UnixNano())[:16]
	}
	return fmt.Sprintf("%x", raw)[:16]
}

// generateAPIKey creates the MD5 hash for X-UG-API-KEY header
// Formula: MD5(deviceID + "YYYY-MM-DD:HH" + "createLog()")
func (c *UGClient) generateAPIKey() string {
	now := time.Now().UTC()
	hour := now.Hour()
	formattedDate := fmt.Sprintf("%s:%d", now.Format(ugTimeFormat), hour)

	payload := fmt.Sprintf("%s%s%s", c.deviceID, formattedDate, "createLog()")
	hash := md5.Sum([]byte(payload))
	return fmt.Sprintf("%x", hash)
}

// configureHeaders adds required Ultimate Guitar API headers to request
func (c *UGClient) configureHeaders(req *http.Request) {
	// Set headers exactly as the Android app does
	req.Header["Accept-Charset"] = []string{"utf-8"}
	req.Header["Accept"] = []string{"application/json"}
	req.Header["User-Agent"] = []string{ugUserAgent}
	req.Header["Connection"] = []string{"close"}
	req.Header["X-UG-CLIENT-ID"] = []string{c.deviceID}
	req.Header["X-UG-API-KEY"] = []string{c.generateAPIKey()}
	// Remove Accept-Encoding to match app behavior
	req.Header.Del("Accept-Encoding")
}

// GetTabByID fetches tab information from Ultimate Guitar API
func (c *UGClient) GetTabByID(tabID string) (*TabResult, error) {
	url := fmt.Sprintf("%s/tab/info?tab_id=%s&tab_access_type=private", ugAPIEndpoint, tabID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	c.configureHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("making request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var apiResp UGAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	// Convert API response to TabResult
	tabResult := &TabResult{
		TabID:        apiResp.TabID,
		SongName:     apiResp.SongName,
		ArtistName:   apiResp.ArtistName,
		Type:         apiResp.Type,
		Part:         apiResp.Part,
		Version:      apiResp.Version,
		Votes:        apiResp.Votes,
		Rating:       apiResp.Rating,
		Status:       apiResp.Status,
		TonalityName: apiResp.TonalityName,
		Verified:     apiResp.Verified,
		Capo:         apiResp.Capo,
		Tuning:       apiResp.Tuning,
		Difficulty:   apiResp.Difficulty,
		Content:      apiResp.Content,
		URLWeb:       apiResp.URLWeb,
		Contributor:  apiResp.Contributor,
	}

	// Parse date if present
	if apiResp.Date != "" {
		if parsedDate, err := time.Parse("2006-01-02", apiResp.Date); err == nil {
			tabResult.Date = parsedDate
		}
	}

	return tabResult, nil
}

// GetDeviceID returns the current device ID (useful for debugging)
func (c *UGClient) GetDeviceID() string {
	return c.deviceID
}
