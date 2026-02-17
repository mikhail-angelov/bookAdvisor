'use client';

import { useState } from 'react';
import { Torrent, UserAnnotation } from '@/lib/store';
import { StarRating } from './StarRating';

interface AnnotationDialogProps {
  torrent: Torrent;
  annotation: UserAnnotation | undefined;
  onSave: (data: { rating: number; annotation: string; readStatus: string }) => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function AnnotationDialog({
  torrent,
  annotation,
  onSave,
  onClose,
  onDelete,
}: AnnotationDialogProps) {
  const [rating, setRating] = useState(annotation?.rating || 0);
  const [note, setNote] = useState(annotation?.annotation || '');
  const [readStatus, setReadStatus] = useState(annotation?.read_status || 'unread');

  const handleSave = () => {
    onSave({ rating, annotation: note, readStatus });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Book Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors"
            >
              ×
            </button>
          </div>

          <div className="mb-5">
            <h3 className="font-medium text-gray-900 line-clamp-2">{torrent.title}</h3>
            <p className="text-sm text-gray-500 mt-1">by {torrent.author}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5 text-sm bg-gray-50 rounded-lg p-3">
            <div>
              <span className="text-gray-500 block">Size</span>
              <span className="font-medium text-gray-900">{torrent.size}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Seeds</span>
              <span className="font-medium text-green-600">{torrent.seeds}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Leechers</span>
              <span className="font-medium text-red-500">{torrent.leechers}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Downloads</span>
              <span className="font-medium text-gray-900">{torrent.downloads}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Comments</span>
              <span className="font-medium text-gray-900">{torrent.comments_count}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Last Comment</span>
              <span className="font-medium text-gray-900">{torrent.last_comment_date}</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
            <StarRating rating={rating} onChange={setRating} size="lg" />
          </div>

          <div className="border-t border-gray-100 pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Read Status</label>
            <div className="flex gap-2">
              {['unread', 'reading', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setReadStatus(status)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    readStatus === status
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'unread' && '📚 Want to Read'}
                  {status === 'reading' && '📖 Reading'}
                  {status === 'completed' && '✓ Completed'}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add your notes about this book..."
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
            />
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
            <div>
              {annotation && (
                <button
                  onClick={onDelete}
                  className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                >
                  Delete Annotation
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
