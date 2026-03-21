/**
 * Tests for GET /api/tab/:id route.
 * Mocks ug-api.ts to avoid network calls.
 */
import { jest } from '@jest/globals';
import Fastify from 'fastify';
import type { TabDetail } from '../src/services/ug-api.js';

jest.unstable_mockModule('../src/services/ug-api.js', () => ({
  fetchTab: jest.fn<() => Promise<TabDetail>>(),
}));

async function buildApp() {
  const { tabRoutes } = await import('../src/routes/tab.js');
  const app = Fastify({ logger: false });
  await app.register(tabRoutes);
  return app;
}

async function getMock() {
  const { fetchTab } = await import('../src/services/ug-api.js');
  return fetchTab as jest.MockedFunction<typeof import('../src/services/ug-api.js').fetchTab>;
}

const fakeTab: TabDetail = {
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
  content: [{ type: 'heading', text: 'Intro' }],
  onsong: 'Wonderwall\nOasis\nKey: F#m\n\nIntro:',
};

describe('GET /api/tab/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let mockFetchTab: jest.MockedFunction<typeof import('../src/services/ug-api.js').fetchTab>;

  beforeAll(async () => {
    mockFetchTab = await getMock();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockFetchTab.mockReset();
  });

  it('returns tab data wrapped in { tab: ... }', async () => {
    mockFetchTab.mockResolvedValueOnce(fakeTab);
    const res = await app.inject({ method: 'GET', url: '/api/tab/39144' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { tab: TabDetail };
    expect(body.tab.song_name).toBe('Wonderwall');
    expect(body.tab.id).toBe(39144);
  });

  it('returns 404 when fetchTab throws NOT_FOUND', async () => {
    const err = new Error('Tab not found') as NodeJS.ErrnoException;
    err.code = 'NOT_FOUND';
    mockFetchTab.mockRejectedValueOnce(err);
    const res = await app.inject({ method: 'GET', url: '/api/tab/99999' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('Tab not found');
  });

  it('returns 502 on upstream error', async () => {
    mockFetchTab.mockRejectedValueOnce(new Error('UG API returned 503'));
    const res = await app.inject({ method: 'GET', url: '/api/tab/1' });
    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body) as { error: string; detail: string };
    expect(body.error).toBe('UG API unreachable');
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tab/abc' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for id of zero', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tab/0' });
    expect(res.statusCode).toBe(400);
  });
});
