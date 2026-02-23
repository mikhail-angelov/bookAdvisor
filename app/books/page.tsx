'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Book } from '@/db/schema';
import BookCard from '@/components/BookCard';
import { toast } from 'sonner';
import { useAppStore } from '@/app/store';
import Link from 'next/link';

type SortColumn = 'title' | 'genre' | 'seeds' | 'downloads' | 'lastCommentDate';
type SortDir = 'asc' | 'desc';

const PAGE_LIMIT = 50;

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return (
        <svg className="w-3 h-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
        </svg>
    );
    return dir === 'asc' ? (
        <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
        </svg>
    ) : (
        <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
    );
}

function BooksContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, setUser } = useAppStore();

    // Check auth on mount
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
            }
        };
        checkAuth();
    }, [setUser]);

    const [books, setBooks] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [genres, setGenres] = useState<string[]>([]);

    // Initialize all state from URL params
    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [genre, setGenre] = useState(searchParams.get('genre') || '');
    const [sortBy, setSortBy] = useState<SortColumn>(
        (searchParams.get('sortBy') as SortColumn) || 'lastCommentDate'
    );
    const [sortDir, setSortDir] = useState<SortDir>(
        (searchParams.get('sortDir') as SortDir) || 'desc'
    );
    const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));

    // Load genres once on mount
    useEffect(() => {
        fetch('/api/books/genres')
            .then(r => r.json())
            .then(data => setGenres(data.genres || []))
            .catch(() => {});
    }, []);

    const fetchBooks = useCallback(async (
        pageNum: number,
        q: string,
        g: string,
        col: SortColumn,
        dir: SortDir,
    ) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            if (g) params.set('genre', g);
            params.set('page', pageNum.toString());
            params.set('limit', PAGE_LIMIT.toString());
            params.set('sortBy', col);
            params.set('sortDir', dir);

            const res = await fetch(`/api/books?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch books');

            const data = await res.json();
            setBooks(data.books);
            setTotalPages(data.pagination.totalPages);
            setTotal(data.pagination.total);
        } catch {
            toast.error('Error loading books');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Sync URL and fetch whenever any filter/sort/page changes
    useEffect(() => {
        const params = new URLSearchParams();
        if (search) params.set('q', search);
        if (genre) params.set('genre', genre);
        if (sortBy !== 'lastCommentDate') params.set('sortBy', sortBy);
        if (sortDir !== 'desc') params.set('sortDir', sortDir);
        if (page > 1) params.set('page', page.toString());
        const qs = params.toString();
        router.replace(`/books${qs ? `?${qs}` : ''}`, { scroll: false });

        fetchBooks(page, search, genre, sortBy, sortDir);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, search, genre, sortBy, sortDir]);

    const handleSort = (col: SortColumn) => {
        if (col === sortBy) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(col);
            setSortDir('desc');
        }
        setPage(1);
    };

    const handleSearch = (val: string) => {
        setSearch(val);
        setPage(1);
    };

    const handleGenre = (val: string) => {
        setGenre(val);
        setPage(1);
    };

    const ThCell = ({ col, label, className = '' }: { col: SortColumn; label: string; className?: string }) => (
        <th
            className={`py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide select-none cursor-pointer hover:text-blue-600 transition-colors ${className}`}
            onClick={() => handleSort(col)}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                <SortIcon active={sortBy === col} dir={sortDir} />
            </span>
        </th>
    );

    const pageNumbers = () => {
        const pages: (number | '…')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push('…');
            for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
            if (page < totalPages - 2) pages.push('…');
            pages.push(totalPages);
        }
        return pages;
    };

    const onRecommendation = () =>{
        if(!user){
            toast.info('Please sign in to see personalized recommendations', {
            action: {
              label: 'Sign In',
              onClick: () => router.push('/login'),
            },
          });
            return
        }
        router.push('/recommendations')
    }

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
                                onChange={(e) => handleSearch(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-gray-100/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
                            />
                        </div>

                        <select
                            value={genre}
                            onChange={(e) => handleGenre(e.target.value)}
                            className="bg-gray-100/50 border-none rounded-2xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer max-w-[200px]"
                        >
                            <option value="">All Genres</option>
                            {genres.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    <div className="hidden md:flex items-center gap-2">
                        <button
                            onClick={onRecommendation}
                            className="px-4 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                            Recommended
                        </button>
                        {user ? (
                            <button
                                onClick={async () => {
                                    await fetch('/api/auth/logout', { method: 'POST' });
                                    setUser(null);
                                }}
                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            >
                                Logout
                            </button>
                        ) : (
                            <Link href="/login" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">
                                Sign In
                            </Link>
                        )}
                    </div>
                    
                    <div className="flex md:hidden items-center gap-2">
                        <button
                            onClick={() => router.push('/recommendations')}
                            className="px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
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
                ) : books.length > 0 ? (
                    <>
                        {/* Count */}
                        <p className="text-xs text-gray-400 mb-3 font-medium">
                            {total.toLocaleString()} books · page {page} of {totalPages}
                        </p>

                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50">
                                        <ThCell col="title" label="Title" className="text-left px-5" />
                                        <ThCell col="genre" label="Genre" className="text-left px-4 hidden md:table-cell" />
                                        <ThCell col="seeds" label="Seeds" className="text-center px-4 hidden sm:table-cell" />
                                        <ThCell col="downloads" label="Downloads" className="text-center px-4 hidden sm:table-cell" />
                                        <ThCell col="lastCommentDate" label="Last Comment" className="text-right px-5 hidden lg:table-cell" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {books.map((book) => (
                                        <BookCard key={book.id} book={book} />
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-1 mt-8">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    ‹ Prev
                                </button>

                                {pageNumbers().map((p, i) =>
                                    p === '…' ? (
                                        <span key={`ellipsis-${i}`} className="px-2 text-gray-400">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p as number)}
                                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                                                page === p
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                    : 'text-gray-600 hover:bg-white hover:shadow-sm'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}

                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    Next ›
                                </button>
                            </div>
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
                        <p className="text-gray-500">Try adjusting your search or genre filter</p>
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
