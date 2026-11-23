/** Explicit operator CLI. Preview by default; no public route grants administrative access. */
import 'dotenv/config';
import { prisma } from '@wisesama/database';

const args = process.argv.slice(2);
function value(flag: string) {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}
const email = value('--email')?.trim().toLowerCase();
const grant = args.includes('--grant');
const revoke = args.includes('--revoke');
const apply = args.includes('--apply');
const reason = value('--reason')?.trim();
if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  grant === revoke ||
  !reason ||
  reason.length < 10 ||
  reason.length > 500
) {
  throw new Error(
    'Use --email ADDRESS, one of --grant/--revoke, and --reason "at least ten characters". This previews the change. To apply, also pass --apply --confirm-user-id ID from the preview.',
  );
}
try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      intelAdmin: true,
      intelSuspendedAt: true,
      intelRevision: true,
    },
  });
  if (!user)
    throw new Error('No existing account matches this email. Create the intended account first.');
  if (user.intelSuspendedAt)
    throw new Error('Resolve this account’s Wisesama suspension before changing operator access.');
  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'preview',
          userId: user.id,
          email: user.email,
          currentIntelAdmin: user.intelAdmin,
          proposedIntelAdmin: grant,
          reason,
          next: 'Re-run with --apply --confirm-user-id matching userId to apply this specific change.',
        },
        null,
        2,
      ),
    );
  } else {
    if (value('--confirm-user-id') !== user.id)
      throw new Error(
        'The confirmed user ID does not match the selected account. Run a preview again.',
      );
    await prisma.$transaction(
      async (tx) => {
        if (
          revoke &&
          user.intelAdmin &&
          (await tx.user.count({ where: { intelAdmin: true, intelSuspendedAt: null } })) <= 1
        )
          throw new Error(
            'The final active v2 operator cannot be revoked. Grant another operator first.',
          );
        const changed = await tx.user.updateMany({
          where: { id: user.id, intelRevision: user.intelRevision, intelSuspendedAt: null },
          data: { intelAdmin: grant, intelRevision: { increment: 1 } },
        });
        if (!changed.count)
          throw new Error('Account state changed. Preview again before applying.');
        await tx.intelAdminAudit.create({
          data: {
            actorId: null,
            action: grant ? 'operator_access_granted' : 'operator_access_revoked',
            targetType: 'user',
            targetId: user.id,
            reason,
            metadata: { mode: 'operator-cli', intelAdmin: grant },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    console.log(
      'Applied the explicit v2 operator-access change and recorded an audit event. Dotsama role was unchanged.',
    );
  }
} finally {
  await prisma.$disconnect();
}
