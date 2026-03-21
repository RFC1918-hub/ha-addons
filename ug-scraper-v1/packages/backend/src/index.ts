import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticFiles from '@fastify/static';
import { searchRoutes } from './routes/search.js';
import { tabRoutes } from './routes/tab.js';
import { resolveUrlRoutes } from './routes/resolve-url.js';
import { onsongCloudRoutes } from './routes/onsong-cloud.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
const IS_PROD = process.env.NODE_ENV === 'production';

const app = Fastify({ logger: true });

// CORS — only active in development; in production everything is same-origin
if (!IS_PROD) {
  await app.register(cors, {
    origin: 'http://localhost:5173',
  });
}

// API routes
await app.register(searchRoutes);
await app.register(tabRoutes);
await app.register(resolveUrlRoutes);
await app.register(onsongCloudRoutes);

// Production: serve built frontend from packages/frontend/dist/
// At runtime __dirname = packages/backend/dist/
// Standard Docker layout: /app/packages/backend/dist/ → /app/packages/frontend/dist/
// HA container layout:    /app/packages/backend/dist/ → /app/packages/frontend/dist/
// Both resolve identically via three levels up then into packages/frontend/dist.
if (IS_PROD) {
  const frontendDist = join(__dirname, '..', '..', '..', 'packages', 'frontend', 'dist');
  await app.register(staticFiles, {
    root: frontendDist,
    prefix: '/',
    preCompressed: false,
  });

  // Fallback: serve index.html for unmatched non-API routes (HashRouter — all routing is client-side)
  app.setNotFoundHandler((_request, reply) => {
    void reply.sendFile('index.html');
  });
}

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
