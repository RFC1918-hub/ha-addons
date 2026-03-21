/**
 * OnSong Cloud Drive integration routes.
 *
 * GET  /api/onsong/config  — returns { configured: boolean }
 * POST /api/onsong/send    — uploads a song as a .onsong file to OnSong Cloud Drive
 *
 * Auth: the raw ONSONG_TOKEN value is sent as the Authorization header (no Bearer prefix).
 * This matches the OnSong Cloud Drive API contract.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const ONSONG_UPLOAD_URL = 'https://onsongapp.com/drive/files/~/';

const SendBodySchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  content: z.string().min(1),
});

export async function onsongCloudRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/onsong/config
   * Returns { configured: true } when ONSONG_TOKEN is set, { configured: false } otherwise.
   */
  app.get('/api/onsong/config', async (_request, reply) => {
    const token = process.env.ONSONG_TOKEN ?? '';
    return reply.send({ configured: token.length > 0 });
  });

  /**
   * POST /api/onsong/send
   * Uploads the provided OnSong content to OnSong Cloud Drive.
   * Body: { title: string, artist: string, content: string }
   */
  app.post('/api/onsong/send', async (request, reply) => {
    const token = process.env.ONSONG_TOKEN ?? '';
    if (token.length === 0) {
      return reply.status(503).send({ error: 'OnSong token not configured' });
    }

    const parsed = SendBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'title, artist, and content are required' });
    }

    const { title, artist, content } = parsed.data;
    const filename = `${title} - ${artist}.txt`;

    // Build multipart/form-data using Node.js built-in FormData
    const form = new FormData();
    const blob = new Blob([content], { type: 'text/plain' });
    form.append('file[0]', blob, filename);

    let upstream: Response;
    try {
      upstream = await fetch(ONSONG_UPLOAD_URL, {
        method: 'POST',
        headers: {
          Authorization: token,
        },
        body: form,
      });
    } catch (err) {
      app.log.error(err, 'OnSong Cloud upload failed — network error');
      return reply.status(502).send({
        error: 'OnSong Cloud unreachable',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      app.log.error({ status: upstream.status, body }, 'OnSong Cloud upload returned non-2xx');
      return reply.status(502).send({
        error: `OnSong Cloud returned ${upstream.status}`,
        detail: body.slice(0, 500),
      });
    }

    return reply.send({ success: true, filename });
  });
}
