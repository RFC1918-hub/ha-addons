package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/api"
	"github.com/ultimate-guitar-scrapper/ug-scraper/internal/middleware"
)

//go:embed frontend/dist
var embedFrontend embed.FS

func main() {
	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Ultimate Guitar Scraper v1.0.0",
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	// Middleware
	app.Use(middleware.Logger())
	app.Use(middleware.CORS())

	// Serve embedded frontend first (before API routes so /assets works)
	if _, err := fs.Stat(embedFrontend, "frontend/dist/index.html"); err == nil {
		// Frontend is embedded, serve it
		frontendFS, err := fs.Sub(embedFrontend, "frontend/dist")
		if err != nil {
			log.Fatal(err)
		}

		// Serve static assets (must be before SPA fallback)
		app.Use("/assets", filesystem.New(filesystem.Config{
			Root:       http.FS(frontendFS),
			PathPrefix: "assets",
			Browse:     false,
		}))

		// Serve vite.svg and other root assets
		app.Get("/vite.svg", func(c *fiber.Ctx) error {
			data, err := fs.ReadFile(frontendFS, "vite.svg")
			if err != nil {
				return c.SendStatus(404)
			}
			c.Type("svg")
			return c.Send(data)
		})
	} else {
		// Frontend not embedded (development mode)
		log.Println("Frontend not embedded - serve separately with npm run dev")
	}

	// Setup API routes
	api.SetupRoutes(app)

	// SPA fallback - must be LAST (after API and assets)
	if _, err := fs.Stat(embedFrontend, "frontend/dist/index.html"); err == nil {
		frontendFS, _ := fs.Sub(embedFrontend, "frontend/dist")

		// Serve index.html for all other routes (SPA fallback)
		app.Use("*", func(c *fiber.Ctx) error {
			// Serve index.html for all remaining routes
			indexHTML, err := fs.ReadFile(frontendFS, "index.html")
			if err != nil {
				return err
			}
			c.Type("html")
			return c.Send(indexHTML)
		})
	}

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Start server
	log.Printf("🚀 Server starting on port %s\n", port)
	if err := app.Listen(fmt.Sprintf(":%s", port)); err != nil {
		log.Fatal(err)
	}
}
