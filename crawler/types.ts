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

export interface FetchResult {
  url: string;
  html: string;
  status: number;
  contentType?: string;
  encoding?: string;
  error?: string;
}
