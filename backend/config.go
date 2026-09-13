package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config contains process settings; loading it never starts the server.
type Config struct {
	Port         string
	DatabasePath string
	JWTSecret    string
	SeedDemoData bool
}

func loadConfig() (Config, error) {
	cfg := Config{
		Port:         getEnv("PORT", "3000"),
		DatabasePath: getEnv("DATABASE_URL", "./data/app.db"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
	}
	port, err := strconv.Atoi(cfg.Port)
	if err != nil || port < 1 || port > 65535 {
		return Config{}, fmt.Errorf("PORT must be between 1 and 65535")
	}
	if len(strings.TrimSpace(cfg.JWTSecret)) < 32 {
		return Config{}, fmt.Errorf("JWT_SECRET must contain at least 32 characters")
	}
	cfg.SeedDemoData, err = strconv.ParseBool(getEnv("SEED_DEMO_DATA", "false"))
	if err != nil {
		return Config{}, fmt.Errorf("SEED_DEMO_DATA must be true or false")
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
