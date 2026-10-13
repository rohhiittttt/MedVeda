import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Root & Health routes
fastify.get('/', async () => ({
  service: 'MedVeda Fastify Backend',
  status: 'online',
  version: '0.1.0',
  endpoints: {
    health: '/health',
    apiHealth: '/api/health',
  },
}));

fastify.get('/health', async () => ({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

fastify.get('/api/health', async () => ({
  status: 'ok',
  service: '@nexusmind/backend',
}));

const PORT = Number(process.env.BACKEND_PORT || process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`MedVeda Fastify Backend running at http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export default fastify;
