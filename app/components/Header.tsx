'use client';

import { User } from '@/lib/store';

interface HeaderProps {
  user: User | null;
  onLogin: (email: string) => void;
  onLogout: () => void;
  loginEmail: string;
  setLoginEmail: (email: string) => void;
  sendingMagicLink: boolean;
}

export function Header({
  user,
  onLogin,
  onLogout,
  loginEmail,
  setLoginEmail,
  sendingMagicLink,
}: HeaderProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(loginEmail);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Rutracker Crawler
            </h1>
          </div>

          {/* Auth Section */}
          {user ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <span className="text-white text-sm font-semibold">
                    {user.username
                      ? user.username.charAt(0).toUpperCase()
                      : user.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm text-gray-700 font-medium">
                  {user.username || user.email}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors px-3 py-1.5 rounded-md hover:bg-blue-50"
              >
                Logout
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Your email"
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-32 sm:w-40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                required
              />
              <button
                type="submit"
                disabled={sendingMagicLink}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {sendingMagicLink ? '...' : 'Login'}
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
