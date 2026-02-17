import type { ReactNode } from 'react';

interface StatsCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  status?: 'default' | 'success' | 'warning' | 'error';
}

export function StatsCard({ label, value, icon, status = 'default' }: StatsCardProps) {
  const statusClasses = {
    default: 'bg-white',
    success: 'bg-white border-green-500',
    warning: 'bg-white border-yellow-500',
    error: 'bg-white border-red-500',
  };

  return (
    <div className={`rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow ${statusClasses[status]}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        {icon && (
          <div className="text-gray-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatsGridProps {
  totalTorrents: number;
  currentPage: number;
  totalPages: number;
  duration: string;
  isRunning: boolean;
}

export function StatsGrid({ totalTorrents, currentPage, totalPages, duration, isRunning }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatsCard
        label="Total Torrents"
        value={totalTorrents}
      />
      <StatsCard
        label="Current Page"
        value={`${currentPage + 1} / ${totalPages || '-'}`}
      />
      <StatsCard
        label="Duration"
        value={duration}
      />
      <StatsCard
        label="Status"
        value={
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
            isRunning
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {isRunning ? (
              <>
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-1.5 animate-pulse" />
                Running
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-gray-400 rounded-full mr-1.5" />
                Idle
              </>
            )}
          </span>
        }
      />
    </div>
  );
}
