package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Init database
	dbPath := getEnv("DATABASE_URL", "./data/app.db")
	if err := InitDB(dbPath); err != nil {
		log.Fatal("Failed to init database:", err)
	}

	// Setup router
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
	workDir, _ := os.Getwd()
	filesDir := http.Dir(workDir + "/uploads")
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(filesDir)))

	port := getEnv("PORT", "3000")
	log.Printf("🚀 Server running on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

// Auth handlers
func handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request"}`, http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		http.Error(w, `{"error":"All fields required"}`, http.StatusBadRequest)
		return
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	user, err := CreateUser(req.Username, req.Email, string(hash))
	if err != nil {
		http.Error(w, `{"error":"Username or email already taken"}`, http.StatusBadRequest)
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": user.ID,
		"exp":    time.Now().Add(7 * 24 * time.Hour).Unix(),
	})
	tokenString, _ := token.SignedString(jwtSecret)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": tokenString,
		"user":  user,
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request"}`, http.StatusBadRequest)
		return
	}

	user, err := GetUserByEmail(req.Email)
	if err != nil {
		http.Error(w, `{"error":"Invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		http.Error(w, `{"error":"Invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": user.ID,
		"exp":    time.Now().Add(7 * 24 * time.Hour).Unix(),
	})
	tokenString, _ := token.SignedString(jwtSecret)

	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": tokenString,
		"user":  user,
	})
}

// Post handlers
func handleGetFeed(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(UserIDKey).(int)
	posts, err := GetFeedPosts(userID)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch feed"}`, http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(posts)
}

func handleCreatePost(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(UserIDKey).(int)

	const maxUploadSize = 10 << 20
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize+(1<<20))
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		http.Error(w, `{"error":"Photo must be 10 MB or smaller"}`, http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		http.Error(w, `{"error":"Photo is required"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	header := make([]byte, 512)
	n, readErr := io.ReadFull(file, header)
	if readErr != nil && readErr != io.ErrUnexpectedEOF {
		http.Error(w, `{"error":"Could not read photo"}`, http.StatusBadRequest)
		return
	}
	header = header[:n]

	extensions := map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/webp": ".webp",
	}
	ext, ok := extensions[http.DetectContentType(header)]
	if !ok {
		http.Error(w, `{"error":"Use a JPEG, PNG, or WebP photo"}`, http.StatusBadRequest)
		return
	}

	if err := os.MkdirAll("uploads", 0o755); err != nil {
		http.Error(w, `{"error":"Could not prepare uploads"}`, http.StatusInternalServerError)
		return
	}

	randomBytes := make([]byte, 12)
	if _, err := rand.Read(randomBytes); err != nil {
		http.Error(w, `{"error":"Could not prepare photo"}`, http.StatusInternalServerError)
		return
	}
	filename := fmt.Sprintf("%d-%s%s", userID, hex.EncodeToString(randomBytes), ext)
	destinationPath := filepath.Join("uploads", filename)
	destination, err := os.OpenFile(destinationPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		http.Error(w, `{"error":"Could not save photo"}`, http.StatusInternalServerError)
		return
	}

	remainingLimit := maxUploadSize - int64(len(header))
	copied := int64(0)
	if _, err = destination.Write(header); err == nil {
		copied, err = io.Copy(destination, io.LimitReader(file, remainingLimit+1))
	}
	closeErr := destination.Close()
	if copied > remainingLimit {
		_ = os.Remove(destinationPath)
		http.Error(w, `{"error":"Photo must be 10 MB or smaller"}`, http.StatusBadRequest)
		return
	}
	if err != nil || closeErr != nil {
		_ = os.Remove(destinationPath)
		http.Error(w, `{"error":"Could not save photo"}`, http.StatusInternalServerError)
		return
	}

	post, err := CreatePost("/uploads/"+filename, r.FormValue("caption"), userID)
	if err != nil {
		_ = os.Remove(destinationPath)
		http.Error(w, `{"error":"Failed to create post"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(post)
}

func handleToggleLike(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(UserIDKey).(int)
	postID, _ := strconv.Atoi(chi.URLParam(r, "id"))

	liked, err := ToggleLike(userID, postID)
	if err != nil {
		http.Error(w, `{"error":"Failed to toggle like"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]bool{"liked": liked})
}

// Bump handlers
func handleCreateBump(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(UserIDKey).(int)

	var req struct {
		OtherUserID int    `json:"otherUserId"`
		Method      string `json:"method"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request"}`, http.StatusBadRequest)
		return
	}

	if userID == req.OtherUserID {
		http.Error(w, `{"error":"Cannot bump yourself"}`, http.StatusBadRequest)
		return
	}

	if req.Method == "" {
		req.Method = "manual"
	}

	if err := CreateBump(userID, req.OtherUserID, req.Method); err != nil {
		http.Error(w, `{"error":"Failed to create bump"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"method":  req.Method,
	})
}

func handleGetMyBumps(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(UserIDKey).(int)
	users, err := GetUserBumps(userID)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch bumps"}`, http.StatusInternalServerError)
		return
	}

	response := make([]map[string]interface{}, len(users))
	for i, u := range users {
		response[i] = map[string]interface{}{
			"user":     u,
			"bumpedAt": time.Now().Unix(), // Mock for now
		}
	}

	json.NewEncoder(w).Encode(response)
}

func handleDeleteBump(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(UserIDKey).(int)
	otherUserID, _ := strconv.Atoi(chi.URLParam(r, "userId"))

	if err := DeleteBump(userID, otherUserID); err != nil {
		http.Error(w, `{"error":"Failed to delete bump"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func handleToggleBump(w http.ResponseWriter, r *http.Request) {
	myID := r.Context().Value(UserIDKey).(int)
	otherID, _ := strconv.Atoi(chi.URLParam(r, "id"))

	if myID == otherID {
		http.Error(w, `{"error":"Cannot bump yourself"}`, http.StatusBadRequest)
		return
	}

	bumpStatus, err := ToggleBump(myID, otherID)
	if err != nil {
		http.Error(w, `{"error":"Failed to toggle bump"}`, http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{"bumpStatus": bumpStatus})
}

// User handlers
func handleGetUser(w http.ResponseWriter, r *http.Request) {
	targetID, _ := strconv.Atoi(chi.URLParam(r, "id"))
	requestingID := r.Context().Value(UserIDKey).(int)

	profile, err := GetUserProfile(targetID, requestingID)
	if err != nil {
		http.Error(w, `{"error":"User not found"}`, http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(profile)
}
