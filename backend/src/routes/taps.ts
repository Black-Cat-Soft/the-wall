import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import db from '../db';
import { taps, users } from '../db/schema';
import { and, eq, or, sql } from 'drizzle-orm';

const router = Router();

// Create a tap (mutual, instant)
router.post('/', authenticate, async (req: Request, res: Response) => {
  const { otherUserId, method, location, deviceInfo } = req.body;
  const myUserId = req.userId!;

  if (myUserId === otherUserId) {
    res.status(400).json({ error: 'Cannot tap yourself' });
    return;
  }

  // Ensure user1Id < user2Id for uniqueness
  const [user1Id, user2Id] = myUserId < otherUserId 
    ? [myUserId, otherUserId] 
    : [otherUserId, myUserId];

  try {
    // Check if already tapped
    const [existing] = await db
      .select()
      .from(taps)
      .where(and(eq(taps.user1Id, user1Id), eq(taps.user2Id, user2Id)))
      .limit(1);

    if (existing) {
      if (existing.active) {
        res.status(400).json({ error: 'Already tapped' });
        return;
      }
      // Reactivate if previously untapped
      await db
        .update(taps)
        .set({ 
          active: true, 
          tappedAt: new Date(), 
          tappedVia: method || 'manual',
          location: location || null,
          deviceInfo: deviceInfo || null,
        })
        .where(eq(taps.id, existing.id));
    } else {
      await db.insert(taps).values({
        user1Id,
        user2Id,
        tappedVia: method || 'manual',
        location: location || null,
        deviceInfo: deviceInfo || null,
      });
    }

    res.json({ success: true, method: method || 'manual' });
  } catch (error) {
    console.error('Tap creation error:', error);
    res.status(500).json({ error: 'Failed to create tap' });
  }
});

// Get my taps (connections)
router.get('/my-taps', authenticate, async (req: Request, res: Response) => {
  const myId = req.userId!;

  try {
    const myTaps = await db
      .select({
        id: taps.id,
        tappedAt: taps.tappedAt,
        tappedVia: taps.tappedVia,
        location: taps.location,
        user1Id: taps.user1Id,
        user2Id: taps.user2Id,
        user1: {
          id: users.id,
          username: users.username,
          avatar: users.avatar,
        },
      })
      .from(taps)
      .leftJoin(users, eq(taps.user1Id, users.id))
      .where(and(
        eq(taps.active, true),
        or(eq(taps.user1Id, myId), eq(taps.user2Id, myId))
      ));

    // Get the other user for each tap
    const connections = await Promise.all(
      myTaps.map(async (tap) => {
        const otherId = tap.user1Id === myId ? tap.user2Id : tap.user1Id;
        const [otherUser] = await db
          .select({ id: users.id, username: users.username, avatar: users.avatar })
          .from(users)
          .where(eq(users.id, otherId))
          .limit(1);

        return {
          user: otherUser,
          tappedAt: tap.tappedAt,
          tappedVia: tap.tappedVia,
          location: tap.location,
        };
      })
    );

    res.json(connections);
  } catch (error) {
    console.error('Get taps error:', error);
    res.status(500).json({ error: 'Failed to get taps' });
  }
});

// Un-tap (soft delete)
router.delete('/:userId', authenticate, async (req: Request, res: Response) => {
  const otherUserId = parseInt(req.params.userId as string);
  const myUserId = req.userId!;

  const [user1Id, user2Id] = myUserId < otherUserId 
    ? [myUserId, otherUserId] 
    : [otherUserId, myUserId];

  try {
    await db
      .update(taps)
      .set({ active: false })
      .where(and(eq(taps.user1Id, user1Id), eq(taps.user2Id, user2Id)));

    res.json({ success: true });
  } catch (error) {
    console.error('Untap error:', error);
    res.status(500).json({ error: 'Failed to untap' });
  }
});

export default router;
