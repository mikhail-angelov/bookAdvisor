interface CrawlHistoryItem {
  id: string;
  forum_id: number;
  pages_crawled: number;
  torrents_found: number;
  started_at: string;
  completed_at: string | null;
  status: string;
}

interface CrawlHistoryProps {
  history: CrawlHistoryItem[];
}

export function CrawlHistory({ history }: CrawlHistoryProps) {
  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700',
      running: 'bg-blue-100 text-blue-700',
      stopped: 'bg-gray-100 text-gray-700',
    };
    const style = styles[status as keyof typeof styles] || styles.stopped;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Crawl History
        </h2>
      </div>
      {history.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          No crawl history yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Forum ID</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Pages</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Torrents</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Started</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{h.forum_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{h.pages_crawled}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{h.torrents_found}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(h.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(h.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
