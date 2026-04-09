# Recommendation Affinity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace exact positive-author matching with net author affinity, preserve a modest downloads signal, and add a light author diversity cap so recommendation results feel broader without becoming random.

**Architecture:** Keep the API route as the orchestration layer and move the new scoring primitives into a small pure helper module. The route will build preferences from all annotations, gather candidates with genre/performer-first seeding plus limited author seeding, score each candidate using soft author affinity and a thin-profile popularity multiplier, then apply a final per-author diversity cap before returning results.

**Tech Stack:** Next.js route handlers, TypeScript, Drizzle ORM, Jest, ts-jest

---

## File Structure

**Create**

- `lib/recommendations.ts`
- `lib/__tests__/recommendations.test.ts`

**Modify**

- `app/api/recommendations/route.ts`
- `app/api/__tests__/recommendations.test.ts`
- `docs/superpowers/specs/2026-04-09-recommendation-affinity-design.md`

**Notes**

- The codebase uses the read status value `dropped` in [`lib/read-status.ts`](/Users/ma/repo/bookAdvisor/lib/read-status.ts#L1), so implementation should treat `dropped` as the concrete version of the spec’s earlier “drop” wording.
- Keep the response shape from [`app/api/recommendations/route.ts`](/Users/ma/repo/bookAdvisor/app/api/recommendations/route.ts) stable.
- Do not re-enable vector search in this plan.

### Task 1: Add Pure Recommendation Helper Tests

**Files:**
- Create: `lib/__tests__/recommendations.test.ts`
- Test: `lib/recommendations.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import {
  applyAuthorDiversityCap,
  getAuthorAffinityBand,
  getPopularityWeightMultiplier,
  toAuthorSentiment,
} from '../recommendations';

describe('recommendation helpers', () => {
  it('maps ratings and dropped status into sentiment values', () => {
    expect(toAuthorSentiment({ rating: 5, readStatus: 'read' })).toBe(2);
    expect(toAuthorSentiment({ rating: 2, readStatus: 'read' })).toBe(-1);
    expect(toAuthorSentiment({ rating: 0, readStatus: 'dropped' })).toBe(-2);
    expect(toAuthorSentiment({ rating: 1, readStatus: 'dropped' })).toBe(-2);
  });

  it('assigns mixed authors to the small-boost band', () => {
    expect(getAuthorAffinityBand({ netSentiment: 1, interactionCount: 2 })).toBe('mixed');
    expect(getAuthorAffinityBand({ netSentiment: 6, interactionCount: 2 })).toBe('positive');
    expect(getAuthorAffinityBand({ netSentiment: -3, interactionCount: 2 })).toBe('negative');
  });

  it('raises popularity influence for thin profiles only', () => {
    expect(getPopularityWeightMultiplier(0)).toBe(1.35);
    expect(getPopularityWeightMultiplier(2)).toBe(1.15);
    expect(getPopularityWeightMultiplier(8)).toBe(1);
  });

  it('keeps only two books per author when capping results', () => {
    const capped = applyAuthorDiversityCap(
      [
        { id: 'a1', authorName: 'Author A', score: 0.9 },
        { id: 'a2', authorName: 'Author A', score: 0.8 },
        { id: 'a3', authorName: 'Author A', score: 0.7 },
        { id: 'b1', authorName: 'Author B', score: 0.6 },
      ],
      3,
      2,
    );

    expect(capped.map((book) => book.id)).toEqual(['a1', 'a2', 'b1']);
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `npm test -- --runTestsByPath lib/__tests__/recommendations.test.ts`
Expected: FAIL with `Cannot find module '../recommendations'` or missing export errors.

- [ ] **Step 3: Write the minimal helper module**

```ts
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
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run: `npm test -- --runTestsByPath lib/__tests__/recommendations.test.ts`
Expected: PASS with `4 passed`.

- [ ] **Step 5: Commit the helper baseline**

```bash
git add lib/recommendations.ts lib/__tests__/recommendations.test.ts
git commit -m "test: add recommendation helper coverage"
```

### Task 2: Lock Route-Level Recommendation Behavior With Failing Tests

**Files:**
- Modify: `app/api/__tests__/recommendations.test.ts`
- Test: `app/api/recommendations/route.ts`

- [ ] **Step 1: Add failing route tests for affinity, dropped status, downloads, and diversity**

```ts
it('gives only a small author boost when the same author has mixed feedback', async () => {
  const db = await getAppDbAsync();

  await db.insert(bookSchema).values([
    {
      id: 'liked-a1',
      url: 'https://example.com/liked-a1',
      title: 'Author A Hit',
      authorName: 'Author A',
      genre: 'Fantasy',
      category: 'Fantasy',
      downloads: 50,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'dropped-a2',
      url: 'https://example.com/dropped-a2',
      title: 'Author A Miss',
      authorName: 'Author A',
      genre: 'Fantasy',
      category: 'Fantasy',
      downloads: 50,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'candidate-a3',
      url: 'https://example.com/candidate-a3',
      title: 'Author A Candidate',
      authorName: 'Author A',
      genre: 'Fantasy',
      category: 'Fantasy',
      downloads: 100,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'candidate-b1',
      url: 'https://example.com/candidate-b1',
      title: 'Author B Candidate',
      authorName: 'Author B',
      genre: 'Fantasy',
      category: 'Fantasy',
      downloads: 90,
      createdAt: new Date().toISOString(),
    },
  ]);

  await db.insert(userAnnotation).values([
    {
      id: 'ann-liked-a1',
      userId: testUserId,
      bookId: 'liked-a1',
      rating: 5,
      readStatus: 'read',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ann-dropped-a2',
      userId: testUserId,
      bookId: 'dropped-a2',
      rating: 0,
      readStatus: 'dropped',
      createdAt: new Date().toISOString(),
    },
  ]);

  const request = new NextRequest('http://localhost:3000/api/recommendations?limit=2', {
    headers: { cookie: `auth_token=${authToken}` },
  });
  const response = await GET(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.recommendations.map((book: any) => book.id)).toEqual(['candidate-a3', 'candidate-b1']);
  expect(data.recommendations[0].score - data.recommendations[1].score).toBeLessThan(0.15);
});

it('uses the rating instead of forced dropped sentiment when a dropped book is rated', async () => {
  const db = await getAppDbAsync();

  await db.insert(bookSchema).values([
    {
      id: 'rated-drop-source',
      url: 'https://example.com/rated-drop-source',
      title: 'Rated Drop Source',
      authorName: 'Author Rated',
      genre: 'Mystery',
      category: 'Mystery',
      downloads: 30,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'rated-drop-candidate',
      url: 'https://example.com/rated-drop-candidate',
      title: 'Rated Drop Candidate',
      authorName: 'Author Rated',
      genre: 'Mystery',
      category: 'Mystery',
      downloads: 35,
      createdAt: new Date().toISOString(),
    },
  ]);

  await db.insert(userAnnotation).values({
    id: 'ann-rated-drop-source',
    userId: testUserId,
    bookId: 'rated-drop-source',
    rating: 4,
    readStatus: 'dropped',
    createdAt: new Date().toISOString(),
  });

  const request = new NextRequest('http://localhost:3000/api/recommendations?limit=1', {
    headers: { cookie: `auth_token=${authToken}` },
  });
  const response = await GET(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.recommendations[0].id).toBe('rated-drop-candidate');
  expect(data.recommendations[0].reasons).toContain('Author affinity: mixed');
});

it('lets downloads break near-ties and matter more for thin histories', async () => {
  const db = await getAppDbAsync();

  await db.insert(bookSchema).values([
    {
      id: 'history-source',
      url: 'https://example.com/history-source',
      title: 'History Source',
      authorName: 'Source Author',
      genre: 'Sci-Fi',
      category: 'Sci-Fi',
      downloads: 20,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'high-download',
      url: 'https://example.com/high-download',
      title: 'High Download Candidate',
      authorName: 'Candidate Author A',
      genre: 'Sci-Fi',
      category: 'Sci-Fi',
      downloads: 5000,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'low-download',
      url: 'https://example.com/low-download',
      title: 'Low Download Candidate',
      authorName: 'Candidate Author B',
      genre: 'Sci-Fi',
      category: 'Sci-Fi',
      downloads: 50,
      createdAt: new Date().toISOString(),
    },
  ]);

  await db.insert(userAnnotation).values({
    id: 'ann-history-source',
    userId: testUserId,
    bookId: 'history-source',
    rating: 5,
    readStatus: 'read',
    createdAt: new Date().toISOString(),
  });

  const request = new NextRequest('http://localhost:3000/api/recommendations?limit=2', {
    headers: { cookie: `auth_token=${authToken}` },
  });
  const response = await GET(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.recommendations[0].id).toBe('high-download');
  expect(data.recommendations[0].reasons).toContain('Popular with readers');
});

it('caps final results to two books per author', async () => {
  const db = await getAppDbAsync();

  await db.insert(bookSchema).values([
    {
      id: 'seed-1',
      url: 'https://example.com/seed-1',
      title: 'Seed 1',
      authorName: 'Seed Author',
      genre: 'Adventure',
      category: 'Adventure',
      downloads: 20,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'author-a-1',
      url: 'https://example.com/author-a-1',
      title: 'Author A 1',
      authorName: 'Author A',
      genre: 'Adventure',
      category: 'Adventure',
      downloads: 1000,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'author-a-2',
      url: 'https://example.com/author-a-2',
      title: 'Author A 2',
      authorName: 'Author A',
      genre: 'Adventure',
      category: 'Adventure',
      downloads: 900,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'author-a-3',
      url: 'https://example.com/author-a-3',
      title: 'Author A 3',
      authorName: 'Author A',
      genre: 'Adventure',
      category: 'Adventure',
      downloads: 800,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'author-b-1',
      url: 'https://example.com/author-b-1',
      title: 'Author B 1',
      authorName: 'Author B',
      genre: 'Adventure',
      category: 'Adventure',
      downloads: 700,
      createdAt: new Date().toISOString(),
    },
  ]);

  await db.insert(userAnnotation).values({
    id: 'ann-seed-1',
    userId: testUserId,
    bookId: 'seed-1',
    rating: 5,
    readStatus: 'read',
    createdAt: new Date().toISOString(),
  });

  const request = new NextRequest('http://localhost:3000/api/recommendations?limit=4', {
    headers: { cookie: `auth_token=${authToken}` },
  });
  const response = await GET(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.recommendations.filter((book: any) => book.authorName === 'Author A')).toHaveLength(2);
});
```

- [ ] **Step 2: Run the route test file to verify the new cases fail**

Run: `npm test -- --runTestsByPath app/api/__tests__/recommendations.test.ts`
Expected: FAIL on missing reason strings and current same-author bias.

- [ ] **Step 3: Commit the failing integration tests**

```bash
git add app/api/__tests__/recommendations.test.ts
git commit -m "test: define recommendation affinity behavior"
```

### Task 3: Implement Author Affinity, Thin-Profile Popularity, and Limited Author Seeding

**Files:**
- Modify: `app/api/recommendations/route.ts`
- Modify: `docs/superpowers/specs/2026-04-09-recommendation-affinity-design.md`
- Create: `lib/recommendations.ts`
- Test: `app/api/__tests__/recommendations.test.ts`
- Test: `lib/__tests__/recommendations.test.ts`

- [ ] **Step 1: Refactor route preference types to carry author stats**

```ts
import {
  getAuthorAffinityBand,
  getPopularityWeightMultiplier,
  toAuthorSentiment,
  type AuthorAffinityStats,
} from '@/lib/recommendations';

interface UserPreferences {
  likedGenres: string[];
  likedAuthors: string[];
  likedPerformers: string[];
  highPerformancePerformers: string[];
  avgRating: number;
  avgPerformanceRating: number;
  totalSignals: number;
  authorAffinity: Map<string, AuthorAffinityStats>;
}
```

- [ ] **Step 2: Replace positive-only author learning with all-annotation affinity aggregation**

```ts
const allAnnotations = await db
  .select()
  .from(userAnnotation)
  .where(eq(userAnnotation.userId, userId))
  .all() as UserAnnotation[];

const positiveRatings = allAnnotations.filter((annotation) => annotation.rating >= 4);
const bookIds = allAnnotations.map((annotation) => annotation.bookId);
const books = await db.select().from(book).where(inArray(book.id, bookIds)).all() as Book[];
const bookMap = new Map(books.map((item) => [item.id, item]));
const authorAffinity = new Map<string, AuthorAffinityStats>();

for (const annotation of allAnnotations) {
  const currentBook = bookMap.get(annotation.bookId);
  if (!currentBook?.authorName) continue;

  const author = currentBook.authorName.toLowerCase().trim();
  if (!author || author === 'unknown') continue;

  const sentiment = toAuthorSentiment(annotation);
  const stats = authorAffinity.get(author) ?? {
    interactionCount: 0,
    netSentiment: 0,
    avgSentiment: 0,
    dropCount: 0,
  };

  if (annotation.readStatus === 'dropped') {
    stats.dropCount += 1;
  }

  if (sentiment !== null) {
    stats.interactionCount += 1;
    stats.netSentiment += sentiment;
    stats.avgSentiment = stats.netSentiment / stats.interactionCount;
  }

  authorAffinity.set(author, stats);
}

const likedAuthors = Array.from(authorAffinity.entries())
  .filter(([, stats]) => getAuthorAffinityBand(stats) !== 'negative')
  .sort((a, b) => b[1].netSentiment - a[1].netSentiment)
  .slice(0, 10)
  .map(([author]) => author);
```

- [ ] **Step 3: Update score calculation to use affinity bands and modest popularity reasons**

```ts
function calculateScore(
  candidate: Book,
  prefs: UserPreferences,
  weights: typeof DEFAULT_WEIGHTS,
): { score: number; reasons: string[] } {
  let genreScore = 0;
  let authorScore = 0;
  let performerScore = 0;
  let performanceScore = 0;
  const reasons: string[] = [];

  const affinity = candidate.authorName
    ? prefs.authorAffinity.get(candidate.authorName.toLowerCase().trim())
    : undefined;
  const affinityBand = affinity ? getAuthorAffinityBand(affinity) : 'neutral';

  if (affinityBand === 'positive') {
    authorScore = 0.7;
    reasons.push('Author affinity: positive');
  } else if (affinityBand === 'mixed') {
    authorScore = 0.25;
    reasons.push('Author affinity: mixed');
  } else if (affinityBand === 'negative') {
    authorScore = -0.15;
  }

  const popularityMultiplier = getPopularityWeightMultiplier(prefs.totalSignals);
  const popularityScore = Math.min((candidate.downloads || 0) / 50000, 1) * popularityMultiplier;
  let recencyScore = 0;
  const currentYear = new Date().getFullYear();

  if (candidate.year) {
    recencyScore = Math.max(0, Math.min((candidate.year - 2000) / (currentYear - 2000), 1));
  } else if (candidate.lastCommentDate) {
    const commentYear = new Date(candidate.lastCommentDate).getFullYear();
    recencyScore = Math.max(0, Math.min((commentYear - 2000) / (currentYear - 2000), 1));
  }

  if (popularityScore >= 0.1) {
    reasons.push('Popular with readers');
  }

  return {
    score:
      (genreScore * weights.genre) +
      (authorScore * weights.author) +
      (performerScore * weights.performer) +
      (performanceScore * weights.performance) +
      (popularityScore * weights.popularity) +
      (recencyScore * weights.recency),
    reasons,
  };
}
```

- [ ] **Step 4: Reduce author-based candidate seeding and skip negative authors**

```ts
const authorSeeds = prefs.likedAuthors
  .filter((author) => {
    const stats = prefs.authorAffinity.get(author);
    return stats && getAuthorAffinityBand(stats) !== 'negative';
  })
  .slice(0, 2)
  .flatMap((author) => caseVariants(author).map((variant) => like(book.authorName, `%${variant}%`)));

const preferenceFilters = [
  ...prefs.likedPerformers.slice(0, 5).flatMap((performer) =>
    caseVariants(performer).map((variant) => like(book.performer, `%${variant}%`)),
  ),
  ...prefs.likedGenres.slice(0, 8).flatMap((genre) =>
    caseVariants(genre).map((variant) => like(book.genre, `%${variant}%`)),
  ),
  ...authorSeeds,
];
```

- [ ] **Step 5: Update default weights to de-emphasize author matches**

```ts
const DEFAULT_WEIGHTS = {
  genre: 0.28,
  author: 0.1,
  performer: 0.16,
  performance: 0.14,
  popularity: 0.18,
  recency: 0.14,
};
```

- [ ] **Step 6: Run unit and route tests to verify the new scoring behavior passes**

Run: `npm test -- --runTestsByPath lib/__tests__/recommendations.test.ts app/api/__tests__/recommendations.test.ts`
Expected: PASS for helper tests and PASS for new route cases except the diversity cap if not added yet.

- [ ] **Step 7: Clarify spec wording from `drop` to `dropped`**

```md
- If `readStatus=dropped` and no rating is set, count that interaction as `-2`.
- If `readStatus=dropped` and a rating is set, use the rating-derived sentiment instead of forcing `-2`.
```

- [ ] **Step 8: Commit the affinity scoring change**

```bash
git add app/api/recommendations/route.ts lib/recommendations.ts lib/__tests__/recommendations.test.ts docs/superpowers/specs/2026-04-09-recommendation-affinity-design.md
git commit -m "feat: add net author affinity recommendations"
```

### Task 4: Apply Final Author Diversity Cap and Verify Full Recommendation Flow

**Files:**
- Modify: `app/api/recommendations/route.ts`
- Modify: `app/api/__tests__/recommendations.test.ts`

- [ ] **Step 1: Add the diversity cap into final ranking**

```ts
import { applyAuthorDiversityCap } from '@/lib/recommendations';

const scoredBooks = allBooks
  .map((currentBook) => {
    const { score, reasons } = calculateScore(currentBook, prefs, DEFAULT_WEIGHTS);
    return { ...currentBook, score, reasons };
  })
  .sort((a, b) => b.score - a.score);

const recommendations = applyAuthorDiversityCap(scoredBooks, limit, 2);
```

- [ ] **Step 2: Verify the full route test file passes**

Run: `npm test -- --runTestsByPath app/api/__tests__/recommendations.test.ts`
Expected: PASS with existing exclusion tests plus the new mixed-author, dropped, downloads, and diversity cases.

- [ ] **Step 3: Run type-checking on the modified files**

Run: `npm run lint`
Expected: PASS with no TypeScript errors from the new helper imports, `Map` types, or reason strings.

- [ ] **Step 4: Commit the diversity cap**

```bash
git add app/api/recommendations/route.ts app/api/__tests__/recommendations.test.ts
git commit -m "feat: diversify recommendation authors"
```

### Task 5: Final Verification

**Files:**
- Modify: none
- Test: `lib/__tests__/recommendations.test.ts`
- Test: `app/api/__tests__/recommendations.test.ts`

- [ ] **Step 1: Run the focused recommendation test suite**

Run: `npm test -- --runTestsByPath lib/__tests__/recommendations.test.ts app/api/__tests__/recommendations.test.ts`
Expected: PASS across all recommendation-specific coverage.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS with no regressions outside recommendations.

- [ ] **Step 3: Capture final git state**

Run: `git status --short`
Expected: clean working tree except for any unrelated pre-existing user changes such as `AGENT.md`.

- [ ] **Step 4: Commit the verification checkpoint if needed**

```bash
git commit --allow-empty -m "chore: verify recommendation affinity rollout"
```

## Self-Review

**Spec coverage**

- Net author affinity from all annotations: covered in Task 3.
- Unrated dropped books count as `-2`: covered in Task 1 and Task 2.
- Rated dropped books use rating sentiment: covered in Task 1 and Task 2.
- Mixed authors get only a small boost: covered in Task 2 and Task 3.
- Downloads remain a modest signal and matter more for thin history: covered in Task 1, Task 2, and Task 3.
- Candidate retrieval favors genre and performer over authors: covered in Task 3.
- Final author diversity cap: covered in Task 4.
- Response shape remains stable and exclusions continue to work: preserved by Task 2 and Task 4 route tests.

**Placeholder scan**

- No `TODO`, `TBD`, or “handle appropriately” placeholders remain.

**Type consistency**

- Plan uses `dropped` consistently with [`lib/read-status.ts`](/Users/ma/repo/bookAdvisor/lib/read-status.ts#L1).
- Helper module exports and imports match the route snippets.
