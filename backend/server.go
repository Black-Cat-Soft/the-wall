package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// run owns startup and shutdown. Handlers keep their existing API contract.
func run(ctx context.Context) error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}
	if err := os.MkdirAll("uploads", 0o750); err != nil {
		return fmt.Errorf("prepare uploads: %w", err)
	}
	if err := InitDB(cfg.DatabasePath, cfg.SeedDemoData); err != nil {
		return fmt.Errorf("initialize database: %w", err)
	}
	defer DB.Close()
	jwtSecret = []byte(cfg.JWTSecret)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           newRouter(DB),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- server.ListenAndServe() }()
	log.Printf("API listening on port %s", cfg.Port)
	select {
	case err := <-serverErrors:
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			_ = server.Close()
			return fmt.Errorf("shutdown: %w", err)
		}
		if err := <-serverErrors; !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}

func newRouter(db *sql.DB) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	// Public routes
	r.Get("/healthz", healthHandler(db))
	r.Post("/auth/register", handleRegister)
	r.Post("/auth/login", handleLogin)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(AuthMiddleware)

		// Posts
		r.Get("/posts/feed", handleGetFeed)
		r.Post("/posts", handleCreatePost)
		r.Post("/posts/{id}/like", handleToggleLike)

		// Bumps
		r.Post("/bumps", handleCreateBump)
		r.Get("/bumps/my-bumps", handleGetMyBumps)
		r.Delete("/bumps/{userId}", handleDeleteBump)

		// Users
		r.Get("/users/{id}", handleGetUser)
		r.Post("/users/{id}/bump", handleToggleBump)
	})

	// Static files (uploads)
	filesDir := http.Dir("uploads")
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(filesDir)))

	return r
}

// The health check verifies database readiness without revealing user data.
func healthHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			http.Error(w, "unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}
}
