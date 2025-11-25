/**
 * Script to promote a user to admin role
 * Run with: pnpm --filter @wisesama/api make-admin <email>
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: pnpm --filter @wisesama/api make-admin <email>');
    console.error('Example: pnpm --filter @wisesama/api make-admin admin@wisesama.io');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    console.log('\nAvailable users:');
    const users = await prisma.user.findMany({
      select: { email: true, role: true },
      take: 10,
    });
    users.forEach((u) => console.log(`  - ${u.email} (${u.role})`));
    process.exit(1);
  }

  if (user.role === 'ADMIN') {
    console.log(`User ${email} is already an admin.`);
    process.exit(0);
  }

  await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
  });

  console.log(`✓ User ${email} has been promoted to ADMIN role.`);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
