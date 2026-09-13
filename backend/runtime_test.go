package main

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestConfigRejectsUnsafeStartup(t *testing.T) {
	t.Setenv("PORT", "3000")
	t.Setenv("SEED_DEMO_DATA", "false")
	for _, secret := range []string{"", "dev_secret_change_in_prod", strings.Repeat(" ", 32)} {
		t.Setenv("JWT_SECRET", secret)
		if _, err := loadConfig(); err == nil {
			t.Fatal("accepted a missing or weak secret")
		}
	}
	t.Setenv("JWT_SECRET", strings.Repeat("test-only", 8))
	t.Setenv("PORT", "65536")
	if _, err := loadConfig(); err == nil {
		t.Fatal("accepted an invalid port")
	}
	t.Setenv("PORT", "3000")
	t.Setenv("SEED_DEMO_DATA", "maybe")
	if _, err := loadConfig(); err == nil {
		t.Fatal("accepted an invalid seed setting")
	}
}

func TestDatabasePersistsWithoutDemoUsers(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "app.db")
	if err := InitDB(path, false); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil || count != 0 {
		t.Fatalf("expected an empty database: count=%d err=%v", count, err)
	}
	if _, err := CreateUser("persistent", "test@example.invalid", "test-hash"); err != nil {
		t.Fatal(err)
	}
	if err := DB.Close(); err != nil {
		t.Fatal(err)
	}
	if err := InitDB(path, false); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = DB.Close() })
	if _, err := GetUserByEmail("test@example.invalid"); err != nil {
		t.Fatalf("user did not survive database reopen: %v", err)
	}
	router := newRouter(DB)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("healthy database returned %d", response.Code)
	}
	_ = DB.Close()
	response = httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("closed database returned %d", response.Code)
	}
}

func TestDemoSeedDoesNotDuplicateOnRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "app.db")
	for range 2 {
		if err := InitDB(path, true); err != nil {
			t.Fatal(err)
		}
		var posts int
		if err := DB.QueryRow("SELECT COUNT(*) FROM posts").Scan(&posts); err != nil || posts != 3 {
			t.Fatalf("expected three demo posts: count=%d err=%v", posts, err)
		}
		if err := DB.Close(); err != nil {
			t.Fatal(err)
		}
	}
}
