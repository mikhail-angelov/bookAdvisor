'use client';

interface SearchBarProps {
  search: string;
  sortBy: string;
  sortOrder: string;
  onSearchChange: (value: string) => void;
  onSortByChange: (value: any) => void;
  onSortOrderChange: (value: any) => void;
  onSearch: () => void;
}

export function SearchBar({
  search,
  sortBy,
  sortOrder,
  onSearchChange,
  onSortByChange,
  onSortOrderChange,
  onSearch,
}: SearchBarProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 p-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="Search torrents..."
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="last_updated">Last Updated</option>
            <option value="title">Title</option>
            <option value="seeds">Seeds</option>
            <option value="downloads">Downloads</option>
            <option value="size">Size</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="desc">↓ Desc</option>
            <option value="asc">↑ Asc</option>
          </select>
          <button
            onClick={onSearch}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
}
