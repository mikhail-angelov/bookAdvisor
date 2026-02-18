/**
 * Types for the standalone crawler service
 */

export interface CrawlConfig {
  forumId: number;
  pages: number;
  concurrentRequests?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export enum CrawlStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export enum CrawlType {
  FORUM_PAGE = 'torrents-page',
  TORRENT_DETAILS = 'torrent-details'
}

export interface CrawlProgress {
  totalPages: number;
  pagesFetched: number;
  torrentLinksFound: number;
  detailsPagesFetched: number;
  errors: number;
  startTime: Date;
  estimatedTimeRemaining?: number;
}

export interface FetchResult {
  url: string;
  html: string;
  status: number;
  contentType?: string;
  encoding?: string;
  error?: string;
}

export interface TorrentLink {
  url: string;
  topicId: string;
  title: string;
}