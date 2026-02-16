package converter

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/scraper"
)

// OnSongConverter converts Ultimate Guitar tabs to OnSong/ChordPro format
type OnSongConverter struct {
	parser *ChordParser
}

// NewOnSongConverter creates a new OnSong converter
func NewOnSongConverter() *OnSongConverter {
	return &OnSongConverter{
		parser: NewChordParser(),
	}
}

// ConversionResult holds the converted tab and metadata
type ConversionResult struct {
	OnSongFormat string
	DetectedKey  string
	ChordCount   int
	Chords       []string
}

// Convert transforms a TabResult into OnSong/ChordPro format
func (c *OnSongConverter) Convert(tab *scraper.TabResult) (*ConversionResult, error) {
	if tab == nil {
		return nil, fmt.Errorf("tab cannot be nil")
	}

	// Extract chords from content
	chords := c.parser.ExtractChords(tab.Content)

	// Detect key if not provided
	detectedKey := tab.TonalityName
	if detectedKey == "" || detectedKey == "undefined" {
		detectedKey = c.parser.DetectKey(chords)
	}
	if detectedKey == "" {
		detectedKey = "Unknown"
	}

	// Convert the content
	formattedContent := c.formatContent(tab.Content)

	// Build OnSong format
	output := strings.Builder{}

	// Header: plain text title block (OnSong format)
	output.WriteString(fmt.Sprintf("%s\n", tab.SongName))
	output.WriteString(fmt.Sprintf("%s\n", tab.ArtistName))

	if detectedKey != "" && detectedKey != "Unknown" {
		output.WriteString(fmt.Sprintf("Key: %s\n", detectedKey))
	}

	if tab.Capo > 0 {
		output.WriteString(fmt.Sprintf("Capo: %d\n", tab.Capo))
	}

	if tab.Tuning != "" && tab.Tuning != "E A D G B E" {
		output.WriteString(fmt.Sprintf("Tuning: %s\n", tab.Tuning))
	}

	output.WriteString("\n")

	// Add the formatted tab content
	output.WriteString(formattedContent)

	// Add footer
	output.WriteString("\n\n")
	output.WriteString(fmt.Sprintf("# Source: Ultimate Guitar (Tab ID: %d)\n", tab.TabID))
	output.WriteString(fmt.Sprintf("# Contributor: %s\n", tab.Contributor.Username))
	output.WriteString(fmt.Sprintf("# Rating: %.1f/5.0 (%d votes)\n", tab.Rating, tab.Votes))

	return &ConversionResult{
		OnSongFormat: output.String(),
		DetectedKey:  detectedKey,
		ChordCount:   len(chords),
		Chords:       c.getUniqueChords(chords),
	}, nil
}

// formatContent converts Ultimate Guitar format to OnSong/ChordPro format
func (c *OnSongConverter) formatContent(content string) string {
	// Remove [tab] tags
	content = strings.ReplaceAll(content, "[tab]", "")
	content = strings.ReplaceAll(content, "[/tab]", "")

	// Check if content has [ch] tags (UG format) or plain chords
	hasChTags := strings.Contains(content, "[ch]")

	if hasChTags {
		// Convert [ch]chord[/ch] to [chord] for inline chords
		content = regexp.MustCompile(`\[ch\]`).ReplaceAllString(content, "[")
		content = regexp.MustCompile(`\[/ch\]`).ReplaceAllString(content, "]")
	}

	// Convert section headers from [Section Name] to "Section Name:"
	// Match common section names
	sectionPattern := regexp.MustCompile(`(?mi)^\[(Intro|Verse\s*\d*|Chorus\s*\d*|Pre-Chorus|Bridge|Instrumental|Interlude|Turnaround|Outro|Tag|Ending|Solo|Break|Refrain|Coda|Hook|Vamp|Outro Chorus)\]\s*$`)
	content = sectionPattern.ReplaceAllString(content, "$1:")

	// If no [ch] tags were present, detect plain chord lines and wrap them
	if !hasChTags {
		content = c.wrapPlainChordLines(content)
	}

	// Handle bracketed lyrics/chords that aren't section headers
	// This preserves [chord] but removes other brackets
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		// If line has chords in brackets, preserve them
		if !strings.Contains(line, "[") || strings.HasSuffix(strings.TrimSpace(line), ":") {
			continue
		}

		// Convert any remaining [text] that looks like chord positions
		// This is a simplified approach - OnSong uses inline chords
		lines[i] = line
	}
	content = strings.Join(lines, "\n")

	// Clean up multiple blank lines
	content = regexp.MustCompile(`\n{3,}`).ReplaceAllString(content, "\n\n")

	// Trim leading/trailing whitespace
	content = strings.TrimSpace(content)

	return content
}

