export type BookNavigationSource = 'books' | 'recommendations';

export interface BookNavigationSnapshot {
  key: string;
  source: BookNavigationSource;
  ids: string[];
  returnHref: string;
  createdAt: number;
}

export interface BookNavigationNeighbors {
  prevId: string | null;
  nextId: string | null;
  source: BookNavigationSource;
  returnHref: string;
}

const MAX_SNAPSHOTS = 30;
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

class BookNavigationCacheService {
  private snapshots = new Map<string, BookNavigationSnapshot>();
  private sequence = 0;

  save(source: BookNavigationSource, ids: string[], returnHref: string): string | null {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return null;
    }

    this.prune();

    const key = `${source}:${Date.now()}:${this.sequence++}`;
    this.snapshots.set(key, {
      key,
      source,
      ids: uniqueIds,
      returnHref,
      createdAt: Date.now(),
    });

    if (this.snapshots.size > MAX_SNAPSHOTS) {
      const oldestKey = this.snapshots.keys().next().value;
      if (oldestKey) {
        this.snapshots.delete(oldestKey);
      }
    }

    return key;
  }

  get(key: string | null | undefined): BookNavigationSnapshot | null {
    if (!key) {
      return null;
    }

    const snapshot = this.snapshots.get(key);
    if (!snapshot) {
      return null;
    }

    if (Date.now() - snapshot.createdAt > SNAPSHOT_TTL_MS) {
      this.snapshots.delete(key);
      return null;
    }

    return snapshot;
  }

  getNeighbors(key: string | null | undefined, currentBookId: string): BookNavigationNeighbors | null {
    const snapshot = this.get(key);
    if (!snapshot) {
      return null;
    }

    const index = snapshot.ids.indexOf(currentBookId);
    if (index === -1) {
      return null;
    }

    return {
      prevId: snapshot.ids[index - 1] ?? null,
      nextId: snapshot.ids[index + 1] ?? null,
      source: snapshot.source,
      returnHref: snapshot.returnHref,
    };
  }

  clear(): void {
    this.snapshots.clear();
    this.sequence = 0;
  }

  private prune(): void {
    const now = Date.now();
    this.snapshots.forEach((snapshot, key) => {
      if (now - snapshot.createdAt > SNAPSHOT_TTL_MS) {
        this.snapshots.delete(key);
      }
    });
  }
}

export const bookNavigationCache = new BookNavigationCacheService();
