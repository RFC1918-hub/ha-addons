package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/cenkalti/backoff/v4"
)

// Client handles webhook delivery with retry logic
type Client struct {
	httpClient *http.Client
	maxRetries uint64
	timeout    time.Duration
}

// NewClient creates a new webhook client
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		maxRetries: 6,
		timeout:    10 * time.Second,
	}
}

// DeliveryResult contains the result of a webhook delivery attempt
type DeliveryResult struct {
	Success    bool      `json:"success"`
	DeliveryID string    `json:"delivery_id"`
	Attempts   int       `json:"attempts"`
	Error      string    `json:"error,omitempty"`
	Duration   string    `json:"duration"`
	Timestamp  time.Time `json:"timestamp"`
}

// WebhookPayload is the structure sent to the webhook
type WebhookPayload struct {
	Title        string    `json:"title"`
	Artist       string    `json:"artist"`
	Key          string    `json:"key"`
	Capo         int       `json:"capo,omitempty"`
	OnSongFormat string    `json:"onsong_format"`
	Timestamp    time.Time `json:"timestamp"`
	Source       string    `json:"source"`
}

// SendWithRetry sends a webhook payload with exponential backoff retry
func (c *Client) SendWithRetry(webhookURL string, payload *WebhookPayload) (*DeliveryResult, error) {
	if webhookURL == "" {
		return nil, fmt.Errorf("webhook URL is empty")
	}

	startTime := time.Now()
	deliveryID := generateDeliveryID()

	// Serialize payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshaling payload: %w", err)
	}

	// Configure exponential backoff
	expBackoff := backoff.NewExponentialBackOff()
	expBackoff.InitialInterval = 1 * time.Second
	expBackoff.MaxInterval = 16 * time.Second
	expBackoff.MaxElapsedTime = 60 * time.Second // Total max time for all retries

	// Add randomization (jitter) to prevent thundering herd
	expBackoff.RandomizationFactor = 0.5

	// Limit number of retries
	backoffWithRetry := backoff.WithMaxRetries(expBackoff, c.maxRetries)

	attempts := 0
	var lastErr error

	// Retry operation
	operation := func() error {
		attempts++

		// Create request
		req, err := http.NewRequest("POST", webhookURL, bytes.NewBuffer(jsonData))
		if err != nil {
			return backoff.Permanent(fmt.Errorf("creating request: %w", err))
		}

		// Set headers
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "UG-Scraper-Webhook/1.0")
		req.Header.Set("X-Delivery-ID", deliveryID)
		req.Header.Set("X-Attempt", fmt.Sprintf("%d", attempts))

		// Create context with timeout
		ctx, cancel := context.WithTimeout(context.Background(), c.timeout)
		defer cancel()
		req = req.WithContext(ctx)

		// Make request
		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("attempt %d failed: %w", attempts, err)
			return lastErr
		}
		defer resp.Body.Close()

		// Read response body for debugging
		body, _ := io.ReadAll(resp.Body)

		// Check status code
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			lastErr = fmt.Errorf("attempt %d: webhook returned status %d: %s", attempts, resp.StatusCode, string(body))
			return lastErr
		}

		// Success
		return nil
	}

	// Execute with retry
	err = backoff.Retry(operation, backoffWithRetry)

	duration := time.Since(startTime)

	result := &DeliveryResult{
		Success:    err == nil,
		DeliveryID: deliveryID,
		Attempts:   attempts,
		Duration:   duration.String(),
		Timestamp:  time.Now(),
	}

	if err != nil {
		result.Error = err.Error()
		return result, err
	}

	return result, nil
}

// Send makes a single webhook delivery attempt without retry
func (c *Client) Send(webhookURL string, payload *WebhookPayload) error {
	if webhookURL == "" {
		return fmt.Errorf("webhook URL is empty")
	}

	// Serialize payload
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshaling payload: %w", err)
	}

	// Create request
	req, err := http.NewRequest("POST", webhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "UG-Scraper-Webhook/1.0")

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), c.timeout)
	defer cancel()
	req = req.WithContext(ctx)

	// Make request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Check status
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("webhook returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// generateDeliveryID creates a unique delivery ID for tracking
func generateDeliveryID() string {
	return fmt.Sprintf("delivery_%d", time.Now().UnixNano())
}

// TestWebhook sends a test payload to verify the webhook URL
func (c *Client) TestWebhook(webhookURL string) error {
	testPayload := &WebhookPayload{
		Title:        "Test Song",
		Artist:       "Test Artist",
		Key:          "C",
		OnSongFormat: "{title: Test Song}\n{artist: Test Artist}\n{key: C}\n\nThis is a test webhook payload.",
		Timestamp:    time.Now(),
		Source:       "UG-Scraper Test",
	}

	return c.Send(webhookURL, testPayload)
}
