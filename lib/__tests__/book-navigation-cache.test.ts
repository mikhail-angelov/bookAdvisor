import { bookNavigationCache } from '../book-navigation-cache';

describe('bookNavigationCache', () => {
  beforeEach(() => {
    bookNavigationCache.clear();
  });

  it('returns previous and next ids for a cached snapshot', () => {
    const key = bookNavigationCache.save('books', ['book-1', 'book-2', 'book-3'], '/books?page=2');

    expect(bookNavigationCache.getNeighbors(key, 'book-2')).toEqual({
      prevId: 'book-1',
      nextId: 'book-3',
      source: 'books',
      returnHref: '/books?page=2',
    });
  });

  it('deduplicates ids and handles edges', () => {
    const key = bookNavigationCache.save('recommendations', ['book-1', 'book-1', 'book-2'], '/recommendations?provider=vector');

    expect(bookNavigationCache.getNeighbors(key, 'book-1')).toEqual({
      prevId: null,
      nextId: 'book-2',
      source: 'recommendations',
      returnHref: '/recommendations?provider=vector',
    });
    expect(bookNavigationCache.getNeighbors(key, 'book-2')).toEqual({
      prevId: 'book-1',
      nextId: null,
      source: 'recommendations',
      returnHref: '/recommendations?provider=vector',
    });
  });

  it('returns null when snapshot or book is missing', () => {
    expect(bookNavigationCache.getNeighbors('missing', 'book-1')).toBeNull();

    const key = bookNavigationCache.save('books', ['book-1'], '/books');
    expect(bookNavigationCache.getNeighbors(key, 'book-2')).toBeNull();
  });
});
