'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, type WisesamaUser } from '@/lib/auth-client';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const user = session?.user as WisesamaUser | undefined;
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!isPending && (!user || !isAdmin)) {
      router.push('/login');
    }
  }, [isPending, user, isAdmin, router]);

  if (isPending) {
    return (
      <div className="min-h-screen bg-wisesama-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-wisesama-purple animate-spin" />
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
