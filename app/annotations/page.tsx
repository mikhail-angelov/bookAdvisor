'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/app/store';
import { toast } from 'sonner';

interface AnnotatedBook {
  id: string;
  rating: number;
  performanceRating: number;
  annotation: string | null;
  readStatus: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  book: {
    id: string;
    title: string;
    authorName: string | null;
    authors: string | null;
    genre: string | null;
    imageUrl: string | null;
    seeds: number | null;
    downloads: number | null;
  };
}

function AnnotationsContent() {
  const router = useRouter();
  const { user, setUser } = useAppStore();
  const [annotations, setAnnotations] = useState<AnnotatedBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
          router.push('/login');
        }
      } catch (err) {
        setUser(null);
        router.push('/login');
      }
    };
    checkAuth();
  }, [setUser, router]);

  useEffect(() => {
    if (!user) return;

    const fetchAnnotations = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/annotations');
        if (!res.ok) throw new Error('Failed to fetch annotations');
        const data = await res.json();
        setAnnotations(data.annotations || []);
      } catch (error) {
        toast.error('Error loading annotations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnnotations();
  }, [user]);

  const getReadStatusBadge = (status: string | null) => {
    switch (status) {
      case 'read':
        return { label: 'Read', color: 'bg-green-100 text-green-700' };
      case 'reading':
        return { label: 'Reading', color: 'bg-blue-100 text-blue-700' };
      case 'want_to_read':
        return { label: 'Want to Read', color: 'bg-amber-100 text-amber-700' };
      default:
        return { label: 'Unread', color: 'bg-gray-100 text-gray-500' };
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-200'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">My Books</h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/books')}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Browse Library
            </button>
            <button
              onClick={() => router.push('/recommendations')}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Recommended
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-8">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-gray-200 animate-pulse rounded h-10" />
            ))}
          </div>
        ) : annotations.length > 0 ? (
          <>
            {/* Count */}
            <p className="text-xs text-gray-400 mb-3 font-medium">
              {annotations.length} annotated book{annotations.length !== 1 ? 's' : ''}
            </p>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Book
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                      Status
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                      Rating
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                      Notes
                    </th>
                    <th className="text-right py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                      Annotated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {annotations.map((item) => {
                    const statusBadge = getReadStatusBadge(item.readStatus);
                    return (
                      <tr
                        key={item.id}
                        className="group hover:bg-purple-50/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/books/${item.book.id}`)}
                      >
                        {/* Book Info */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {item.book.imageUrl ? (
                              <img
                                src={item.book.imageUrl}
                                alt={item.book.title}
                                className="w-10 h-14 object-cover rounded shadow-sm"
                              />
                            ) : (
                              <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center">
                                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-1">
                                {item.book.title}
                              </div>
                              <div className="text-xs text-gray-500 line-clamp-1">
                                {item.book.authorName || item.book.authors || 'Unknown author'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`text-xs px-2 py-1 rounded-full ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </td>

                        {/* Rating */}
                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                          {item.rating > 0 ? renderStars(item.rating) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-gray-500 line-clamp-2">
                            {item.annotation || '—'}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="px-5 py-3 text-right text-gray-400 hidden lg:table-cell whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900">No annotated books yet</h3>
            <p className="text-gray-500 mb-4">Start annotating books to track your reading</p>
            <button
              onClick={() => router.push('/books')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition-colors"
            >
              Browse Books
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AnnotationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AnnotationsContent />
    </Suspense>
  );
}