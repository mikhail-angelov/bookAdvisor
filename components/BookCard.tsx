'use client';

import { Book } from '@/db/schema';
import Link from 'next/link';

interface BookCardProps {
    book: Book;
}

export default function BookCard({ book }: BookCardProps) {
    return (
        <Link
            href={`/books/${book.id}`}
            className="group block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:-translate-y-1"
        >
            <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                        {book.category}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                        {book.size}
                    </span>
                </div>

                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-1">
                    {book.title}
                </h3>

                <p className="text-sm text-gray-500 mb-4 line-clamp-1">
                    {book.authorName || 'Unknown Author'}
                </p>

                <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
                    <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" />
                        </svg>
                        <span className="text-gray-600">{book.seeds}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 012 2v9l-5-4.5L5 22v-9a2 2 0 01-2-2V5z" />
                        </svg>
                        <span>{book.year || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div className="h-1 w-full bg-gray-50 group-hover:bg-blue-600 transition-colors" />
        </Link>
    );
}
