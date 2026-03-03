package handlers

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
)

const onsongCloudURL = "https://onsongapp.com/drive/files/~/"

// OnSongCloudHandler handles uploads to OnSong Cloud Drive
type OnSongCloudHandler struct {
	token string
}

// NewOnSongCloudHandler creates a new OnSong Cloud handler using the ONSONG_TOKEN env var
func NewOnSongCloudHandler() *OnSongCloudHandler {
	return &OnSongCloudHandler{
		token: os.Getenv("ONSONG_TOKEN"),
	}
}

// GetConfig returns whether the OnSong Cloud token is configured
func (h *OnSongCloudHandler) GetConfig(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"configured": h.token != "",
	})
}

// Send uploads a tab as a .txt file to OnSong Cloud Drive
func (h *OnSongCloudHandler) Send(c *fiber.Ctx) error {
	if h.token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "OnSong Cloud token not configured",
		})
	}

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

	if req.Title == "" || req.Content == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "title and content are required",
		})
	}

	filename := fmt.Sprintf("%s - %s.txt", req.Title, req.Artist)
	fmt.Printf("\n☁️ Uploading to OnSong Cloud: %s\n", filename)

	// Build multipart body
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	// Create form file part with explicit content-type
	partHeader := make(textproto.MIMEHeader)
	partHeader.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file[0]"; filename="%s"`, filename))
	partHeader.Set("Content-Type", "text/plain")

	part, err := writer.CreatePart(partHeader)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to create multipart form",
			"details": err.Error(),
		})
	}

	if _, err := io.WriteString(part, req.Content); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to write content",
			"details": err.Error(),
		})
	}
	writer.Close()

	httpReq, err := http.NewRequest("POST", onsongCloudURL, &body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "failed to create request",
			"details": err.Error(),
		})
	}

	httpReq.Header.Set("Authorization", h.token)
	httpReq.Header.Set("Content-Type", writer.FormDataContentType())
	httpReq.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		fmt.Printf("❌ OnSong Cloud upload failed: %v\n\n", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "upload failed",
			"details": err.Error(),
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ OnSong Cloud upload failed: status=%d body=%s\n\n", resp.StatusCode, string(bodyBytes))
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error":   "OnSong Cloud returned an error",
			"status":  resp.StatusCode,
			"details": string(bodyBytes),
		})
	}

	fmt.Printf("✅ OnSong Cloud upload successful: %s\n\n", filename)
	return c.JSON(fiber.Map{
		"success":  true,
		"filename": filename,
	})
}
