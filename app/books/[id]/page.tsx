'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Book, UserAnnotation } from '@/db/schema';
import { toast } from 'sonner';
import Link from 'next/link';

export default function BookDetailsPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [book, setBook] = useState<Book | null>(null);
    const [annotation, setAnnotation] = useState<Partial<UserAnnotation>>({
        annotation: '',
        rating: 0,
        readStatus: 'unread'
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

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

                // Fetch annotation
                const annRes = await fetch(`/api/books/${params.id}/annotation`);
                const annData = await annRes.json();
                if (annData.annotation) {
                    setAnnotation(annData.annotation);
                }
            } catch (error) {
                toast.error('Error loading data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [params.id, router]);

    const handleSaveAnnotation = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/books/${params.id}/annotation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(annotation),
            });

            if (!res.ok) throw new Error('Failed to save');

            toast.success('Annotation saved!');
        } catch (error) {
            toast.error('Error saving annotation');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!book) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-20">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <Link href="/books" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-medium text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Library
                    </Link>
                    <h1 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Book Details</h1>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-10">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-white">
                    <div className="md:flex">
                        {/* Book Info */}
                        <div className="p-8 md:p-12 md:w-2/3 border-b md:border-b-0 md:border-r border-gray-50">
                            <div className="mb-6">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100 mb-4">
                                    {book.category}
                                </span>
                                <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight mb-2">
                                    {book.title}
                                </h2>
                                <p className="text-lg text-gray-500 font-medium">by {book.authorName || 'Unknown Author'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Series</h4>
                                    <p className="font-semibold text-gray-700">{book.series || 'None'}</p>
                                    {book.bookNumber && <p className="text-sm text-gray-500">Book #{book.bookNumber}</p>}
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Year</h4>
                                    <p className="font-semibold text-gray-700">{book.year || 'N/A'}</p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Genre</h4>
                                    <p className="font-semibold text-gray-700">{book.genre || 'N/A'}</p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Size / Downloads</h4>
                                    <p className="font-semibold text-gray-700">{book.size} / {book.downloads}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-6">
                                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Topic Link
                                </h3>
                                <a
                                    href={book.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-medium break-all"
                                >
                                    {book.url}
                                </a>
                            </div>
                        </div>

                        {/* Annotation Panel */}
                        <div className="p-8 md:p-12 md:w-1/3 bg-blue-50/30">
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                My Annotation
                            </h3>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Read Status</label>
                                    <select
                                        value={annotation.readStatus || 'unread'}
                                        onChange={(e) => setAnnotation({ ...annotation, readStatus: e.target.value as any })}
                                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 transition-all"
                                    >
                                        <option value="unread">Not Read</option>
                                        <option value="reading">Reading</option>
                                        <option value="completed">Completed</option>
                                        <option value="dropped">Dropped</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Rating</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                onClick={() => setAnnotation({ ...annotation, rating: star })}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${(annotation.rating || 0) >= star ? 'bg-yellow-400 text-white shadow-md' : 'bg-white text-gray-300'
                                                    }`}
                                            >
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Notes</label>
                                    <textarea
                                        rows={6}
                                        value={annotation.annotation || ''}
                                        onChange={(e) => setAnnotation({ ...annotation, annotation: e.target.value })}
                                        placeholder="Add your personal notes about this book..."
                                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                                    />
                                </div>

                                <button
                                    onClick={handleSaveAnnotation}
                                    disabled={isSaving}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        'Save Annotation'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
