-- Users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    avatar TEXT,
    bio TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Posts
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_url TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    author_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);

-- Bumps (mutual connections)
CREATE TABLE IF NOT EXISTS bumps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    bumped_at INTEGER NOT NULL DEFAULT (unixepoch()),
    bumped_via TEXT NOT NULL DEFAULT 'manual',
    location TEXT,
    device_info TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_bumps_user1 ON bumps(user1_id);
CREATE INDEX IF NOT EXISTS idx_bumps_user2 ON bumps(user2_id);

-- Likes
CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);

-- Seed data (password for all users: password123)
INSERT OR IGNORE INTO users (username, email, password, bio) VALUES
    ('alice', 'alice@stray.dev', '$2a$10$is0IXLun2KxH5mWRGuYiae22zHsSXbrDbPxRWYM4HYarQ3o11xVtu', 'Hey! I use Stray 👋'),
    ('bob', 'bob@stray.dev', '$2a$10$is0IXLun2KxH5mWRGuYiae22zHsSXbrDbPxRWYM4HYarQ3o11xVtu', 'Just vibing 🤙'),
    ('charlie', 'charlie@stray.dev', '$2a$10$is0IXLun2KxH5mWRGuYiae22zHsSXbrDbPxRWYM4HYarQ3o11xVtu', 'New here 🌟');

-- Seed bumps (alice and bob are already connected)
INSERT OR IGNORE INTO bumps (user1_id, user2_id, bumped_via) VALUES
    (1, 2, 'manual');

-- Seed posts (one per user)
INSERT OR IGNORE INTO posts (author_id, image_url, caption) VALUES
    (1, 'https://picsum.photos/800/600?random=1', 'First post on Stray! 🎉'),
    (2, 'https://picsum.photos/800/600?random=2', 'Testing this out'),
    (3, 'https://picsum.photos/800/600?random=3', 'Hello world 👋');
