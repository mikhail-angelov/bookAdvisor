'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store';

function HomeContent() {
  const router = useRouter();
  const setUser = useAppStore(state => state.setUser);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();

        if (data.authenticated && data.user) {
          setUser(data.user);
          router.replace("/books");
        } else {
          setUser(null);
          router.replace("/login");
        }
      } catch (err) {
        router.replace("/login");
      }
    };

    checkAuth();
  }, [router, setUser]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Initializing...</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
