'use client';

import { Torrent, UserAnnotation } from '@/lib/store';

interface TorrentTableProps {
  torrents: Torrent[];
  annotations: UserAnnotation[];
  onTorrentClick: (torrent: Torrent) => void;
  loading?: boolean;
}

export function TorrentTable({ torrents, annotations, onTorrentClick, loading }: TorrentTableProps) {
  const getAnnotation = (topicId: string) => {
    return annotations.find((a) => a.torrent_id === topicId);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-pulse flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-gray-500">Loading torrents...</span>
          </div>
        </div>
      </div>
    );
  }

  if (torrents.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 text-lg">No torrents found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your search or start a new crawl</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Size</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Seeds</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Leechers</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Downloads</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Author</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {torrents.map((torrent) => {
              const annotation = getAnnotation(torrent.topic_id);
              return (
                <tr
                  key={torrent.id}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  onClick={() => onTorrentClick(torrent)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {annotation?.rating ? (
                        <span className="text-yellow-500 flex-shrink-0">★</span>
                      ) : null}
                      <span
                        className="truncate max-w-xs text-gray-900 font-medium group-hover:text-blue-700"
                        title={torrent.title}
                      >
                        {torrent.title}
                      </span>
                      {annotation?.read_status && annotation.read_status !== 'unread' && (
                        <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                          annotation.read_status === 'reading' 
                            ? 'bg-yellow-100 text-yellow-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {annotation.read_status === 'reading' ? '📖' : '✓'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{torrent.size}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600 whitespace-nowrap">{torrent.seeds}</td>
                  <td className="px-4 py-3 text-sm text-red-500 whitespace-nowrap">{torrent.leechers}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{torrent.downloads}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-24" title={torrent.author}>
                    {torrent.author}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={torrent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
