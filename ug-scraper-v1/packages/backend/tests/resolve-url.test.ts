import Fastify from 'fastify';
import { resolveUrlRoutes } from '../src/routes/resolve-url.js';

async function buildApp() {
  const app = Fastify();
  await app.register(resolveUrlRoutes);
  return app;
}

describe('POST /api/resolve-url', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('extracts numeric ID from a standard UG tab URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/resolve-url',
      payload: {
        url: 'https://www.ultimate-guitar.com/tab/oasis/wonderwall-chords-123456',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ id: 123456 });
  });

  it('handles URLs with a trailing slash', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/resolve-url',
      payload: {
        url: 'https://www.ultimate-guitar.com/tab/oasis/wonderwall-chords-123456/',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ id: 123456 });
  });

  it('handles URLs with a query string after the ID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/resolve-url',
      payload: {
        url: 'https://www.ultimate-guitar.com/tab/oasis/wonderwall-chords-123456?utm_source=test',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ id: 123456 });
  });

  it('returns 400 when the URL has no numeric ID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/resolve-url',
      payload: { url: 'https://www.ultimate-guitar.com/' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toMatch(/tab ID/i);
  });

  it('returns 400 when url field is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/resolve-url',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for a non-URL string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/resolve-url',
      payload: { url: 'not-a-url' },
    });
    expect(res.statusCode).toBe(400);
  });
});
