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
