'use client';

import { Suspense, useState, useEffect, useRef, useMemo, useCallback, startTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '@/lib/store';
// bundle-barrel-imports: Import directly to avoid barrel file overhead
import { Header } from './components/Header';
import { StatsGrid } from './components/StatsCard';
import { CrawlerControls } from './components/CrawlerControls';
import { ProgressBar } from './components/ProgressBar';
import { TabNavigation } from './components/TabNavigation';
import { SearchBar } from './components/SearchBar';
import { TorrentTable } from './components/TorrentTable';
import { Pagination } from './components/Pagination';
import { CrawlHistory } from './components/CrawlHistory';
import { AnnotationDialog } from './components/AnnotationDialog';

interface CrawlerStatus {
  isRunning: boolean;
  currentPage: number;
  totalPages: number;
  torrentsFound: number;
  errors: string[];
  duration: number;
}

interface CrawlHistoryItem {
  id: string;
  forum_id: number;
  pages_crawled: number;
  torrents_found: number;
  started_at: string;
  completed_at: string | null;
  status: string;
}

function HomeContent() {
  // Zustand store
  const store = useAppStore();
  const {
    user,
    setUser,
    torrents,
    setTorrents,
    selectedTorrent,
    setSelectedTorrent,
    annotations,
    setAnnotations,
    search,
    setSearch,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    activeTab,
    setActiveTab,
    showAnnotationDialog,
    setShowAnnotationDialog,
    page,
    setPage,
    totalPages,
    setTotalPages,
  } = store;

  // Local state
  const [status, setStatus] = useState<CrawlerStatus>({
    isRunning: false,
    currentPage: 0,
    totalPages: 0,
    torrentsFound: 0,
    errors: [],
    duration: 0,
  });
  const [history, setHistory] = useState<CrawlHistoryItem[]>([]);
  const [forumId, setForumId] = useState("2387");
  const [maxPages, setMaxPages] = useState("3");
  const [loading, setLoading] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // rerender-transitions: Use startTransition for non-urgent state updates
  const handleSetSearch = useCallback((value: string) => {
    startTransition(() => {
      setSearch(value);
    });
  }, [setSearch]);

  const handleSetSortBy = useCallback((value: string) => {
    startTransition(() => {
      setSortBy(value as any);
    });
  }, [setSortBy]);

  const handleSetSortOrder = useCallback((value: string) => {
    startTransition(() => {
      setSortOrder(value as any);
    });
  }, [setSortOrder]);

  const handleSetActiveTab = useCallback((tab: 'all' | 'mybooks') => {
    startTransition(() => {
      setActiveTab(tab);
    });
  }, [setActiveTab]);

  const handleSetPage = useCallback((newPage: number) => {
    startTransition(() => {
      setPage(newPage);
    });
  }, [setPage]);

  // Check for auth on mount and handle login redirect
  useEffect(() => {
    // Handle login redirect
    if (searchParams.get("logged_in") === "true") {
      console.log('[Auth] Login redirect detected');
      toast.success("Successfully logged in!");
      // Remove query param without reload
      router.replace("/", { scroll: false });
    }

    // Verify session with backend
    const checkAuth = async () => {
      try {
        console.log('[Auth] Checking authentication...');
        const res = await fetch("/api/auth/me", { credentials: 'include' });
        const data = await res.json();
        console.log('[Auth] Response:', data);
        if (data.authenticated && data.user) {
          console.log('[Auth] Setting user:', data.user);
          setUser(data.user);
        } else {
          console.log('[Auth] Not authenticated, clearing cookies and user state');
          setUser(null);
          // Clear invalid cookies
          document.cookie =
            "user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          document.cookie =
            "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        }
      } catch (err) {
        console.error("[Auth] Auth check failed:", err);
      }
    };

    checkAuth();
  }, [searchParams, setUser]);

  // Connect to socket.io
  useEffect(() => {
    socketRef.current = io({
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("crawlerStatus", (newStatus: CrawlerStatus) => {
      setStatus(newStatus);
    });

    fetchStatus();
    fetchHistory();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Debug user state changes
  useEffect(() => {
    console.log('[Auth] User state changed:', user);
  }, [user]);

  // Fetch torrents when page/search/sort changes
  useEffect(() => {
    fetchTorrents();
  }, [page, search, sortBy, sortOrder]);

  // Fetch annotations when user is logged in
  useEffect(() => {
    if (user) {
      fetchAnnotations();
    }
  }, [user]);

  // rerender-defer-reads: Define fetch functions with useCallback
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/crawl/status");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Error fetching status:", err);
    }
  }, []);

  const fetchTorrents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        sort: sortBy,
        order: sortOrder,
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/torrents?${params}`);
      const data = await res.json();
      setTorrents(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      console.error("Error fetching torrents:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortOrder, setTorrents, setTotalPages]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history?limit=10");
      const data = await res.json();
      setHistory(data.data || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  }, []);

  const fetchAnnotations = useCallback(async () => {
    try {
      const res = await fetch("/api/annotations");
      const data = await res.json();
      setAnnotations(data.data || []);
    } catch (err) {
      console.error("Error fetching annotations:", err);
    }
  }, [setAnnotations]);

  const handleLogin = useCallback(async (email: string) => {
    if (!email) return;

    setSendingMagicLink(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      toast.success(data.message || "Check your email for the magic link!");
    } catch (err) {
      console.error("Login error:", err);
    } finally {
      setSendingMagicLink(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    document.cookie =
      "user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie =
      "auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setUser(null);
  }, [setUser]);

  const startCrawl = useCallback(async () => {
    try {
      await fetch("/api/crawl/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forumId: parseInt(forumId),
          maxPages: parseInt(maxPages),
        }),
      });
      fetchStatus();
    } catch (err) {
      console.error("Error starting crawl:", err);
    }
  }, [forumId, maxPages, fetchStatus]);

  const stopCrawl = useCallback(async () => {
    try {
      await fetch("/api/crawl/stop", { method: "POST" });
      fetchStatus();
    } catch (err) {
      console.error("Error stopping crawl:", err);
    }
  }, [fetchStatus]);

  const reparseCrawl = useCallback(async () => {
    setReparsing(true);
    try {
      const response = await fetch("/api/crawl/reparse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forumId: parseInt(forumId),
        }),
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(`Reparse completed: ${result.torrentsUpdated} torrents updated`);
        // Refresh torrents data
        fetchTorrents();
      } else {
        toast.error(`Reparse failed: ${result.error}`);
      }
    } catch (err) {
      console.error("Error reparsing crawl:", err);
      toast.error("Failed to reparse crawl data");
    } finally {
      setReparsing(false);
    }
  }, [forumId, fetchTorrents]);

  const handleSaveAnnotation = useCallback(async (data: {
    rating: number;
    annotation: string;
    readStatus: string;
  }) => {
    if (!selectedTorrent || !user) return;

    try {
      const res = await fetch(`/api/annotations/${selectedTorrent.topic_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.data) {
        // Update local annotations
        const existing = annotations.find(
          (a) => a.torrent_id === selectedTorrent.topic_id,
        );
        if (existing) {
          store.updateAnnotation(selectedTorrent.topic_id, result.data);
        } else {
          store.addAnnotation(result.data);
        }
      }
      setShowAnnotationDialog(false);
    } catch (err) {
      console.error("Error saving annotation:", err);
    }
  }, [selectedTorrent, user, annotations, store, setShowAnnotationDialog]);

  const handleDeleteAnnotation = useCallback(async () => {
    if (!selectedTorrent || !user) return;

    try {
      await fetch(`/api/annotations/${selectedTorrent.topic_id}`, {
        method: "DELETE",
      });
      store.removeAnnotation(selectedTorrent.topic_id);
      setShowAnnotationDialog(false);
    } catch (err) {
      console.error("Error deleting annotation:", err);
    }
  }, [selectedTorrent, user, store, setShowAnnotationDialog]);

  // js-early-exit: Return early for formatDuration
  const formatDuration = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }, []);

  // Filter torrents for "My Books" tab
  const myBooks = useMemo(() => {
    if (activeTab !== "mybooks") return torrents;
    // js-set-map-lookups: Use Set for O(1) lookups
    const annotatedIds = new Set(annotations.map((a) => a.torrent_id));
    return torrents.filter((t) => annotatedIds.has(t.topic_id));
  }, [torrents, annotations, activeTab]);

  // Get annotation for a torrent
  const getAnnotation = useCallback((topicId: string) => {
    return annotations.find((a) => a.torrent_id === topicId);
  }, [annotations]);

  const progress =
    status.totalPages > 0
      ? Math.round((status.currentPage / status.totalPages) * 100)
      : 0;

  // js-hoist-regexp: Hoist regex outside component if needed (not needed here)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        sendingMagicLink={sendingMagicLink}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <StatsGrid
          totalTorrents={torrents.length}
          currentPage={status.currentPage}
          totalPages={status.totalPages}
          duration={formatDuration(status.duration)}
          isRunning={status.isRunning}
        />

        <CrawlerControls
          forumId={forumId}
          maxPages={maxPages}
          isRunning={status.isRunning}
          reparsing={reparsing}
          onForumIdChange={setForumId}
          onMaxPagesChange={setMaxPages}
          onStart={startCrawl}
          onStop={stopCrawl}
          onReparse={reparseCrawl}
        />

        {status.isRunning && (
          <ProgressBar
            progress={progress}
            torrentsFound={status.torrentsFound}
          />
        )}

        <TabNavigation 
          activeTab={activeTab} 
          onTabChange={handleSetActiveTab} 
        />

        <SearchBar
          search={search}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSearchChange={handleSetSearch}
          onSortByChange={handleSetSortBy}
          onSortOrderChange={handleSetSortOrder}
          onSearch={() => handleSetPage(1)}
        />

        <TorrentTable
          torrents={myBooks}
          annotations={annotations}
          onTorrentClick={setSelectedTorrent}
          loading={loading}
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={handleSetPage}
        />

        <CrawlHistory history={history} />
      </main>

      {/* Annotation Dialog */}
      {showAnnotationDialog && selectedTorrent && user && (
        <AnnotationDialog
          torrent={selectedTorrent}
          annotation={getAnnotation(selectedTorrent.topic_id)}
          onSave={handleSaveAnnotation}
          onClose={() => setShowAnnotationDialog(false)}
          onDelete={handleDeleteAnnotation}
        />
      )}

      {/* Login prompt for annotation */}
      {showAnnotationDialog && selectedTorrent && !user && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md">
            <h2 className="text-xl font-semibold mb-3">Sign in Required</h2>
            <p className="text-gray-600 mb-4">
              Please sign in to add annotations and track your books.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin(loginEmail);
              }}
              className="flex gap-2"
            >
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Your email"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2"
                required
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Send Link
              </button>
            </form>
            <button
              onClick={() => setShowAnnotationDialog(false)}
              className="mt-3 w-full text-center text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeContent />
    </Suspense>
  );
}
