'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Book } from '@/db/schema';
import BookCard from '@/components/BookCard';
import { toast } from 'sonner';

interface ScoredBook extends Book {
  score: number;
  reasons: string[];
}

function RecommendationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [recommendations, setRecommendations] = useState<ScoredBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [provider, setProvider] = useState<string>('vector');
  const [preferences, setPreferences] = useState<{
    likedGenres: string[];
    likedAuthors: string[];
    likedPerformers: string[];
  } | null>(null);
  const [reason, setReason] = useState<string>('loading');

  const limit = parseInt(searchParams.get('limit') || '20');

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('provider', provider);

      const res = await fetch(`/api/recommendations?${params.toString()}`);
      
      if (res.status === 401) {
        // User not authenticated - redirect to login
        router.push('/login');
        return;
      }
      
      if (!res.ok) throw new Error('Failed to fetch recommendations');

      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setPreferences(data.preferences || null);
      setReason(data.reason || 'unknown');
    } catch (error) {
      toast.error('Error loading recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [limit, provider]);

  const getReasonMessage = () => {
    switch (reason) {
      case 'popular':
        return 'No preferences yet. Showing popular books to discover.';
      case 'hybrid-scoring':
        return 'Based on your ratings, these books match your preferences.';
      default:
        return 'Loading recommendations...';
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.7) return { label: 'Excellent Match', color: 'bg-emerald-100 text-emerald-700' };
    if (score >= 0.5) return { label: 'Good Match', color: 'bg-blue-100 text-blue-700' };
    if (score >= 0.3) return { label: 'Fair Match', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Consider', color: 'bg-slate-100 text-slate-600' };
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
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Recommended</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setProvider('hybrid')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${provider === 'hybrid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Classic
              </button>
              <button
                onClick={() => setProvider('vector')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${provider === 'vector' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                AI Vector
              </button>
            </div>
            <button
              onClick={() => router.push('/books')}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Browse Library
            </button>
          </div>
        </div>
      </header>

      {/* Preferences Panel */}
      {preferences && (preferences.likedGenres.length > 0 || preferences.likedAuthors.length > 0) && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Your Preferences (derived from rated books)
            </h2>
            <div className="flex flex-wrap gap-4">
              {preferences.likedGenres.length > 0 && (
                <div>
                  <span className="text-xs text-gray-400 mr-2">Genres:</span>
                  {preferences.likedGenres.slice(0, 5).map((g, i) => (
                    <span key={g} className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full mr-1">
                      {g}
                    </span>
                  ))}
                </div>
              )}
              {preferences.likedAuthors.length > 0 && (
                <div>
                  <span className="text-xs text-gray-400 mr-2">Authors:</span>
                  {preferences.likedAuthors.slice(0, 5).map((a, i) => (
                    <span key={a} className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full mr-1">
                      {a}
                    </span>
                  ))}
                </div>
              )}
              {preferences.likedPerformers.length > 0 && (
                <div>
                  <span className="text-xs text-gray-400 mr-2">Performers:</span>
                  {preferences.likedPerformers.slice(0, 3).map((p, i) => (
                    <span key={p} className="inline-flex items-center px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-full mr-1">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-4">
        {/* Reason message */}
        <div className="mb-4">
          <p className="text-sm text-gray-500">{getReasonMessage()}</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-gray-200 animate-pulse rounded h-10" />
            ))}
          </div>
        ) : recommendations.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Match Score
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Title
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                    Genre
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                    Downloads
                  </th>
                  <th className="text-right py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                    Why
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recommendations.map((book) => {
                  const scoreInfo = getScoreLabel(book.score);
                  return (
                    <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-emerald-400 to-teal-500 h-2 rounded-full"
                              style={{ width: `${book.score * 100}%` }}
                            />
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${scoreInfo.color}`}>
                            {Math.round(book.score * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <a href={`/books/${book.id}`} className="hover:text-blue-600 transition-colors">
                          <div className="font-medium text-gray-900">{book.title}</div>
                          <div className="text-xs text-gray-500">{book.authorName || 'Unknown'}</div>
                        </a>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="text-xs text-gray-500">{book.genre || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        <span className="text-xs text-gray-500">{book.downloads?.toLocaleString() || 0}</span>
                      </td>
                      <td className="py-3 px-5 text-right hidden lg:table-cell">
                        <div className="flex flex-wrap justify-end gap-1">
                          {book.reasons?.slice(0, 2).map((r, i) => (
                            <span key={i} className="text-xs text-gray-400">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900">No recommendations yet</h3>
            <p className="text-gray-500 mb-4">Rate some books to get personalized recommendations</p>
            <button
              onClick={() => router.push('/books')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
            >
              Browse Books
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RecommendationsContent />
    </Suspense>
  );
}
