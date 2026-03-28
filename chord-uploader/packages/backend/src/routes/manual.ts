import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseContent } from '../services/content-parser.js';
import { formatOnSong } from '../services/onsong-formatter.js';

const BodySchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  content: z.string().min(1),
});

export async function manualRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/manual/format', async (request, reply) => {
    const parsed = BodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'title, artist, and content are required' });
    }

    const { title, artist, content } = parsed.data;

    // Parse the manual content
    const parsedContent = parseContent(content);

    // Create a mock RawTabData for formatting
    const mockTabData = {
      id: 0, // Not used in formatting
      song_name: title,
      artist_name: artist,
      type: 'Manual',
      rating: 0,
      votes: 0,
      difficulty: 'Unknown',
      capo: 0,
      tuning: 'E A D G B E',
      tonality_name: 'Unknown',
      content: content, // The raw content for formatting
    };

    // Format for OnSong
    const onsongContent = formatOnSong(mockTabData);

    return reply.send({
      title,
      artist,
      content: parsedContent,
      onsong: onsongContent,
    });
  });
}