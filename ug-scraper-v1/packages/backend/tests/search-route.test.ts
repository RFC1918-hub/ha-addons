/**
 * Tests for GET /api/search route.
 *
 * ESM module mocking requires that:
 * 1. jest.unstable_mockModule is called before any imports that transitively
 *    import the mocked module
 * 2. All imports of the module under test are dynamic (after mock registration)
 *
 * Because the route module imports ug-search-api.ts at load time, we must
 * register the mock before calling buildApp(), which dynamically imports the
 * route. Top-level static imports of Fastify are safe as they don't touch
 * the mocked module.
 */
import { jest } from '@jest/globals';
import Fastify from 'fastify';
import type { TabSummary } from '../src/services/ug-search-api.js';

// Register mock before the route module is imported
jest.unstable_mockModule('../src/services/ug-search-api.js', () => ({
  searchTabs: jest.fn<() => Promise<TabSummary[]>>(),
}));

// Lazily resolved after mock is in place
async function buildApp() {
  const { searchRoutes } = await import('../src/routes/search.js');
  const app = Fastify({ logger: false });
  await app.register(searchRoutes);
  return app;
}

async function getMock() {
  const { searchTabs } = await import('../src/services/ug-search-api.js');
  return searchTabs as jest.MockedFunction<typeof searchTabs>;
}

describe('GET /api/search', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let mockSearchTabs: jest.MockedFunction<typeof import('../src/services/ug-search-api.js').searchTabs>;

  beforeAll(async () => {
    mockSearchTabs = await getMock();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockSearchTabs.mockReset();
  });

  it('returns 400 when q is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'q parameter is required' });
  });

  it('returns 400 when q is empty string', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/search?q=' });
    expect(res.statusCode).toBe(400);
  });

  it('returns results from the search service', async () => {
    const fakeResults: TabSummary[] = [
      {
        id: 1,
        song_name: 'Wonderwall',
        artist_name: 'Oasis',
        type: 'Chords',
        rating: 4.8,
        votes: 1000,
        difficulty: 'intermediate',
        capo: 2,
        tuning: 'EADGBe',
        tonality_name: 'F#',
      },
    ];
    mockSearchTabs.mockResolvedValueOnce(fakeResults);

    const res = await app.inject({
      method: 'GET',
      url: '/api/search?q=wonderwall',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { results: TabSummary[] };
    expect(body.results).toHaveLength(1);
    expect(body.results[0].song_name).toBe('Wonderwall');
  });

  it('passes the artist param to the search service', async () => {
    mockSearchTabs.mockResolvedValueOnce([]);
    await app.inject({
      method: 'GET',
      url: '/api/search?q=wonderwall&artist=oasis',
    });
    expect(mockSearchTabs).toHaveBeenCalledWith('wonderwall', 'oasis');
  });

  it('returns 502 when the search service throws', async () => {
    mockSearchTabs.mockRejectedValueOnce(new Error('UG API returned 503'));
    const res = await app.inject({
      method: 'GET',
      url: '/api/search?q=wonderwall',
    });
    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body) as { error: string; detail: string };
    expect(body.error).toBe('Search unavailable');
    expect(body.detail).toContain('503');
  });
});
