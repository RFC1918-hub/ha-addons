/**
 * Tests for GET /api/onsong/config and POST /api/onsong/send routes.
 * Mocks global fetch to avoid network calls.
 */
import Fastify from 'fastify';
import { jest } from '@jest/globals';
import { onsongCloudRoutes } from '../src/routes/onsong-cloud.js';

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(onsongCloudRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// GET /api/onsong/config
// ---------------------------------------------------------------------------

describe('GET /api/onsong/config', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    delete process.env.ONSONG_TOKEN;
  });

  it('returns { configured: false } when ONSONG_TOKEN is not set', async () => {
    delete process.env.ONSONG_TOKEN;
    const res = await app.inject({ method: 'GET', url: '/api/onsong/config' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { configured: boolean };
    expect(body.configured).toBe(false);
  });

  it('returns { configured: false } when ONSONG_TOKEN is empty string', async () => {
    process.env.ONSONG_TOKEN = '';
    const res = await app.inject({ method: 'GET', url: '/api/onsong/config' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { configured: boolean };
    expect(body.configured).toBe(false);
  });

  it('returns { configured: true } when ONSONG_TOKEN is set to a non-empty value', async () => {
    process.env.ONSONG_TOKEN = 'test-token-abc';
    const res = await app.inject({ method: 'GET', url: '/api/onsong/config' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { configured: boolean };
    expect(body.configured).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/onsong/send
// ---------------------------------------------------------------------------

describe('POST /api/onsong/send', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    mockFetch = jest.fn<typeof fetch>();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    delete process.env.ONSONG_TOKEN;
  });

  it('returns 503 when ONSONG_TOKEN is not set', async () => {
    delete process.env.ONSONG_TOKEN;
    const res = await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Wonderwall', artist: 'Oasis', content: 'some content' },
    });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toContain('token not configured');
  });

  it('returns 400 when body is missing required fields', async () => {
    process.env.ONSONG_TOKEN = 'test-token';
    const res = await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Wonderwall' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('uploads to OnSong Cloud and returns { success: true, filename }', async () => {
    process.env.ONSONG_TOKEN = 'test-token-xyz';
    mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: {
        title: 'Wonderwall',
        artist: 'Oasis',
        content: 'Wonderwall\nOasis\n\n[G] [Em]',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success: boolean; filename: string };
    expect(body.success).toBe(true);
    expect(body.filename).toBe('Wonderwall - Oasis.txt');
  });

  it('sends Authorization header with the raw token value (no Bearer prefix)', async () => {
    process.env.ONSONG_TOKEN = 'my-raw-token';
    mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));

    await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'content' },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0];
    // callArgs[1] is the RequestInit options object
    const options = callArgs[1] as RequestInit & { headers: Record<string, string> };
    expect(options.headers['Authorization']).toBe('my-raw-token');
    expect(options.headers['Authorization']).not.toMatch(/^Bearer /);
  });

  it('posts to the correct OnSong Cloud Drive URL', async () => {
    process.env.ONSONG_TOKEN = 'test-token';
    mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));

    await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'content' },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('https://onsongapp.com/drive/files/~/');
  });

  it('returns 502 when OnSong Cloud returns a non-2xx status', async () => {
    process.env.ONSONG_TOKEN = 'test-token';
    mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'content' },
    });

    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toContain('401');
  });

  it('returns 502 when fetch throws a network error', async () => {
    process.env.ONSONG_TOKEN = 'test-token';
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'content' },
    });

    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body) as { error: string; detail: string };
    expect(body.error).toContain('unreachable');
    expect(body.detail).toContain('ECONNREFUSED');
  });
});
