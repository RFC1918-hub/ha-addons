/**
 * OnSong Cloud Drive integration routes.
 *
 * GET  /api/onsong/config  — returns { configured: boolean }
 * POST /api/onsong/send    — uploads a song to OnSong Cloud Drive (two-step: create + S3 upload)
 *
 * Auth: the raw ONSONG_TOKEN value is sent as the Authorization header (no Bearer prefix).
 * This matches the OnSong Cloud Drive API contract.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const ONSONG_DRIVE_URL = 'https://onsongapp.com/drive/files/~/';

const SendBodySchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  content: z.string().min(1),
});

/** Shape returned by OnSong's PUT create-file endpoint. */
interface OnSongCreateResponse {
  uploadURL: string;
  [key: string]: unknown;
}

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
   * Two-step process:
   *   1. PUT to OnSong API to create file entry → returns pre-signed S3 uploadURL
   *   2. PUT file content to the S3 uploadURL
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
    const fileUrl = `${ONSONG_DRIVE_URL}${encodeURIComponent(filename)}`;

    // Step 1: Create file entry in OnSong Cloud → get pre-signed S3 upload URL
    let createResp: Response;
    try {
      createResp = await fetch(fileUrl, {
        method: 'PUT',
        headers: {
          Authorization: token,
          'Content-Type': 'text/plain',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
    } catch (err) {
      app.log.error(err, 'OnSong Cloud create failed — network error');
      return reply.status(502).send({
        error: 'OnSong Cloud unreachable',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    if (!createResp.ok) {
      const body = await createResp.text().catch(() => '');
      app.log.error({ status: createResp.status, body }, 'OnSong Cloud create returned non-2xx');
      return reply.status(502).send({
        error: `OnSong Cloud returned ${createResp.status}`,
        detail: body.slice(0, 500),
      });
    }

    let createBody: OnSongCreateResponse;
    try {
      createBody = (await createResp.json()) as OnSongCreateResponse;
    } catch {
      return reply.status(502).send({ error: 'OnSong Cloud returned invalid JSON' });
    }

    if (!createBody.uploadURL) {
      return reply.status(502).send({ error: 'OnSong Cloud did not return an upload URL' });
    }

    // Step 2: Upload file content to the pre-signed S3 URL
    let uploadResp: Response;
    try {
      uploadResp = await fetch(createBody.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: content,
      });
    } catch (err) {
      app.log.error(err, 'S3 upload failed — network error');
      return reply.status(502).send({
        error: 'Failed to upload file content',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    if (!uploadResp.ok) {
      const body = await uploadResp.text().catch(() => '');
      app.log.error({ status: uploadResp.status, body }, 'S3 upload returned non-2xx');
      return reply.status(502).send({
        error: `File upload returned ${uploadResp.status}`,
        detail: body.slice(0, 500),
      });
    }

    return reply.send({ success: true, filename });
  });
}
