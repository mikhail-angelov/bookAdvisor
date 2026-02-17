'use client';

import { useState, useEffect } from 'react';
import { Torrent, UserAnnotation } from '@/lib/store';
import { StarRating } from './StarRating';

interface AnnotationDialogProps {
  torrent: Torrent;
  annotation: UserAnnotation | undefined;
  onSave: (data: { rating: number; annotation: string; readStatus: string }) => void;
  onClose: () => void;
  onDelete?: () => void;
}

type Tab = 'details' | 'annotations';

export function AnnotationDialog({
  torrent: initialTorrent,
  annotation,
  onSave,
  onClose,
  onDelete,
}: AnnotationDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [rating, setRating] = useState(annotation?.rating || 0);
  const [note, setNote] = useState(annotation?.annotation || '');
  const [readStatus, setReadStatus] = useState(annotation?.read_status || 'unread');
  const [torrent, setTorrent] = useState<Torrent>(initialTorrent);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch detailed torrent information when dialog opens
  useEffect(() => {
    const fetchDetails = async () => {
      // If we already have detailed fields, skip fetch
      if (torrent.details_url !== undefined) return;
      
      setLoadingDetails(true);
      try {
        const response = await fetch(`/api/torrents/${torrent.topic_id}`);
        if (response.ok) {
          const data = await response.json();
          setTorrent(data);
        }
      } catch (error) {
        console.error('Failed to fetch torrent details:', error);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [torrent.topic_id]);

  const handleSave = () => {
    onSave({ rating, annotation: note, readStatus });
  };

  const renderDetailsTab = () => {
    if (loadingDetails) {
      return (
        <div className="py-8 text-center">
          <div className="animate-pulse flex items-center justify-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-gray-500">Loading details...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-lg p-3">
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

        {/* Detailed fields (if available) */}
        {(torrent.description || torrent.details_size || torrent.magnet_link) && (
          <div className="border-t border-gray-100 pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Extended Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {torrent.details_size && (
                <div>
                  <span className="text-gray-500 block">Details Size</span>
                  <span className="font-medium text-gray-900">{torrent.details_size}</span>
                </div>
              )}
              {torrent.category && (
                <div>
                  <span className="text-gray-500 block">Category</span>
                  <span className="font-medium text-gray-900">{torrent.category}</span>
                </div>
              )}
              {torrent.forum_name && (
                <div>
                  <span className="text-gray-500 block">Forum</span>
                  <span className="font-medium text-gray-900">{torrent.forum_name}</span>
                </div>
              )}
              {torrent.year && (
                <div>
                  <span className="text-gray-500 block">Year</span>
                  <span className="font-medium text-gray-900">{torrent.year}</span>
                </div>
              )}
              {torrent.author_name && (
                <div>
                  <span className="text-gray-500 block">Author (profile)</span>
                  <span className="font-medium text-gray-900">{torrent.author_name}</span>
                </div>
              )}
              {torrent.performer && (
                <div>
                  <span className="text-gray-500 block">Performer</span>
                  <span className="font-medium text-gray-900">{torrent.performer}</span>
                </div>
              )}
              {torrent.series && (
                <div>
                  <span className="text-gray-500 block">Series</span>
                  <span className="font-medium text-gray-900">{torrent.series}</span>
                </div>
              )}
            </div>
            
            {torrent.description && (
              <div className="mt-4">
                <span className="text-gray-500 block text-sm mb-1">Description</span>
                <div className="text-sm text-gray-700 bg-gray-50 rounded p-3 max-h-40 overflow-y-auto">
                  {torrent.description}
                </div>
              </div>
            )}
            
            {torrent.magnet_link && (
              <div className="mt-4">
                <span className="text-gray-500 block text-sm mb-1">Magnet Link</span>
                <div className="text-sm text-blue-600 truncate bg-gray-50 rounded p-2">
                  <a href={torrent.magnet_link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {torrent.magnet_link}
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAnnotationsTab = () => (
    <div className="space-y-4">
      <div className="border-t border-gray-100 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
        <StarRating rating={rating} onChange={setRating} size="lg" />
      </div>

      <div className="border-t border-gray-100 pt-4">
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

      <div className="border-t border-gray-100 pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add your notes about this book..."
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Torrent Details</h2>
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'details'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('annotations')}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'annotations'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Annotations
                </button>
              </div>
            </div>
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

          {activeTab === 'details' ? renderDetailsTab() : renderAnnotationsTab()}

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
              {activeTab === 'annotations' && (
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
