'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    if (!api.isAuthenticated()) {
      router.push('/login');
      return;
    }

    // Redirect to memos (new main page)
    router.push('/memos');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div>Redirecting to Memos...</div>
    </div>
  );
}
