'use client';

import { startTransition, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Book } from '@/db/schema';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAppStore } from '@/app/store';
import { DEFAULT_READ_STATUS, type ReadStatus } from '@/lib/read-status';
import { bookNavigationCache, type BookNavigationNeighbors } from '@/lib/book-navigation-cache';
import AuthorBooksModal, { type EditableAnnotation, type AuthorBook, toEditableAnnotation } from '@/components/AuthorBooksModal';
import StarRating from '@/components/StarRating';

const readStatusConfig: Record<ReadStatus, { label: string; color: string; icon: string }> = {
    want_to_read: { label: 'Want to Read', color: 'bg-slate-600', icon: '○' },
    reading: { label: 'Reading', color: 'bg-amber-500', icon: '◐' },
    read: { label: 'Read', color: 'bg-emerald-500', icon: '●' },
    dropped: { label: 'Dropped', color: 'bg-rose-500', icon: '✕' },
};

export default function BookDetailsPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [book, setBook] = useState<Book | null>(null);
    const [annotation, setAnnotation] = useState<EditableAnnotation>(toEditableAnnotation());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [neighbors, setNeighbors] = useState<BookNavigationNeighbors | null>(null);
    const [isAuthorModalOpen, setIsAuthorModalOpen] = useState(false);
    const [isAuthorBooksLoading, setIsAuthorBooksLoading] = useState(false);
    const [authorBooks, setAuthorBooks] = useState<AuthorBook[]>([]);
    const [loadedAuthor, setLoadedAuthor] = useState<string | null>(null);
    const [savingAuthorBookIds, setSavingAuthorBookIds] = useState<Record<string, boolean>>({});
    const { user, setUser } = useAppStore();
    const navigationKey = searchParams.get('nav');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [bookRes, authRes] = await Promise.all([
                    fetch(`/api/books/${params.id}`),
                    fetch('/api/auth/me'),
                ]);

                if (!bookRes.ok) {
                    toast.error('Book not found');
                    router.push('/books');
                    return;
                }

                const bookData = await bookRes.json();
                setBook(bookData.book);

                const authData = await authRes.json();
                if (authData.authenticated && authData.user) {
                    setUser(authData.user);
                    const annRes = await fetch(`/api/books/${params.id}/annotation`);
                    const annData = await annRes.json();
                    if (annData.annotation) {
                        setAnnotation(toEditableAnnotation(annData.annotation));
                    } else {
                        setAnnotation(toEditableAnnotation());
                    }
                } else {
                    setUser(null);
                    setAnnotation(toEditableAnnotation());
                }
            } catch {
                toast.error('Error loading data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [params.id, router, setUser]);

    useEffect(() => {
        setNeighbors(bookNavigationCache.getNeighbors(navigationKey, params.id));
    }, [navigationKey, params.id]);

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
        } catch {
            toast.error('Error saving');
        } finally {
            setIsSaving(false);
        }
    };

    const loadAuthorBooks = async () => {
        if (!book?.authorName) return;

        setIsAuthorBooksLoading(true);
        try {
            const params = new URLSearchParams({
                author: book.authorName,
                limit: '200',
                sortBy: 'title',
                sortDir: 'asc',
                excludeAnnotated: 'false',
                includeAnnotations: 'true',
            });

            const res = await fetch(`/api/books?${params.toString()}`);
            if (!res.ok) {
                throw new Error('Failed to load author books');
            }

            const data = await res.json();
            startTransition(() => {
                setAuthorBooks(data.books ?? []);
                setLoadedAuthor(book.authorName || null);
            });
        } catch {
            toast.error('Error loading author books');
        } finally {
            setIsAuthorBooksLoading(false);
        }
    };

    const handleOpenAuthorModal = async () => {
        setIsAuthorModalOpen(true);
        if (!book?.authorName || loadedAuthor === book.authorName) {
            return;
        }

        await loadAuthorBooks();
    };

    const saveAuthorBookAnnotation = async (bookId: string, nextAnnotation: EditableAnnotation) => {
        const previousBook = authorBooks.find((item) => item.id === bookId);
        if (!previousBook) return;

        const previousAnnotation = toEditableAnnotation(previousBook.userAnnotation);

        setSavingAuthorBookIds((current) => ({ ...current, [bookId]: true }));
        startTransition(() => {
            setAuthorBooks((current) =>
                current.map((item) =>
                    item.id === bookId
                        ? { ...item, userAnnotation: nextAnnotation }
                        : item
                )
            );
        });

        if (bookId === params.id) {
            setAnnotation(nextAnnotation);
        }

        try {
            const res = await fetch(`/api/books/${bookId}/annotation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextAnnotation),
            });

            if (res.status === 401) {
                throw new Error('Unauthorized');
            }

            if (!res.ok) {
                throw new Error('Failed to save');
            }
        } catch (error) {
            startTransition(() => {
                setAuthorBooks((current) =>
                    current.map((item) =>
                        item.id === bookId
                            ? { ...item, userAnnotation: previousAnnotation }
                            : item
                    )
                );
            });

            if (bookId === params.id) {
                setAnnotation(previousAnnotation);
            }

            if (error instanceof Error && error.message === 'Unauthorized') {
                toast.error('Sign in to update statuses and ratings');
                setIsAuthorModalOpen(false);
                router.push('/login');
            } else {
                toast.error('Error saving changes');
            }
        } finally {
            setSavingAuthorBookIds((current) => ({ ...current, [bookId]: false }));
        }
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

    const statusConfig = readStatusConfig[annotation.readStatus] || readStatusConfig.want_to_read;
    const backLabel = neighbors?.source === 'recommendations' ? 'Back to Recommendations' : 'Back to Library';
    const handleBack = () => {
        if (neighbors?.returnHref) {
            router.push(neighbors.returnHref);
            return;
        }

        router.push('/books');
    };
    const navigateToSibling = (bookId: string | null) => {
        if (!bookId) return;
        const href = navigationKey ? `/books/${bookId}?nav=${encodeURIComponent(navigationKey)}` : `/books/${bookId}`;
        router.push(href);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleBack}
                                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                {backLabel}
                            </button>
                            {neighbors && (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => navigateToSibling(neighbors.prevId)}
                                        disabled={!neighbors.prevId}
                                        aria-label="Previous book"
                                        className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        &lt;
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigateToSibling(neighbors.nextId)}
                                        disabled={!neighbors.nextId}
                                        aria-label="Next book"
                                        className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        &gt;
                                    </button>
                                </div>
                            )}
                        </div>
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
                <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1">
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-2.5 py-1 bg-slate-800 text-white text-xs font-medium rounded">
                                {book.category}
                            </span>
                        </div>

                        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 leading-tight mb-2">
                            {book.title}
                        </h1>
                        <p className="text-lg text-slate-600 mb-3">
                            by <span className="text-slate-800 font-medium">{book.authorName || 'Unknown Author'}</span>
                        </p>
                        {book.authorName && (
                            <button
                                type="button"
                                onClick={handleOpenAuthorModal}
                                className="inline-flex items-center gap-2 mb-6 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0l-4-4m4 4l-4 4" />
                                </svg>
                                All Books by This Author
                            </button>
                        )}

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

                        {book.description && (
                            <section className="bg-white rounded-xl p-6 border border-slate-200">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Description</h2>
                                <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                                    {book.description}
                                </p>
                            </section>
                        )}
                    </div>

                    <div className="lg:w-72 flex-shrink-0">
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

                        {user && (
                            <div className={`text-center mb-4 ${statusConfig.color} text-white px-4 py-2 rounded-lg font-medium text-sm`}>
                                {statusConfig.label}
                            </div>
                        )}

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

                        {user ? (
                            <div className="bg-white rounded-xl p-5 border border-slate-200">
                                <h2 className="text-base font-semibold text-slate-900 mb-4">My Notes</h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                            Status
                                        </label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {Object.entries(readStatusConfig).map(([value, config]) => (
                                                <button
                                                    key={value}
                                                    onClick={() => setAnnotation((current) => ({ ...current, readStatus: value as ReadStatus }))}
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

                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                            Rating
                                        </label>
                                        <StarRating
                                            value={annotation.rating}
                                            colorClass="text-amber-400"
                                            onSelect={(value) => setAnnotation((current) => ({ ...current, rating: value }))}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                            Audio
                                        </label>
                                        <StarRating
                                            value={annotation.performanceRating}
                                            colorClass="text-emerald-400"
                                            onSelect={(value) => setAnnotation((current) => ({ ...current, performanceRating: value }))}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                                            Notes
                                        </label>
                                        <textarea
                                            value={annotation.annotation || ''}
                                            onChange={(e) => setAnnotation((current) => ({ ...current, annotation: e.target.value }))}
                                            placeholder="Add notes..."
                                            className="w-full h-28 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none"
                                        />
                                    </div>

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
            <AuthorBooksModal
                authorName={book.authorName || 'Author'}
                books={authorBooks}
                currentBookId={book.id}
                isOpen={isAuthorModalOpen}
                isLoading={isAuthorBooksLoading}
                navigationKey={navigationKey}
                userEmail={user?.email}
                savingBookIds={savingAuthorBookIds}
                onClose={() => setIsAuthorModalOpen(false)}
                onSaveAnnotation={saveAuthorBookAnnotation}
            />
        </div>
    );
}
