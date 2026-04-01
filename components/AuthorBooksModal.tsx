'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Book, UserAnnotation } from '@/db/schema';
import { DEFAULT_READ_STATUS, type ReadStatus } from '@/lib/read-status';
import StarRating from '@/components/StarRating';

export type EditableAnnotation = {
    annotation: string;
    rating: number;
    performanceRating: number;
    readStatus: ReadStatus;
};

export type AuthorBook = Book & { userAnnotation?: Partial<UserAnnotation> | null };

const readStatusConfig: Record<ReadStatus, { label: string; color: string; icon: string }> = {
    want_to_read: { label: 'Want to Read', color: 'bg-slate-600', icon: '○' },
    reading: { label: 'Reading', color: 'bg-amber-500', icon: '◐' },
    read: { label: 'Read', color: 'bg-emerald-500', icon: '●' },
    dropped: { label: 'Dropped', color: 'bg-rose-500', icon: '✕' },
};

export function toEditableAnnotation(annotation?: Partial<UserAnnotation> | null): EditableAnnotation {
    return {
        annotation: typeof annotation?.annotation === 'string' ? annotation.annotation : '',
        rating: typeof annotation?.rating === 'number' ? annotation.rating : 0,
        performanceRating: typeof annotation?.performanceRating === 'number' ? annotation.performanceRating : 0,
        readStatus: (annotation?.readStatus as ReadStatus) || DEFAULT_READ_STATUS,
    };
}

type AuthorBooksModalProps = {
    authorName: string;
    books: AuthorBook[];
    currentBookId: string;
    isOpen: boolean;
    isLoading: boolean;
    navigationKey: string | null;
    userEmail?: string | null;
    savingBookIds: Record<string, boolean>;
    onClose: () => void;
    onSaveAnnotation: (bookId: string, nextAnnotation: EditableAnnotation) => void;
};

export default function AuthorBooksModal({
    authorName,
    books,
    currentBookId,
    isOpen,
    isLoading,
    navigationKey,
    userEmail,
    savingBookIds,
    onClose,
    onSaveAnnotation,
}: AuthorBooksModalProps) {
    useEffect(() => {
        if (!isOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <button
                type="button"
                aria-label="Close author books modal"
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            />
            <div className="relative w-full sm:max-w-5xl h-[88vh] sm:h-[85vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-slate-200 bg-white">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">
                            {authorName || 'Author'} Books
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Update status, book rating, and performer rating without leaving this page.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 w-10 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {!userEmail && (
                    <div className="px-5 sm:px-6 py-3 border-b border-slate-200 bg-amber-50 text-amber-900 text-sm">
                        Sign in to change status and ratings from this list.
                    </div>
                )}

                <div className="h-[calc(100%-73px)] overflow-y-auto bg-slate-50">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                <p className="text-slate-500 text-sm">Loading author books...</p>
                            </div>
                        </div>
                    ) : books.length === 0 ? (
                        <div className="h-full flex items-center justify-center px-6 text-center">
                            <p className="text-slate-500">No books found for this author.</p>
                        </div>
                    ) : (
                        <div className="p-4 sm:p-6 space-y-3">
                            {books.map((item) => {
                                const itemAnnotation = toEditableAnnotation(item.userAnnotation);
                                const itemStatus = readStatusConfig[itemAnnotation.readStatus] || readStatusConfig.want_to_read;
                                const isItemSaving = !!savingBookIds[item.id];

                                return (
                                    <div
                                        key={item.id}
                                        className={`rounded-2xl border p-4 sm:p-5 transition-colors ${
                                            item.id === currentBookId
                                                ? 'border-slate-900 bg-white shadow-sm'
                                                : 'border-slate-200 bg-white'
                                        }`}
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0 lg:max-w-[34%]">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    {item.id === currentBookId && (
                                                        <span className="px-2 py-1 rounded-full bg-slate-900 text-white text-[11px] font-medium uppercase tracking-wide">
                                                            Current
                                                        </span>
                                                    )}
                                                    {item.year && (
                                                        <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium uppercase tracking-wide">
                                                            {item.year}
                                                        </span>
                                                    )}
                                                </div>
                                                <Link
                                                    href={navigationKey ? `/books/${item.id}?nav=${encodeURIComponent(navigationKey)}` : `/books/${item.id}`}
                                                    className="block text-lg font-semibold text-slate-900 hover:text-slate-700 transition-colors"
                                                    onClick={onClose}
                                                >
                                                    {item.title}
                                                </Link>
                                                <div className="mt-2 text-sm text-slate-500 space-y-1">
                                                    {item.performer && <p>Performer: {item.performer}</p>}
                                                    {item.series && <p>Series: {item.series}{item.bookNumber ? ` #${item.bookNumber}` : ''}</p>}
                                                    {item.genre && <p>{item.genre}</p>}
                                                </div>
                                            </div>

                                            <div className="flex-1 grid gap-4 md:grid-cols-3">
                                                <div>
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
                                                        Status
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(readStatusConfig).map(([value, config]) => (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                disabled={!userEmail || isItemSaving}
                                                                onClick={() =>
                                                                    onSaveAnnotation(item.id, {
                                                                        ...itemAnnotation,
                                                                        readStatus: value as ReadStatus,
                                                                    })
                                                                }
                                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                                    itemAnnotation.readStatus === value
                                                                        ? `${config.color} text-white`
                                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                }`}
                                                            >
                                                                {config.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className={`inline-flex items-center gap-2 mt-3 px-2.5 py-1 rounded-full text-xs font-medium ${itemStatus.color} text-white`}>
                                                        <span>{itemStatus.icon}</span>
                                                        {itemStatus.label}
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
                                                        Author Rating
                                                    </div>
                                                    <StarRating
                                                        value={itemAnnotation.rating}
                                                        colorClass="text-amber-400"
                                                        disabled={!userEmail || isItemSaving}
                                                        onSelect={(value) =>
                                                            onSaveAnnotation(item.id, {
                                                                ...itemAnnotation,
                                                                rating: value,
                                                            })
                                                        }
                                                    />
                                                </div>

                                                <div>
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
                                                        Performer Rating
                                                    </div>
                                                    <StarRating
                                                        value={itemAnnotation.performanceRating}
                                                        colorClass="text-emerald-400"
                                                        disabled={!userEmail || isItemSaving}
                                                        onSelect={(value) =>
                                                            onSaveAnnotation(item.id, {
                                                                ...itemAnnotation,
                                                                performanceRating: value,
                                                            })
                                                        }
                                                    />
                                                    <div className="mt-3 text-xs text-slate-400">
                                                        {isItemSaving ? 'Saving changes...' : 'Saved automatically'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
