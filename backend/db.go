package main

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

// Models
type User struct {
	ID        int     `json:"id"`
	Username  string  `json:"username"`
	Email     string  `json:"email"`
	Password  string  `json:"-"`
	Avatar    *string `json:"avatar"`
	Bio       *string `json:"bio"`
	CreatedAt int64   `json:"createdAt"`
}

type Post struct {
	ID        int    `json:"id"`
	ImageURL  string `json:"imageUrl"`
	Caption   string `json:"caption"`
	AuthorID  int    `json:"authorId"`
	CreatedAt int64  `json:"createdAt"`
}

type PostWithAuthor struct {
	Post
	Author    User `json:"author"`
	LikeCount int  `json:"_count"`
	IsLiked   bool `json:"isLiked"`
}

type UserProfile struct {
	User
	Posts      []Post `json:"posts"`
	BumpCount  int    `json:"bumpCount"`
	BumpStatus string `json:"bumpStatus"`
}

type Bump struct {
	ID         int     `json:"id"`
	User1ID    int     `json:"user1Id"`
	User2ID    int     `json:"user2Id"`
	BumpedAt   int64   `json:"bumpedAt"`
	BumpedVia  string  `json:"bumpedVia"`
	Location   *string `json:"location"`
	DeviceInfo *string `json:"deviceInfo"`
	Active     bool    `json:"active"`
}

// Initialize database
func InitDB(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}

	DB.SetMaxOpenConns(1) // SQLite only supports 1 writer

	// Enable foreign keys
	if _, err := DB.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return err
	}

	// Run schema
	schema, err := os.ReadFile("schema.sql")
	if err != nil {
		return err
	}

	if _, err := DB.Exec(string(schema)); err != nil {
		return err
	}

	log.Println("✅ Database initialized")
	return nil
}

// User queries
func GetUserByEmail(email string) (*User, error) {
	user := &User{}
	err := DB.QueryRow(`
		SELECT id, username, email, password, avatar, bio, created_at
		FROM users WHERE email = ?
	`, email).Scan(&user.ID, &user.Username, &user.Email, &user.Password,
		&user.Avatar, &user.Bio, &user.CreatedAt)
	return user, err
}

func GetUserByID(id int) (*User, error) {
	user := &User{}
	err := DB.QueryRow(`
		SELECT id, username, email, password, avatar, bio, created_at
		FROM users WHERE id = ?
	`, id).Scan(&user.ID, &user.Username, &user.Email, &user.Password,
		&user.Avatar, &user.Bio, &user.CreatedAt)
	return user, err
}

