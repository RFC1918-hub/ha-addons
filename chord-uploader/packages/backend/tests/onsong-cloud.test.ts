/**
 * Tests for GET /api/onsong/config and POST /api/onsong/send routes.
 * Mocks global fetch to avoid network calls.
 *
 * The send route uses a two-step upload:
 *   1. PUT to OnSong API → returns { uploadURL } (pre-signed S3 URL)
 *   2. PUT file content to the S3 uploadURL
 */
import Fastify from 'fastify';
import { jest } from '@jest/globals';
import { onsongCloudRoutes } from '../src/routes/onsong-cloud.js';

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(onsongCloudRoutes);
  return app;
}

/** Helper: mock a successful two-step upload (create + S3). */
function mockSuccessfulUpload(mockFetch: jest.MockedFunction<typeof fetch>) {
  // Step 1: OnSong create returns uploadURL
  mockFetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ uploadURL: 'https://s3.example.com/presigned' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  // Step 2: S3 upload succeeds
  mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));
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

  it('uploads to OnSong Cloud via two-step PUT and returns { success: true, filename }', async () => {
    process.env.ONSONG_TOKEN = 'test-token-xyz';
    mockSuccessfulUpload(mockFetch);

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
    // Both fetch calls should have been made (create + S3 upload)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('sends Authorization header with the raw token value (no Bearer prefix) on step 1', async () => {
    process.env.ONSONG_TOKEN = 'my-raw-token';
    mockSuccessfulUpload(mockFetch);

    await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'content' },
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Step 1: create call
    const createOptions = mockFetch.mock.calls[0][1] as RequestInit & { headers: Record<string, string> };
    expect(createOptions.headers['Authorization']).toBe('my-raw-token');
    expect(createOptions.headers['Authorization']).not.toMatch(/^Bearer /);
  });

  it('PUTs to the correct OnSong Cloud Drive URL with encoded filename', async () => {
    process.env.ONSONG_TOKEN = 'test-token';
    mockSuccessfulUpload(mockFetch);

    await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'content' },
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Step 1: create call URL
    const createUrl = mockFetch.mock.calls[0][0] as string;
    expect(createUrl).toBe('https://onsongapp.com/drive/files/~/Song%20-%20Artist.txt');
    const createOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(createOptions.method).toBe('PUT');
    // Step 2: S3 upload URL
    const uploadUrl = mockFetch.mock.calls[1][0] as string;
    expect(uploadUrl).toBe('https://s3.example.com/presigned');
  });

  it('sends file content as body in step 2 S3 upload', async () => {
    process.env.ONSONG_TOKEN = 'test-token';
    mockSuccessfulUpload(mockFetch);

    await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'Hello World' },
    });

    const uploadOptions = mockFetch.mock.calls[1][1] as RequestInit;
    expect(uploadOptions.method).toBe('PUT');
    expect(uploadOptions.body).toBe('Hello World');
  });

  it('returns 502 when OnSong Cloud create returns a non-2xx status', async () => {
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

  it('returns 502 when OnSong Cloud create throws a network error', async () => {
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

  it('returns 502 when OnSong Cloud returns invalid JSON', async () => {
    process.env.ONSONG_TOKEN = 'test-token';
    mockFetch.mockResolvedValueOnce(new Response('not json', { status: 200 }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'content' },
    });

    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toContain('invalid JSON');
  });

  it('returns 502 when OnSong Cloud does not return an uploadURL', async () => {
    process.env.ONSONG_TOKEN = 'test-token';
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: '123' }), { status: 200 }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'content' },
    });

    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toContain('upload URL');
  });

  it('returns 502 when S3 upload fails', async () => {
    process.env.ONSONG_TOKEN = 'test-token';
    // Step 1 succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ uploadURL: 'https://s3.example.com/presigned' }), {
        status: 200,
      }),
    );
    // Step 2 fails
    mockFetch.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'content' },
    });

    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toContain('403');
  });

  it('returns 502 when S3 upload throws a network error', async () => {
    process.env.ONSONG_TOKEN = 'test-token';
    // Step 1 succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ uploadURL: 'https://s3.example.com/presigned' }), {
        status: 200,
      }),
    );
    // Step 2 network error
    mockFetch.mockRejectedValueOnce(new Error('S3 TIMEOUT'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/onsong/send',
      payload: { title: 'Song', artist: 'Artist', content: 'content' },
    });

    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body) as { error: string; detail: string };
    expect(body.error).toContain('upload file content');
    expect(body.detail).toContain('S3 TIMEOUT');
  });
});
