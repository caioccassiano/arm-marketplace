import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema.js'

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (request, reply) => {
    const body = loginBody.safeParse(request.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'Dados inválidos' })
    }

    const [user] = await fastify.db
      .select()
      .from(users)
      .where(eq(users.email, body.data.email))
      .limit(1)

    if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Email ou senha incorretos' })
    }

    request.session.userId = user.id
    request.session.userEmail = user.email
    request.session.userName = user.name

    return reply.send({ id: user.id, email: user.email, name: user.name })
  })

  fastify.post('/auth/logout', async (request, reply) => {
    await request.session.destroy()
    return reply.send({ ok: true })
  })

  fastify.get('/auth/me', async (request) => {
    // Autenticação desabilitada — devolve usuário fake quando não há sessão
    return {
      id: request.session.userId ?? 0,
      email: request.session.userEmail ?? 'admin@arm.com',
      name: request.session.userName ?? 'Admin',
    }
  })
}

export default authRoutes
