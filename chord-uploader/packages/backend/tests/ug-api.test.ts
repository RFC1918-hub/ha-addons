/**
 * Tests for ug-api.ts (tab fetch).
 * Mocks Node.js built-in fetch at module scope.
 */
import { jest } from '@jest/globals';

const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch as typeof fetch;

import { fetchTab } from '../src/services/ug-api.js';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

const rawTab = {
  id: 39144,
  song_name: 'Wonderwall',
  artist_name: 'Oasis',
  type: 'Chords',
  rating: 4.84,
  votes: 12343,
  difficulty: 'intermediate',
  capo: 0,
  tuning: 'EADGBe',
  tonality_name: 'F#m',
  content: '[Intro]\n[ch]Em7[/ch]  [ch]G[/ch]',
};

describe('fetchTab', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('calls the correct UG tab/info endpoint', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(rawTab));
    await fetchTab(39144);
    const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('/tab/info');
    expect(url).toContain('tab_id=39144');
    expect(url).toContain('tab_access_type=private');
  });

  it('returns parsed tab with content nodes', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(rawTab));
    const tab = await fetchTab(39144);
    expect(tab.id).toBe(39144);
    expect(tab.song_name).toBe('Wonderwall');
    expect(tab.content).toHaveLength(2); // [Intro] heading + chord line paragraph
    expect(tab.content[0]).toEqual({ type: 'heading', text: 'Intro' });
  });

  it('throws NOT_FOUND error on 404', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse('', 404) as Response);
    try {
      await fetchTab(99999);
      fail('should have thrown');
    } catch (err) {
      expect((err as NodeJS.ErrnoException).code).toBe('NOT_FOUND');
    }
  });

  it('throws on non-404 error status', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse('', 503) as Response);
    await expect(fetchTab(1)).rejects.toThrow('503');
  });

  it('sets Android headers on the request', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(rawTab));
    await fetchTab(39144);
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('UGT_ANDROID');
    expect(headers['X-UG-CLIENT-ID']).toBeDefined();
    expect(headers['X-UG-API-KEY']).toBeDefined();
  });

  it('defaults missing fields to safe values', async () => {
    const minimal = { ...rawTab, difficulty: undefined, capo: undefined, tuning: undefined, tonality_name: undefined };
    mockFetch.mockResolvedValueOnce(mockResponse(minimal));
    const tab = await fetchTab(1);
    expect(tab.difficulty).toBe('');
    expect(tab.capo).toBe(0);
    expect(tab.tuning).toBe('');
    expect(tab.tonality_name).toBe('');
  });
});
