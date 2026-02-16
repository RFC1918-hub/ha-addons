package config

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// WebhookConfig holds webhook configuration
type WebhookConfig struct {
	URL       string    `json:"url"`
	Enabled   bool      `json:"enabled"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ConfigStore manages webhook configuration with thread-safe operations
type ConfigStore struct {
	mu         sync.RWMutex
	config     *WebhookConfig
	filePath   string
	persistent bool
}

// NewConfigStore creates a new configuration store
func NewConfigStore(filePath string) *ConfigStore {
	store := &ConfigStore{
		filePath:   filePath,
		persistent: filePath != "",
		config:     &WebhookConfig{},
	}

	// Try to load existing config from file
	if store.persistent {
		_ = store.loadFromFile()
	}

	return store
}

// Get retrieves the current webhook configuration
func (s *ConfigStore) Get() *WebhookConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Return a copy to prevent external modification
	if s.config == nil {
		return nil
	}

	configCopy := *s.config
	return &configCopy
}

// Save updates the webhook configuration
func (s *ConfigStore) Save(config *WebhookConfig) error {
	if config == nil {
		return fmt.Errorf("config cannot be nil")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Update timestamps
	if s.config.CreatedAt.IsZero() {
		config.CreatedAt = time.Now()
	} else {
		config.CreatedAt = s.config.CreatedAt
	}
	config.UpdatedAt = time.Now()

	s.config = config

	// Persist to file if configured
	if s.persistent {
		return s.persistToFile()
	}

	return nil
}

// IsConfigured checks if a webhook URL is configured
func (s *ConfigStore) IsConfigured() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.config != nil && s.config.URL != "" && s.config.Enabled
}

// GetURL returns the webhook URL if configured and enabled
func (s *ConfigStore) GetURL() string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.config != nil && s.config.Enabled {
		return s.config.URL
	}

	return ""
}

// Clear removes the webhook configuration
func (s *ConfigStore) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.config = &WebhookConfig{}

	// Remove file if it exists
	if s.persistent && s.filePath != "" {
		if err := os.Remove(s.filePath); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("removing config file: %w", err)
		}
	}

	return nil
}

// persistToFile saves configuration to JSON file
func (s *ConfigStore) persistToFile() error {
	if s.filePath == "" {
		return nil
	}

	// Create directory if it doesn't exist
	dir := s.filePath[:len(s.filePath)-len("/webhook-config.json")]
	if err := os.MkdirAll(dir, 0755); err != nil && !os.IsExist(err) {
		return fmt.Errorf("creating config directory: %w", err)
	}

	// Marshal to JSON
	data, err := json.MarshalIndent(s.config, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling config: %w", err)
	}

	// Write to file
	if err := os.WriteFile(s.filePath, data, 0644); err != nil {
		return fmt.Errorf("writing config file: %w", err)
	}

	return nil
}

// loadFromFile loads configuration from JSON file
func (s *ConfigStore) loadFromFile() error {
	if s.filePath == "" {
		return nil
	}

	// Check if file exists
	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return nil // File doesn't exist, not an error
	}

	// Read file
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return fmt.Errorf("reading config file: %w", err)
	}

	// Unmarshal JSON
	var config WebhookConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("unmarshaling config: %w", err)
	}

	s.config = &config

	return nil
}

// Validate checks if the configuration is valid
func (c *WebhookConfig) Validate() error {
	if c.URL == "" {
		return fmt.Errorf("webhook URL is required")
	}

	// Basic URL validation
	if len(c.URL) < 10 || (!startsWithHTTP(c.URL) && !startsWithHTTPS(c.URL)) {
		return fmt.Errorf("invalid webhook URL format")
	}

	return nil
}

// startsWithHTTP checks if string starts with http://
func startsWithHTTP(s string) bool {
	return len(s) >= 7 && s[:7] == "http://"
}

// startsWithHTTPS checks if string starts with https://
func startsWithHTTPS(s string) bool {
	return len(s) >= 8 && s[:8] == "https://"
}
