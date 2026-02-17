interface TabNavigationProps {
  activeTab: 'all' | 'mybooks';
  onTabChange: (tab: 'all' | 'mybooks') => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = [
    { id: 'all' as const, label: 'All Torrents', count: null },
    { id: 'mybooks' as const, label: 'My Books', count: null },
  ];

  return (
    <div className="flex gap-1 border-b border-gray-200 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-3 font-medium text-sm transition-all relative ${
            activeTab === tab.id
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
          )}
        </button>
      ))}
    </div>
  );
}
