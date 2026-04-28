import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

declare module '@fastify/session' {
  interface FastifySessionObject {
    userId?: number
    userEmail?: string
    userName?: string
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    'requireAuth',
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      // Autenticação desabilitada temporariamente
    },
  )
}

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(authPlugin, { name: 'auth' })
