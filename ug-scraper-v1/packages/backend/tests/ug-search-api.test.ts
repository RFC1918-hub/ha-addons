/**
 * Tests for ug-search-api.ts
 * Mocks Node.js built-in fetch at module scope.
 */
import { jest } from '@jest/globals';

// Provide a typed mock for the global fetch
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch as typeof fetch;

import { searchTabs } from '../src/services/ug-search-api.js';

function makeRawTab(overrides: Partial<{
  id: number;
  song_name: string;
  artist_name: string;
  type: string;
  rating: number;
  votes: number;
  difficulty: string;
  capo: number;
  tuning: string;
  tonality_name: string;
}> = {}) {
  return {
    id: 1,
    song_name: 'Test Song',
    artist_name: 'Test Artist',
    type: 'Chords',
    rating: 4.5,
    votes: 100,
    difficulty: 'intermediate',
    capo: 0,
    tuning: 'EADGBe',
    tonality_name: 'Am',
    ...overrides,
  };
}

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

describe('searchTabs', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls the correct UG endpoint with title parameter', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ tabs: [] }));
    await searchTabs('wonderwall');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('/tab/search');
    expect(url).toContain('title=wonderwall');
    expect(url).toContain('limit=50');
  });

  it('appends artist param when provided', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ tabs: [] }));
    await searchTabs('wonderwall', 'oasis');
    const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('artist=oasis');
  });

  it('filters to type === "Chords" only', async () => {
    const rawTabs = [
      makeRawTab({ id: 1, type: 'Chords', rating: 4.5 }),
      makeRawTab({ id: 2, type: 'Official', rating: 5.0 }),
      makeRawTab({ id: 3, type: 'Pro', rating: 4.9 }),
      makeRawTab({ id: 4, type: 'Chords', rating: 4.2 }),
    ];
    mockFetch.mockResolvedValueOnce(mockResponse({ tabs: rawTabs }));

    const results = await searchTabs('test');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.type === 'Chords')).toBe(true);
  });

  it('sorts by rating descending, votes as tiebreaker', async () => {
    const rawTabs = [
      makeRawTab({ id: 1, type: 'Chords', rating: 4.2, votes: 500 }),
      makeRawTab({ id: 2, type: 'Chords', rating: 4.8, votes: 100 }),
      makeRawTab({ id: 3, type: 'Chords', rating: 4.8, votes: 300 }),
    ];
    mockFetch.mockResolvedValueOnce(mockResponse({ tabs: rawTabs }));

    const results = await searchTabs('test');
    expect(results[0].id).toBe(3); // 4.8, 300 votes
    expect(results[1].id).toBe(2); // 4.8, 100 votes
    expect(results[2].id).toBe(1); // 4.2
  });

  it('returns empty array when tabs field is absent', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));
    const results = await searchTabs('test');
    expect(results).toHaveLength(0);
  });

  it('throws on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'bad' }, 503));
    await expect(searchTabs('test')).rejects.toThrow('503');
  });

  it('sets Android headers on the request', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ tabs: [] }));
    await searchTabs('test');
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('UGT_ANDROID');
    expect(headers['X-UG-CLIENT-ID']).toBeDefined();
    expect(headers['X-UG-API-KEY']).toBeDefined();
  });
});
