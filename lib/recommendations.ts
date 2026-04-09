export type AffinityBand = 'positive' | 'mixed' | 'neutral' | 'negative';

export interface AuthorAffinityStats {
  interactionCount: number;
  netSentiment: number;
  avgSentiment: number;
  dropCount: number;
}

export function toAuthorSentiment(annotation: { rating: number; readStatus: string | null }): number | null {
  if (annotation.rating >= 1) {
    return { 1: -2, 2: -1, 3: 0, 4: 1, 5: 2 }[annotation.rating] ?? null;
  }

  if (annotation.readStatus === 'dropped') {
    return -2;
  }

  return null;
}

export function getAuthorAffinityBand(stats: Pick<AuthorAffinityStats, 'netSentiment' | 'interactionCount'>): AffinityBand {
  const avg = stats.interactionCount > 0 ? stats.netSentiment / stats.interactionCount : 0;

  if (avg >= 1.25) return 'positive';
  if (avg > 0) return 'mixed';
  if (avg <= -1) return 'negative';
  return 'neutral';
}

export function getPopularityWeightMultiplier(totalSignals: number): number {
  if (totalSignals <= 1) return 1.35;
  if (totalSignals <= 3) return 1.15;
  return 1;
}

export function applyAuthorDiversityCap<T extends { authorName: string | null }>(
  books: T[],
  limit: number,
  maxPerAuthor: number,
): T[] {
  const seen = new Map<string, number>();
  const result: T[] = [];

  for (const book of books) {
    const key = (book.authorName ?? '').trim().toLowerCase() || `__unknown__:${result.length}`;
    const count = seen.get(key) ?? 0;

    if (count >= maxPerAuthor) {
      continue;
    }

    seen.set(key, count + 1);
    result.push(book);

    if (result.length === limit) {
      break;
    }
  }

  return result;
}
