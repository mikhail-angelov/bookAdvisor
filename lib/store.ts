import { create } from 'zustand';

export interface Torrent {
  id: string;
  topic_id: string;
  url: string;
  title: string;
  forum_id: number;
  size: string;
  seeds: number;
  leechers: number;
  downloads: number;
  comments_count: number;
  last_comment_date: string;
  author: string;
  created_at: string;
  last_updated: string;
  status: string;
  // Optional detailed fields from topic page
  details_url?: string | null;
  description?: string | null;
  category?: string | null;
  forum_name?: string | null;
  registered_until?: string | null;
  details_seeders?: number | null;
  last_checked?: string | null;
  magnet_link?: string | null;
  torrent_file?: string | null;
  details_size?: string | null;
  author_name?: string | null;
  author_posts?: number | null;
  topic_title?: string | null;
  year?: number | null;
  author_first_name?: string | null;
  author_last_name?: string | null;
  performer?: string | null;
  series?: string | null;
  book_number?: string | null;
  genre?: string | null;
  edition_type?: string | null;
  audio_codec?: string | null;
  bitrate?: string | null;
  duration?: string | null;
}

export interface UserAnnotation {
  id: string;
  user_id: string;
  torrent_id: string | null;
  rating: number | null;
  annotation: string | null;
  read_status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface User {
  id: string;
  email: string;
  username: string;
}

interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;
  
  // Torrents
  torrents: Torrent[];
  setTorrents: (torrents: Torrent[]) => void;
  selectedTorrent: Torrent | null;
  setSelectedTorrent: (torrent: Torrent | null) => void;
  
  // Annotations
  annotations: UserAnnotation[];
  setAnnotations: (annotations: UserAnnotation[]) => void;
  addAnnotation: (annotation: UserAnnotation) => void;
  updateAnnotation: (torrentId: string, updates: Partial<UserAnnotation>) => void;
  removeAnnotation: (torrentId: string) => void;
  
  // Filters
  search: string;
  setSearch: (search: string) => void;
  sortBy: 'title' | 'seeds' | 'downloads' | 'size' | 'last_updated';
  setSortBy: (sort: 'title' | 'seeds' | 'downloads' | 'size' | 'last_updated') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  forumFilter: number | null;
  setForumFilter: (forumId: number | null) => void;
  
  // UI
  activeTab: 'all' | 'mybooks';
  setActiveTab: (tab: 'all' | 'mybooks') => void;
  showAnnotationDialog: boolean;
  setShowAnnotationDialog: (show: boolean) => void;
  
  // Pagination
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  setTotalPages: (pages: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),
  
  // Torrents
  torrents: [],
  setTorrents: (torrents) => set({ torrents }),
  selectedTorrent: null,
  setSelectedTorrent: (torrent) => set({ selectedTorrent: torrent, showAnnotationDialog: !!torrent }),
  
  // Annotations
  annotations: [],
  setAnnotations: (annotations) => set({ annotations }),
  addAnnotation: (annotation) => set((state) => ({ 
    annotations: [...state.annotations, annotation] 
  })),
  updateAnnotation: (torrentId, updates) => set((state) => ({
    annotations: state.annotations.map(a => 
      a.torrent_id === torrentId ? { ...a, ...updates } : a
    )
  })),
  removeAnnotation: (torrentId) => set((state) => ({
    annotations: state.annotations.filter(a => a.torrent_id !== torrentId)
  })),
  
  // Filters
  search: '',
  setSearch: (search) => set({ search }),
  sortBy: 'last_updated',
  setSortBy: (sortBy) => set({ sortBy }),
  sortOrder: 'desc',
  setSortOrder: (sortOrder) => set({ sortOrder }),
  forumFilter: null,
  setForumFilter: (forumFilter) => set({ forumFilter }),
  
  // UI
  activeTab: 'all',
  setActiveTab: (activeTab) => set({ activeTab }),
  showAnnotationDialog: false,
  setShowAnnotationDialog: (showAnnotationDialog) => set({ showAnnotationDialog }),
  
  // Pagination
  page: 1,
  setPage: (page) => set({ page }),
  totalPages: 1,
  setTotalPages: (totalPages) => set({ totalPages }),
}));