// chordLineRegex matches a single chord token (e.g. G, Am, F#m7, Bb, Dsus4, C/G)
var chordTokenRegex = regexp.MustCompile(`^[A-G][#b]?(?:maj|min|m|M|sus[24]?|aug|dim|add|no)?[0-9]*(?:/[A-G][#b]?)?$`)

// wrapPlainChordLines detects lines that consist only of chord names and
// wraps each chord in [] brackets for OnSong format
func (c *OnSongConverter) wrapPlainChordLines(content string) string {
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasSuffix(trimmed, ":") {
			continue
		}

		// Split on whitespace and check if all tokens are chords
		tokens := strings.Fields(trimmed)
		if len(tokens) == 0 {
			continue
		}

		allChords := true
		for _, t := range tokens {
			if !chordTokenRegex.MatchString(t) {
				allChords = false
				break
			}
		}

		if allChords {
			// Wrap each chord in brackets, preserving original spacing
			result := line
			for _, t := range tokens {
				// Replace first occurrence of the bare chord with [chord]
				result = strings.Replace(result, t, "["+t+"]", 1)
			}
			lines[i] = result
		}
	}
	return strings.Join(lines, "\n")
}

// getUniqueChords returns a deduplicated list of chords
func (c *OnSongConverter) getUniqueChords(chords []string) []string {
	seen := make(map[string]bool)
	unique := []string{}

	for _, chord := range chords {
		normalized := NormalizeChordName(chord)
		if !seen[normalized] && normalized != "" {
			seen[normalized] = true
			unique = append(unique, normalized)
		}
	}

	return unique
}

// ConvertToPlainText creates a simple text version without ChordPro tags
func (c *OnSongConverter) ConvertToPlainText(tab *scraper.TabResult) string {
	output := strings.Builder{}

	output.WriteString(fmt.Sprintf("%s - %s\n", tab.SongName, tab.ArtistName))
	output.WriteString(strings.Repeat("=", len(tab.SongName)+len(tab.ArtistName)+3))
	output.WriteString("\n\n")

	if tab.TonalityName != "" {
		output.WriteString(fmt.Sprintf("Key: %s", tab.TonalityName))
		if tab.Capo > 0 {
			output.WriteString(fmt.Sprintf(" (Capo: %d)", tab.Capo))
		}
		output.WriteString("\n\n")
	}

	output.WriteString(c.formatContent(tab.Content))

	return output.String()
}

// ValidateTab checks if a tab has the minimum required data for conversion
func (c *OnSongConverter) ValidateTab(tab *scraper.TabResult) error {
	if tab.SongName == "" {
		return fmt.Errorf("song name is required")
	}

	if tab.ArtistName == "" {
		return fmt.Errorf("artist name is required")
	}

	if tab.Content == "" {
		return fmt.Errorf("tab content is empty")
	}

	return nil
}

// FormatManualContent formats manually entered content into OnSong format
func (c *OnSongConverter) FormatManualContent(title, artist, content string) string {
	output := strings.Builder{}

	// Header: plain text title block
	output.WriteString(title + "\n")
	output.WriteString(artist + "\n")

	// Detect key from content if possible
	// First try [ch] tag extraction, then plain text chord detection
	chords := c.parser.ExtractChords(content)
	if len(chords) == 0 {
		chords = c.extractPlainChords(content)
	}
	if len(chords) > 0 {
		detectedKey := c.parser.DetectKey(chords)
		if detectedKey != "" {
			output.WriteString("Key: " + detectedKey + "\n")
		}
	}

	output.WriteString("\n")

	// Format the content using the same logic as scraped tabs
	if content != "" {
		formatted := c.formatContent(content)
		output.WriteString(formatted)
	}

	return output.String()
}

// extractPlainChords scans plain text for chord-only lines and returns chord names
func (c *OnSongConverter) extractPlainChords(content string) []string {
	var chords []string
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasSuffix(trimmed, ":") {
			continue
		}
		tokens := strings.Fields(trimmed)
		if len(tokens) == 0 {
			continue
		}
		allChords := true
		for _, t := range tokens {
			if !chordTokenRegex.MatchString(t) {
				allChords = false
				break
			}
		}
		if allChords {
			chords = append(chords, tokens...)
		}
	}
	return chords
}
