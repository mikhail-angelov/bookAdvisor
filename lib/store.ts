import { create } from 'zustand';

export interface Torrent {
  id: string;
  topicId: string;
  url: string;
  title: string;
  forumId: number;
  size: string;
  seeds: number;
  leechers: number;
  downloads: number;
  commentsCount: number;
  lastCommentDate: string;
  author: string;
  createdAt: string;
  lastUpdated: string;
  status: string;
  // Optional detailed fields from topic page
  detailsUrl?: string | null;
  description?: string | null;
  category?: string | null;
  forumName?: string | null;
  registeredUntil?: string | null;
  detailsSeeders?: number | null;
  lastChecked?: string | null;
  magnetLink?: string | null;
  torrentFile?: string | null;
  detailsSize?: string | null;
  authorName?: string | null;
  authorPosts?: number | null;
  topicTitle?: string | null;
  year?: number | null;
  authorFirstName?: string | null;
  authorLastName?: string | null;
  performer?: string | null;
  series?: string | null;
  bookNumber?: string | null;
  genre?: string | null;
  editionType?: string | null;
  audioCodec?: string | null;
  bitrate?: string | null;
  duration?: string | null;
}

export interface UserAnnotation {
  id: string;
  userId: string;
  torrentId: string | null;
  rating: number | null;
  annotation: string | null;
  readStatus: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
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
       a.torrentId === torrentId ? { ...a, ...updates } : a
    )
  })),
  removeAnnotation: (torrentId) => set((state) => ({
       annotations: state.annotations.filter(a => a.torrentId !== torrentId)
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
