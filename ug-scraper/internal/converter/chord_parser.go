package converter

import (
	"regexp"
	"sort"
	"strings"
)

// ChordParser handles chord extraction and analysis
type ChordParser struct {
	chordRegex *regexp.Regexp
}

// NewChordParser creates a new chord parser
func NewChordParser() *ChordParser {
	// Regex to match chords in [Ch] format
	return &ChordParser{
		chordRegex: regexp.MustCompile(`\[ch\]([A-G][#b]?(?:maj|min|m|sus|aug|dim|add|[0-9])*)\[/ch\]`),
	}
}

// ExtractChords finds all chords in the tab content
func (p *ChordParser) ExtractChords(content string) []string {
	matches := p.chordRegex.FindAllStringSubmatch(content, -1)

	chords := make([]string, 0, len(matches))
	for _, match := range matches {
		if len(match) > 1 {
			chords = append(chords, match[1])
		}
	}

	return chords
}

// DetectKey analyzes chord occurrences to detect the likely key
func (p *ChordParser) DetectKey(chords []string) string {
	if len(chords) == 0 {
		return ""
	}

	// Count root note occurrences
	rootCounts := make(map[string]int)
	for _, chord := range chords {
		root := extractRootNote(chord)
		if root != "" {
			rootCounts[root]++
		}
	}

	// Find the most common root note
	var mostCommon string
	maxCount := 0
	for root, count := range rootCounts {
		if count > maxCount {
			maxCount = count
			mostCommon = root
		}
	}

	// Analyze chord quality to determine major/minor
	quality := analyzeChordQuality(chords, mostCommon)

	if quality == "minor" && mostCommon != "" {
		return mostCommon + "m"
	}

	return mostCommon
}

// extractRootNote gets the root note from a chord (e.g., "Am7" -> "A")
func extractRootNote(chord string) string {
	if len(chord) == 0 {
		return ""
	}

	root := string(chord[0])

	// Handle sharps and flats
	if len(chord) > 1 && (chord[1] == '#' || chord[1] == 'b') {
		root += string(chord[1])
	}

	// Validate root note
	validRoots := map[string]bool{
		"A": true, "A#": true, "Ab": true,
		"B": true, "Bb": true,
		"C": true, "C#": true,
		"D": true, "D#": true, "Db": true,
		"E": true, "Eb": true,
		"F": true, "F#": true,
		"G": true, "G#": true, "Gb": true,
	}

	if validRoots[root] {
		return root
	}

	return ""
}

// analyzeChordQuality determines if the key is likely major or minor
func analyzeChordQuality(chords []string, rootNote string) string {
	if rootNote == "" {
		return "major"
	}

	majorCount := 0
	minorCount := 0

	for _, chord := range chords {
		root := extractRootNote(chord)
		if root != rootNote {
			continue
		}

		chordLower := strings.ToLower(chord)

		// Check if chord is minor
		if strings.Contains(chordLower, "m") && !strings.Contains(chordLower, "maj") {
			minorCount++
		} else {
			majorCount++
		}
	}

	if minorCount > majorCount {
		return "minor"
	}

	return "major"
}

// NormalizeChordName converts chord names to a standard format
func NormalizeChordName(chord string) string {
	// Remove [ch] tags if present
	chord = strings.ReplaceAll(chord, "[ch]", "")
	chord = strings.ReplaceAll(chord, "[/ch]", "")

	return strings.TrimSpace(chord)
}

// ChordStats holds statistics about chords in a tab
type ChordStats struct {
	TotalChords  int
	UniqueChords int
	MostCommon   string
	ChordCounts  map[string]int
}

// AnalyzeChordStats provides detailed statistics about chords
func (p *ChordParser) AnalyzeChordStats(chords []string) ChordStats {
	stats := ChordStats{
		TotalChords: len(chords),
		ChordCounts: make(map[string]int),
	}

	for _, chord := range chords {
		stats.ChordCounts[chord]++
	}

	stats.UniqueChords = len(stats.ChordCounts)

	// Find most common chord
	maxCount := 0
	for chord, count := range stats.ChordCounts {
		if count > maxCount {
			maxCount = count
			stats.MostCommon = chord
		}
	}

	return stats
}

// GetChordProgression attempts to identify common chord progressions
func (p *ChordParser) GetChordProgression(chords []string) []string {
	if len(chords) == 0 {
		return nil
	}

	// Get unique chords in order of appearance
	seen := make(map[string]bool)
	var progression []string

	for _, chord := range chords {
		if !seen[chord] {
			seen[chord] = true
			progression = append(progression, chord)
		}
	}

	return progression
}

// ChordFrequency represents a chord and its frequency
type ChordFrequency struct {
	Chord string
	Count int
}

// GetChordFrequencies returns chords sorted by frequency
func (p *ChordParser) GetChordFrequencies(chords []string) []ChordFrequency {
	counts := make(map[string]int)
	for _, chord := range chords {
		counts[chord]++
	}

	frequencies := make([]ChordFrequency, 0, len(counts))
	for chord, count := range counts {
		frequencies = append(frequencies, ChordFrequency{
			Chord: chord,
			Count: count,
		})
	}

	// Sort by count descending
	sort.Slice(frequencies, func(i, j int) bool {
		return frequencies[i].Count > frequencies[j].Count
	})

	return frequencies
}
