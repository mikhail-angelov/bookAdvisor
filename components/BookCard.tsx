'use client';

import { Book } from '@/db/schema';

interface BookCardProps {
    book: Book;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function BookCard({ book }: BookCardProps) {
    return (
        <tr
            className="group hover:bg-blue-50/50 transition-colors cursor-pointer"
            onClick={() => { window.location.href = `/books/${book.id}`; }}
        >
            {/* Title */}
            <td className="px-5 py-3 font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                <span className="line-clamp-1">{book.title}</span>
            </td>

            {/* Genre */}
            <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                <span className="line-clamp-1">{book.genre || '—'}</span>
            </td>

            {/* Seeds */}
            <td className="px-4 py-3 text-center hidden sm:table-cell">
                <span className="inline-flex items-center gap-1 text-gray-600">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" />
                    </svg>
                    {book.seeds ?? '—'}
                </span>
            </td>

            {/* Downloads */}
            <td className="px-4 py-3 text-center text-gray-500 hidden sm:table-cell">
                {book.downloads ?? '—'}
            </td>

            {/* Last Comment */}
            <td className="px-5 py-3 text-right text-gray-400 hidden lg:table-cell whitespace-nowrap">
                {formatDate(book.lastCommentDate)}
            </td>
        </tr>
    );
}
