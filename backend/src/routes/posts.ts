import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/auth';
import db from '../db';
import { posts, taps, likes, users } from '../db/schema';
import { eq, and, or, inArray, desc, sql } from 'drizzle-orm';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'));
  },
});

// Create post
router.post('/', authenticate, upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Image required' });
    return;
  }
  const { caption } = req.body;
  const imageUrl = `/uploads/${req.file.filename}`;
  
  const [post] = await db.insert(posts).values({
    imageUrl,
    caption: caption || '',
    authorId: req.userId!,
  }).returning();

  // Get author info
  const [author] = await db.select({
    id: users.id,
    username: users.username,
    avatar: users.avatar,
  }).from(users).where(eq(users.id, post.authorId)).limit(1);

  // Get likes for this post
  const postLikes = await db.select({ userId: likes.userId })
    .from(likes)
    .where(eq(likes.postId, post.id));

  res.json({
    ...post,
    author,
    likes: postLikes,
    _count: { likes: postLikes.length },
  });
});

// Feed: posts from active taps + own
router.get('/feed', authenticate, async (req: Request, res: Response) => {
  const me = req.userId!;

  // Get all active taps
  const myTaps = await db
    .select({ user1Id: taps.user1Id, user2Id: taps.user2Id })
    .from(taps)
    .where(and(
      eq(taps.active, true),
      or(eq(taps.user1Id, me), eq(taps.user2Id, me))
    ));

  // Extract tapped user IDs
  const tappedIds = myTaps.map(t => t.user1Id === me ? t.user2Id : t.user1Id);
  const ids = [...tappedIds, me];

  if (ids.length === 0) {
    res.json([]);
    return;
  }

  // Get posts from tapped users
  const feedPosts = await db
    .select({
      id: posts.id,
      imageUrl: posts.imageUrl,
      caption: posts.caption,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      author: {
        id: users.id,
        username: users.username,
        avatar: users.avatar,
      },
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .where(inArray(posts.authorId, ids))
    .orderBy(desc(posts.createdAt))
    .limit(30);

  // Get likes for these posts
  const postIds = feedPosts.map(p => p.id);
  const allLikes = postIds.length > 0
    ? await db.select({ postId: likes.postId, userId: likes.userId })
        .from(likes)
        .where(inArray(likes.postId, postIds))
    : [];

  // Group likes by post
  const likesByPost = allLikes.reduce((acc, like) => {
    if (!acc[like.postId]) acc[like.postId] = [];
    acc[like.postId].push({ userId: like.userId });
    return acc;
  }, {} as Record<number, { userId: number }[]>);

  // Attach likes to posts
  const result = feedPosts.map(post => ({
    ...post,
    likes: likesByPost[post.id] || [],
    _count: { likes: (likesByPost[post.id] || []).length },
  }));

  res.json(result);
});

// Toggle like
router.post('/:id/like', authenticate, async (req: Request, res: Response) => {
  const postId = parseInt(req.params.id as string);
  const userId = req.userId!;

  const [existing] = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.postId, postId)))
    .limit(1);

  if (existing) {
    await db.delete(likes)
      .where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
    res.json({ liked: false });
  } else {
    await db.insert(likes).values({ userId, postId });
    res.json({ liked: true });
  }
});

export default router;
