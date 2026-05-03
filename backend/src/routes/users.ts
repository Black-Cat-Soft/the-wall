import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import db from '../db';
import { users, posts, taps, likes } from '../db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';

const router = Router();

// Current user's own profile
router.get('/me/profile', authenticate, async (req: Request, res: Response) => {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      bio: users.bio,
      avatar: users.avatar,
    })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  res.json(user);
});

// Get user profile
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string);
  const me = req.userId!;

  // Get user basic info
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      bio: users.bio,
      avatar: users.avatar,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Get user's posts
  const userPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.authorId, userId))
    .orderBy(desc(posts.createdAt));

  // Get likes for these posts
  const postIds = userPosts.map(p => p.id);
  const postLikes = postIds.length > 0
    ? await db.select({ postId: likes.postId, userId: likes.userId })
        .from(likes)
        .where(sql`${likes.postId} IN ${postIds}`)
    : [];

  const likesByPost = postLikes.reduce((acc, like) => {
    if (!acc[like.postId]) acc[like.postId] = [];
    acc[like.postId].push({ userId: like.userId });
    return acc;
  }, {} as Record<number, { userId: number }[]>);

  const postsWithLikes = userPosts.map(post => ({
    ...post,
    likes: likesByPost[post.id] || [],
    _count: { likes: (likesByPost[post.id] || []).length },
  }));

  // Count taps
  const tapCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(taps)
    .where(and(
      eq(taps.active, true),
      or(eq(taps.user1Id, userId), eq(taps.user2Id, userId))
    ));
  const tapCount = tapCountResult[0]?.count || 0;

  // Check tap status with current user
  const [user1Id, user2Id] = me < userId ? [me, userId] : [userId, me];
  const [tap] = await db
    .select()
    .from(taps)
    .where(and(eq(taps.user1Id, user1Id), eq(taps.user2Id, user2Id)))
    .limit(1);

  const tapStatus = tap?.active ? 'tapped' : 'none';

  res.json({ 
    ...user, 
    posts: postsWithLikes,
    tapCount: Number(tapCount),
    tapStatus 
  });
});

// Tap or untap a user
router.post('/:id/tap', authenticate, async (req: Request, res: Response) => {
  const otherUserId = parseInt(req.params.id as string);
  const myUserId = req.userId!;

  if (myUserId === otherUserId) {
    res.status(400).json({ error: 'Cannot tap yourself' });
    return;
  }

  const [user1Id, user2Id] = myUserId < otherUserId 
    ? [myUserId, otherUserId] 
    : [otherUserId, myUserId];

  // Check if tap exists
  const [existing] = await db
    .select()
    .from(taps)
    .where(and(eq(taps.user1Id, user1Id), eq(taps.user2Id, user2Id)))
    .limit(1);

  if (!existing) {
    // Create new tap
    await db.insert(taps).values({
      user1Id,
      user2Id,
      tappedVia: 'manual',
      active: true,
    });
    res.json({ tapStatus: 'tapped' });
    return;
  }

  if (existing.active) {
    // Already tapped — untap
    await db
      .update(taps)
      .set({ active: false })
      .where(eq(taps.id, existing.id));
    res.json({ tapStatus: 'none' });
    return;
  }

  // Reactivate tap
  await db
    .update(taps)
    .set({ active: true, tappedAt: new Date() })
    .where(eq(taps.id, existing.id));
  res.json({ tapStatus: 'tapped' });
});

export default router;
