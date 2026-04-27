import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifySession from '@fastify/session'
import fastifyCors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { env } from './config/env.js'
import dbPlugin from './plugins/db.js'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import syncRoutes from './routes/sync.js'
import ordersRoutes from './routes/orders.js'
import reconciliationRoutes from './routes/reconciliation.js'
import reportsRoutes from './routes/reports.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const fastify = Fastify(
  env.NODE_ENV === 'development'
    ? {
        logger: {
          level: 'info',
          transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
        },
      }
    : { logger: { level: 'warn' } },
)

await fastify.register(fastifyCors, {
  origin: env.NODE_ENV === 'development' ? 'http://localhost:5173' : false,
  credentials: true,
})

await fastify.register(fastifyCookie)

await fastify.register(fastifySession, {
  secret: env.SESSION_SECRET,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8h
  },
  saveUninitialized: false,
})

await fastify.register(dbPlugin)
await fastify.register(authPlugin)

// API routes
await fastify.register(
  async (app) => {
    app.register(authRoutes)
    app.register(syncRoutes)
    app.register(ordersRoutes)
    app.register(reconciliationRoutes)
    app.register(reportsRoutes)
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
