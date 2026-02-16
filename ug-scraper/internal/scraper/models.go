package scraper

import "time"

// SearchResult represents a single tab search result
type SearchResult struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Artist     string  `json:"artist"`
	Type       string  `json:"type"`
	Rating     float64 `json:"rating"`
	Votes      int     `json:"votes"`
	Difficulty string  `json:"difficulty,omitempty"`
	URL        string  `json:"url"`
}

// TabResult represents the complete tab data from UG API
type TabResult struct {
	TabID         int       `json:"tab_id"`
	SongName      string    `json:"song_name"`
	ArtistName    string    `json:"artist_name"`
	Type          string    `json:"type"`
	Part          string    `json:"part"`
	Version       int       `json:"version"`
	Votes         int       `json:"votes"`
	Rating        float64   `json:"rating"`
	Date          time.Time `json:"date"`
	Status        string    `json:"status"`
	TonalityName  string    `json:"tonality_name"`
	Verified      int       `json:"verified"`
	Capo          int       `json:"capo"`
	Tuning        string    `json:"tuning"`
	Difficulty    string    `json:"difficulty"`
	Content       string    `json:"content"`
	URLWeb        string    `json:"urlWeb"`
	Contributor   struct {
		UserID   int    `json:"user_id"`
		Username string `json:"username"`
	} `json:"contributor"`
}

// UGAPIResponse wraps the Ultimate Guitar API response
type UGAPIResponse struct {
	TabID         int       `json:"id"`
	SongName      string    `json:"song_name"`
	ArtistName    string    `json:"artist_name"`
	Type          string    `json:"type"`
	Part          string    `json:"part"`
	Version       int       `json:"version"`
	Votes         int       `json:"votes"`
	Rating        float64   `json:"rating"`
	Date          string    `json:"date"`
	Status        string    `json:"status"`
	TonalityName  string    `json:"tonality_name"`
	Verified      int       `json:"verified"`
	Capo          int       `json:"capo"`
	Tuning        string    `json:"tuning"`
	Difficulty    string    `json:"difficulty"`
	Content       string    `json:"content"`
	URLWeb        string    `json:"urlWeb"`
	Contributor   struct {
		UserID   int    `json:"user_id"`
		Username string `json:"username"`
	} `json:"contributor"`
}
