interface CrawlerControlsProps {
  forumId: string;
  maxPages: string;
  isRunning: boolean;
  reparsing?: boolean;
  onForumIdChange: (value: string) => void;
  onMaxPagesChange: (value: string) => void;
  onStart: () => void;
  onStop: () => void;
  onReparse?: () => void;
}

export function CrawlerControls({
  forumId,
  maxPages,
  isRunning,
  reparsing = false,
  onForumIdChange,
  onMaxPagesChange,
  onStart,
  onStop,
  onReparse,
}: CrawlerControlsProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 p-5">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Forum ID
            </label>
            <input
              type="text"
              value={forumId}
              onChange={(e) => onForumIdChange(e.target.value)}
              disabled={isRunning}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              placeholder="2387"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Max Pages
            </label>
            <input
              type="text"
              value={maxPages}
              onChange={(e) => onMaxPagesChange(e.target.value)}
              disabled={isRunning}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              placeholder="10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={isRunning ? onStop : onStart}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-all shadow-sm ${
              isRunning
                ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                Stop Crawl
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Start Crawl
              </span>
            )}
          </button>
          {onReparse && (
            <button
              onClick={onReparse}
              disabled={isRunning || reparsing}
              className={`px-4 py-2.5 rounded-lg font-semibold transition-all shadow-sm ${
                isRunning || reparsing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
              }`}
              title="Reparse crawled pages to update data with current parser"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                {reparsing ? 'Reparsing...' : 'Reparse'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