func GetUserProfile(targetID, requestingID int) (*UserProfile, error) {
	user, err := GetUserByID(targetID)
	if err != nil {
		return nil, err
	}

	// Count active bumps for this user
	var bumpCount int
	err = DB.QueryRow(`
		SELECT COUNT(*) FROM bumps
		WHERE active = 1 AND (user1_id = ? OR user2_id = ?)
	`, targetID, targetID).Scan(&bumpCount)
	if err != nil {
		return nil, err
	}

	// Check if requesting user is bumped with target
	u1, u2 := requestingID, targetID
	if u1 > u2 {
		u1, u2 = u2, u1
	}
	var active bool
	err = DB.QueryRow(`
		SELECT active FROM bumps WHERE user1_id = ? AND user2_id = ?
	`, u1, u2).Scan(&active)
	bumpStatus := "none"
	if err == nil && active {
		bumpStatus = "bumped"
	}

	// Get user's posts
	rows, err := DB.Query(`
		SELECT id, image_url, caption, author_id, created_at
		FROM posts WHERE author_id = ? ORDER BY created_at DESC
	`, targetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := []Post{}
	for rows.Next() {
		var p Post
		if err := rows.Scan(&p.ID, &p.ImageURL, &p.Caption, &p.AuthorID, &p.CreatedAt); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}

	return &UserProfile{
		User:       *user,
		Posts:      posts,
		BumpCount:  bumpCount,
		BumpStatus: bumpStatus,
	}, nil
}

func CreateUser(username, email, passwordHash string) (*User, error) {
	result, err := DB.Exec(`
		INSERT INTO users (username, email, password)
		VALUES (?, ?, ?)
	`, username, email, passwordHash)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()
	return GetUserByID(int(id))
}

// Post queries
func GetFeedPosts(userID int) ([]PostWithAuthor, error) {
	rows, err := DB.Query(`
		SELECT 
			p.id, p.image_url, p.caption, p.author_id, p.created_at,
			u.id, u.username, u.email, u.avatar, u.bio, u.created_at,
			COUNT(DISTINCT l.user_id) as like_count,
			EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND post_id = p.id) as is_liked
		FROM posts p
		INNER JOIN users u ON p.author_id = u.id
		LEFT JOIN likes l ON p.id = l.post_id
		WHERE p.author_id IN (
			SELECT user2_id FROM bumps WHERE user1_id = ? AND active = 1
			UNION
			SELECT user1_id FROM bumps WHERE user2_id = ? AND active = 1
		) OR p.author_id = ?
		GROUP BY p.id
		ORDER BY p.created_at DESC
	`, userID, userID, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := []PostWithAuthor{}
	for rows.Next() {
		var p PostWithAuthor
		err := rows.Scan(
			&p.ID, &p.ImageURL, &p.Caption, &p.AuthorID, &p.CreatedAt,
			&p.Author.ID, &p.Author.Username, &p.Author.Email, &p.Author.Avatar,
			&p.Author.Bio, &p.Author.CreatedAt,
			&p.LikeCount, &p.IsLiked,
		)
		if err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, nil
}

func CreatePost(imageURL, caption string, authorID int) (*Post, error) {
	result, err := DB.Exec(`
		INSERT INTO posts (image_url, caption, author_id)
		VALUES (?, ?, ?)
	`, imageURL, caption, authorID)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()
	post := &Post{}
	err = DB.QueryRow(`
		SELECT id, image_url, caption, author_id, created_at
		FROM posts WHERE id = ?
	`, id).Scan(&post.ID, &post.ImageURL, &post.Caption, &post.AuthorID, &post.CreatedAt)
	return post, err
}

func ToggleLike(userID, postID int) (bool, error) {
	var exists bool
	err := DB.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?)
	`, userID, postID).Scan(&exists)
	if err != nil {
		return false, err
	}

	if exists {
		_, err = DB.Exec(`DELETE FROM likes WHERE user_id = ? AND post_id = ?`, userID, postID)
		return false, err
	}

	_, err = DB.Exec(`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`, userID, postID)
	return true, err
}

// Tap queries
func CreateBump(user1ID, user2ID int, method string) error {
	if user1ID > user2ID {
		user1ID, user2ID = user2ID, user1ID // Ensure user1_id < user2_id
	}

	_, err := DB.Exec(`
		INSERT INTO bumps (user1_id, user2_id, bumped_via, active)
		VALUES (?, ?, ?, 1)
		ON CONFLICT(user1_id, user2_id) DO UPDATE SET active = 1, bumped_at = unixepoch()
	`, user1ID, user2ID, method)
	return err
}

func GetUserBumps(userID int) ([]User, error) {
	rows, err := DB.Query(`
		SELECT u.id, u.username, u.email, u.avatar, u.bio, u.created_at
		FROM users u
		INNER JOIN bumps b ON (
			(b.user1_id = ? AND b.user2_id = u.id) OR
			(b.user2_id = ? AND b.user1_id = u.id)
		)
		WHERE b.active = 1
	`, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []User{}
	for rows.Next() {
		var u User
		err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.Avatar, &u.Bio, &u.CreatedAt)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func ToggleBump(myID, otherID int) (string, error) {
	u1, u2 := myID, otherID
	if u1 > u2 {
		u1, u2 = u2, u1
	}

	var active bool
	err := DB.QueryRow(`
		SELECT active FROM bumps WHERE user1_id = ? AND user2_id = ?
	`, u1, u2).Scan(&active)

	if err == sql.ErrNoRows {
		// No existing bump — create one
		_, err = DB.Exec(`
			INSERT INTO bumps (user1_id, user2_id, bumped_via, active)
			VALUES (?, ?, 'manual', 1)
		`, u1, u2)
		if err != nil {
			return "", err
		}
		return "bumped", nil
	}
	if err != nil {
		return "", err
	}

	if active {
		// Currently bumped — deactivate
		_, err = DB.Exec(`UPDATE bumps SET active = 0 WHERE user1_id = ? AND user2_id = ?`, u1, u2)
		return "none", err
	}

	// Previously un-bumped — reactivate
	_, err = DB.Exec(`
		UPDATE bumps SET active = 1, bumped_at = unixepoch() WHERE user1_id = ? AND user2_id = ?
	`, u1, u2)
	return "bumped", err
}

func DeleteBump(user1ID, user2ID int) error {
	if user1ID > user2ID {
		user1ID, user2ID = user2ID, user1ID
	}

	_, err := DB.Exec(`
		UPDATE bumps SET active = 0
		WHERE user1_id = ? AND user2_id = ?
	`, user1ID, user2ID)
	return err
}
