import bcrypt from 'bcrypt';
import db from './index';
import { users, taps } from './schema';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Seeding database...');

  const password = await bcrypt.hash('password123', 10);

  // Create users
  console.log('Creating users...');
  
  const [alice] = await db.insert(users).values({
    username: 'alice',
    email: 'alice@thewall.dev',
    password,
    bio: 'Hey! I use The Wall 👋',
  }).returning().onConflictDoNothing();

  const [bob] = await db.insert(users).values({
    username: 'bob',
    email: 'bob@thewall.dev',
    password,
    bio: 'Just vibing 🤙',
  }).returning().onConflictDoNothing();

  if (!alice || !bob) {
    console.log('Users already exist, skipping...');
    const existingAlice = await db.select().from(users).where(eq(users.email, 'alice@thewall.dev')).limit(1);
    const existingBob = await db.select().from(users).where(eq(users.email, 'bob@thewall.dev')).limit(1);
    
    if (existingAlice[0] && existingBob[0]) {
      console.log('✅ Seed complete — two test accounts ready:');
      console.log('   alice@thewall.dev / password123');
      console.log('   bob@thewall.dev   / password123');
    }
    return;
  }

  // Create a tap between alice and bob (alice tapped bob)
  console.log('Creating tap...');
  const [user1Id, user2Id] = alice.id < bob.id ? [alice.id, bob.id] : [bob.id, alice.id];
  
  await db.insert(taps).values({
    user1Id,
    user2Id,
    tappedVia: 'manual',
    active: true,
  }).onConflictDoNothing();

  console.log('✅ Seed complete — two test accounts ready:');
  console.log('   alice@thewall.dev / password123');
  console.log('   bob@thewall.dev   / password123');
  console.log('   (They are already tapped!)');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
