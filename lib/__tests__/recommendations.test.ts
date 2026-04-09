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
