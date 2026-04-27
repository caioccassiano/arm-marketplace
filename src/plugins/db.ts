import fp from 'fastify-plugin'
import { db } from '../db/client.js'
import type { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('db', db)
}

export default fp(dbPlugin, { name: 'db' })
