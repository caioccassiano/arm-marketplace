import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import fastifyCors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import fastifyMultipart from '@fastify/multipart'
import { env } from './config/env.js'
import { createPgSessionStore } from './plugins/session-store.js'
import dbPlugin from './plugins/db.js'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import syncRoutes from './routes/sync.js'
import ordersRoutes from './routes/orders.js'
import reconciliationRoutes from './routes/reconciliation.js'
import reportsRoutes from './routes/reports.js'
import uploadRoutes from './routes/upload.js'
import feitoriasRoutes from './routes/feitorias.js'
import cmvRoutes from './routes/cmv.js'
import feesRoutes from './routes/fees.js'
import lucratividadeRoutes from './routes/lucratividade.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fastify = Fastify({
  bodyLimit: 100 * 1024 * 1024, // 100 MB — feitorias podem ter milhares de pedidos
  trustProxy: true,
  ...(env.NODE_ENV === 'development'
    ? {
        logger: {
          level: 'info',
          transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
        },
      }
    : { logger: { level: 'warn' } }),
})

await fastify.register(fastifyCors, {
  origin: env.NODE_ENV === 'development' ? 'http://localhost:5173' : false,
  credentials: true,
})

await fastify.register(fastifyCookie)

const sessionStore = await createPgSessionStore()

await fastify.register(fastifySession, {
  secret: env.SESSION_SECRET,
  store: sessionStore,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8h
  },
  saveUninitialized: true,
})

await fastify.register(dbPlugin)
await fastify.register(authPlugin)
await fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 10,
  },
})

fastify.get('/api/health', async () => ({ status: 'ok' }))

// Rotas públicas
await fastify.register(
  async (app) => {
    app.register(authRoutes)
  },
  { prefix: '/api' },
)

// Rotas protegidas
await fastify.register(
  async (app) => {
    app.addHook('preHandler', app.requireAuth)
    app.register(syncRoutes)
    app.register(ordersRoutes)
    app.register(reconciliationRoutes)
    app.register(reportsRoutes)
    app.register(uploadRoutes)
    app.register(feitoriasRoutes)
    app.register(cmvRoutes)
    app.register(feesRoutes)
    app.register(lucratividadeRoutes)
  },
  { prefix: '/api' },
)

// Servir o frontend buildado em produção
if (env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '..', 'client', 'dist')
  await fastify.register(fastifyStatic, { root: clientDist })

  fastify.setNotFoundHandler((_request, reply) => {
    reply.sendFile('index.html')
  })
}

fastify.addHook('onError', async (_request, _reply, error) => {
  fastify.log.error(error)
})

try {
  await fastify.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
