interface ProgressBarProps {
  progress: number;
  torrentsFound: number;
}

export function ProgressBar({ progress, torrentsFound }: ProgressBarProps) {
  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
      <div className="flex justify-between text-sm mb-2">
        <span className="font-medium text-blue-900">Progress</span>
        <span className="text-blue-700">{progress}%</span>
      </div>
      <div className="h-2.5 bg-blue-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-sm">
        <span className="text-blue-700">
          <span className="font-medium">{torrentsFound}</span> torrents found
        </span>
      </div>
    </div>
  );
}
