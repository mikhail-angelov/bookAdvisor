'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from './store';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const setUser = useAppStore(state => state.setUser);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();

        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        setUser(null);
      } finally {
        setIsLoading(false);
        router.replace("/books");
      }
    };

    checkAuth();
  }, [router, setUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-slate-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">Book Advisor</h1>
          <nav className="flex items-center gap-4">
            <Link href="/books" className="text-slate-600 hover:text-slate-800 font-medium">
              Books
            </Link>
            <Link href="/login" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
              Sign In
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Welcome to Book Advisor</h2>
          <p className="text-lg text-slate-600 mb-8">Browse and manage your audio book collection from Rutracker</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/books" className="px-6 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800">
              Browse Books
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
