'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Book } from '@/db/schema';
import BookCard from '@/components/BookCard';
import { toast } from 'sonner';

function BooksContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // State
    const [books, setBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMoreLoading, setIsMoreLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);

    // Search and Filter State
    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [category, setCategory] = useState(searchParams.get('category') || '');

    // Refs
    const observer = useRef<IntersectionObserver | null>(null);
    const lastBookElementRef = useCallback((node: HTMLDivElement | null) => {
        if (isLoading || isMoreLoading) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });

        if (node) observer.current.observe(node);
    }, [isLoading, isMoreLoading, hasMore]);

    // Fetch Books
    const fetchBooks = async (pageNum: number, isNewSearch: boolean = false) => {
        try {
            const params = new URLSearchParams();
            if (search) params.set('q', search);
            if (category) params.set('category', category);
            params.set('page', pageNum.toString());
            params.set('limit', '20');

            const res = await fetch(`/api/books?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch books');

            const data = await res.json();

            if (isNewSearch) {
                setBooks(data.books);
            } else {
                setBooks(prev => [...prev, ...data.books]);
            }

            setHasMore(data.pagination.hasMore);
        } catch (error) {
            toast.error('Error loading books');
        } finally {
            setIsLoading(false);
            setIsMoreLoading(false);
        }
    };

    // Handle Search/Filter changes
    useEffect(() => {
        setIsLoading(true);
        setPage(1);
        fetchBooks(1, true);

        // Update URL
        const params = new URLSearchParams();
        if (search) params.set('q', search);
        if (category) params.set('category', category);

        const queryString = params.toString();
        router.replace(`/books${queryString ? `?${queryString}` : ''}`, { scroll: false });
    }, [search, category]);

    // Handle Load More
    useEffect(() => {
        if (page > 1) {
            setIsMoreLoading(true);
            fetchBooks(page);
        }
    }, [page]);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Library</h1>
                    </div>

                    <div className="flex flex-1 max-w-2xl w-full gap-3">
                        <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Search by title, author, series..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-gray-100/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
                            />
                        </div>

                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="bg-gray-100/50 border-none rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                        >
                            <option value="">All Categories</option>
                            <option value="Российская фантастика">Фантастика</option>
                            <option value="Зарубежная фантастика">Зарубежная</option>
                            <option value="Детективы, триллеры">Детективы</option>
                        </select>
                    </div>

                    <div className="hidden md:block">
                        <button
                            onClick={async () => {
                                await fetch('/api/auth/logout', { method: 'POST' });
                                router.push('/login');
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 pt-8">
                {isLoading && books.length === 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="bg-gray-200 animate-pulse rounded-2xl h-64" />
                        ))}
                    </div>
                ) : books.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {books.map((book, index) => {
                                const isLast = books.length === index + 1;
                                return (
                                    <div key={book.id} ref={isLast ? lastBookElementRef : null}>
                                        <BookCard book={book} />
                                    </div>
                                );
                            })}
                        </div>

                        {isMoreLoading && (
                            <div className="flex justify-center mt-10">
                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}

                        {!hasMore && (
                            <p className="text-center text-gray-400 mt-12 font-medium">No more books to show</p>
                        )}
                    </>
                ) : (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">No books found</h3>
                        <p className="text-gray-500">Try adjusting your search or category filter</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function BooksPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <BooksContent />
        </Suspense>
    );
}
