import type { FastifyInstance } from 'fastify';
import { fetchTab } from '../services/ug-api.js';

export async function tabRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/api/tab/:id', async (request, reply) => {
    const rawId = Number(request.params.id);
    if (!Number.isInteger(rawId) || rawId <= 0) {
      return reply.status(400).send({ error: 'Invalid tab ID' });
    }

    try {
      const tab = await fetchTab(rawId);
      return reply.send({ tab });
    } catch (err) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'NOT_FOUND') {
        return reply.status(404).send({ error: 'Tab not found' });
      }
      app.log.error(err, 'Tab fetch failed');
      return reply.status(502).send({
        error: 'UG API unreachable',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });
}
