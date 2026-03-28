import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Extract the trailing numeric segment from the URL path.
// Pattern from ADR: /(\d+)(?:[/?#].*)?$/
const TAB_ID_RE = /(\d+)(?:[/?#].*)?$/;

const BodySchema = z.object({
  url: z.string().url(),
});

export async function resolveUrlRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/resolve-url', async (request, reply) => {
    const parsed = BodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'url is required and must be a valid URL' });
    }

    const { url } = parsed.data;

    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return reply.status(400).send({ error: 'Could not extract tab ID from URL' });
    }

    const match = TAB_ID_RE.exec(pathname);
    if (!match) {
      return reply.status(400).send({ error: 'Could not extract tab ID from URL' });
    }

    const id = Number(match[1]);
    return reply.send({ id });
  });
}
