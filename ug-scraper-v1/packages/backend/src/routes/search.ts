import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { searchTabs } from '../services/ug-search-api.js';

const QuerySchema = z.object({
  q: z.string().min(1),
  artist: z.string().optional(),
});

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/search', async (request, reply) => {
    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'q parameter is required' });
    }

    const { q, artist } = parsed.data;

    try {
      const results = await searchTabs(q, artist);
      return reply.send({ results });
    } catch (err) {
      app.log.error(err, 'Search failed');
      return reply.status(502).send({
        error: 'Search unavailable',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });
}
