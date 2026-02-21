'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Book, UserAnnotation } from '@/db/schema';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAppStore } from '@/app/store';

export default function BookDetailsPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [book, setBook] = useState<Book | null>(null);
    const [annotation, setAnnotation] = useState<Partial<UserAnnotation>>({
        annotation: '',
        rating: 0,
        performanceRating: 0,
        readStatus: 'unread'
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { user, setUser } = useAppStore();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const bookRes = await fetch(`/api/books/${params.id}`);
                if (!bookRes.ok) {
                    toast.error('Book not found');
                    router.push('/books');
                    return;
                }
                const bookData = await bookRes.json();
                setBook(bookData.book);

                // Check auth status
                const authRes = await fetch("/api/auth/me");
                const authData = await authRes.json();
                if (authData.authenticated && authData.user) {
                    setUser(authData.user);
                    // Fetch annotation only if authenticated
                    const annRes = await fetch(`/api/books/${params.id}/annotation`);
                    const annData = await annRes.json();
                    if (annData.annotation) {
                        setAnnotation(annData.annotation);
                    }
                } else {
                    setUser(null);
                }
            } catch (error) {
                toast.error('Error loading data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [params.id, router, setUser]);

    const handleSaveAnnotation = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/books/${params.id}/annotation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(annotation),
            });

            if (!res.ok) throw new Error('Failed to save');
            toast.success('Saved!');
        } catch (error) {
            toast.error('Error saving');
        } finally {
            setIsSaving(false);
        }
    };

    const readStatusConfig = {
        unread: { label: 'Want to Read', color: 'bg-slate-600', icon: '○' },
        reading: { label: 'Reading', color: 'bg-amber-500', icon: '◐' },
        completed: { label: 'Completed', color: 'bg-emerald-500', icon: '●' },
        dropped: { label: 'Dropped', color: 'bg-rose-500', icon: '✕' },
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    <p className="text-slate-500 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    if (!book) return null;

    const statusConfig = readStatusConfig[annotation.readStatus as keyof typeof readStatusConfig] || readStatusConfig.unread;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center justify-between">
                        <Link 
                            href="/books" 
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Library
                        </Link>
                        <div className="flex items-center gap-3">
                            {user ? (
                                <span className="text-sm text-slate-500">{user.email}</span>
                            ) : (
                                <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
                                    Sign In
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Layout: Left content, Right sidebar */}
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left: Main Content */}
                    <div className="flex-1">
                        {/* Category */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-2.5 py-1 bg-slate-800 text-white text-xs font-medium rounded">
                                {book.category}
                            </span>
                        </div>

                        {/* Title & Author */}
                        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight mb-2">
                            {book.title}
                        </h1>
                        <p className="text-lg text-slate-600 mb-6">
                            by <span className="text-slate-800 font-medium">{book.authorName || 'Unknown Author'}</span>
                        </p>

                        {/* Meta Grid - 2 columns label:value */}
                        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 mb-6">
                            {book.authors && (
                                <div className="grid grid-cols-2 p-3">
                                    <div className="text-sm text-slate-500">Author</div>
                                    <div className="text-sm font-medium text-slate-800">{book.authors}</div>
                                </div>
                            )}
                            {book.performer && (
                                <div className="grid grid-cols-2 p-3">
                                    <div className="text-sm text-slate-500">Performer</div>
                                    <div className="text-sm font-medium text-slate-800">{book.performer}</div>
                                </div>
                            )}
                            {book.genre && (
                                <div className="grid grid-cols-2 p-3">
                                    <div className="text-sm text-slate-500">Genre</div>
                                    <div className="text-sm font-medium text-slate-800">{book.genre}</div>
                                </div>
                            )}
                            {book.series && (
                                <div className="grid grid-cols-2 p-3">
                                    <div className="text-sm text-slate-500">Series</div>
                                    <div className="text-sm font-medium text-slate-800">
                                        {book.series}
                                        {book.bookNumber && <span className="text-slate-500"> #{book.bookNumber}</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Meta Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                            {book.duration && (
                                <div className="bg-white rounded-lg p-4 border border-slate-200">
                                    <div className="text-xs text-slate-500 uppercase tracking-wide">Duration</div>
                                    <div className="font-semibold text-slate-800 mt-1">
                                        {book.duration}
                                    </div>
                                </div>
                            )}
                            {book.year && (
                                <div className="bg-white rounded-lg p-4 border border-slate-200">
                                    <div className="text-xs text-slate-500 uppercase tracking-wide">Year</div>
                                    <div className="font-semibold text-slate-800 mt-1">{book.year}</div>
                                </div>
                            )}
                            <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <div className="text-xs text-slate-500 uppercase tracking-wide">Size</div>
                                <div className="font-semibold text-slate-800 mt-1">{book.size || 'N/A'}</div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <div className="text-xs text-slate-500 uppercase tracking-wide">Downloads</div>
                                <div className="font-semibold text-slate-800 mt-1">{book.downloads?.toLocaleString() || 0}</div>
                            </div>
                        </div>

                        {/* Torrent Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="text-center p-3 bg-emerald-50 rounded-lg">
                                <div className="text-2xl font-bold text-emerald-600">{book.seeds || 0}</div>
                                <div className="text-xs text-emerald-700 uppercase tracking-wide">Seeds</div>
                            </div>
                            <div className="text-center p-3 bg-amber-50 rounded-lg">
                                <div className="text-2xl font-bold text-amber-600">{book.leechers || 0}</div>
                                <div className="text-xs text-amber-700 uppercase tracking-wide">Leechers</div>
                            </div>
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                                <div className="text-2xl font-bold text-blue-600">{book.commentsCount || 0}</div>
                                <div className="text-xs text-blue-700 uppercase tracking-wide">Comments</div>
                            </div>
                        </div>

                        {/* Description */}
                        {book.description && (
                            <section className="bg-white rounded-xl p-6 border border-slate-200">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Description</h2>
                                <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                                    {book.description}
                                </p>
                            </section>
                        )}
                    </div>

                    {/* Right: Sidebar */}
                    <div className="lg:w-72 flex-shrink-0">
                        {/* Book Cover */}
                        <div className="mb-4">
                            {book.imageUrl ? (
                                <img
                                    src={book.imageUrl}
                                    alt={book.title}
                                    className="w-full aspect-[2/3] object-cover rounded-lg shadow-lg"
                                />
                            ) : (
                                <div className="w-full aspect-[2/3] bg-slate-200 rounded-lg flex items-center justify-center">
                                    <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        {/* Status Badge - only show if user is authenticated */}
                        {user && (
                            <div className={`text-center mb-4 ${statusConfig.color} text-white px-4 py-2 rounded-lg font-medium text-sm`}>
                                {statusConfig.label}
                            </div>
                        )}

                        {/* View Topic Link */}
                        {book.url && (
                            <a
                                href={book.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mb-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 transition-colors w-full"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                View Topic
                            </a>
                        )}

                        {/* My Notes Panel - only show if user is authenticated */}
                        {user ? (
                            <div className="bg-white rounded-xl p-5 border border-slate-200">
                                <h2 className="text-base font-semibold text-slate-900 mb-4">My Notes</h2>

                                <div className="space-y-4">
                                    {/* Read Status */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                            Status
                                        </label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {Object.entries(readStatusConfig).map(([value, config]) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setAnnotation({ ...annotation, readStatus: value as any })}
                                                    className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                                                        annotation.readStatus === value
                                                            ? `${config.color} text-white`
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {config.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Rating */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                            Rating
                                        </label>
                                        <div className="flex gap-0.5">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    onClick={() => setAnnotation({ ...annotation, rating: annotation.rating === star ? 0 : star })}
                                                    className="p-0.5"
                                                >
                                                    <svg 
                                                        className={`w-6 h-6 ${star <= (annotation.rating || 0) ? 'text-amber-400' : 'text-slate-300'}`}
                                                        fill="currentColor" 
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Performance Rating */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                            Audio
                                        </label>
                                        <div className="flex gap-0.5">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    onClick={() => setAnnotation({ ...annotation, performanceRating: annotation.performanceRating === star ? 0 : star })}
                                                    className="p-0.5"
                                                >
                                                    <svg 
                                                        className={`w-6 h-6 ${star <= (annotation.performanceRating || 0) ? 'text-emerald-400' : 'text-slate-300'}`}
                                                        fill="currentColor" 
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                            Notes
                                        </label>
                                        <textarea
                                            value={annotation.annotation || ''}
                                            onChange={(e) => setAnnotation({ ...annotation, annotation: e.target.value })}
                                            placeholder="Add notes..."
                                            className="w-full h-28 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none"
                                        />
                                    </div>

                                    {/* Save Button */}
                                    <button
                                        onClick={handleSaveAnnotation}
                                        disabled={isSaving}
                                        className="w-full py-2 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Show sign in prompt for non-authenticated users */
                            <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
                                <p className="text-sm text-slate-600 mb-4">Sign in to save your notes and track your reading</p>
                                <Link
                                    href="/login"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 transition-colors w-full"
                                >
                                    Sign In
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
