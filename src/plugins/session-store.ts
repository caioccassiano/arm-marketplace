import type { SessionStore } from '@fastify/session'
import postgres from 'postgres'
import { env } from '../config/env.js'

// Dedicated minimal connection for session storage
const sql = postgres(env.DATABASE_URL, { max: 2, idle_timeout: 30 })

export async function createPgSessionStore(): Promise<SessionStore> {
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      sid  TEXT        PRIMARY KEY,
      sess JSONB       NOT NULL,
      expire TIMESTAMPTZ NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions (expire)`

  // Purge expired sessions every 10 minutes
  setInterval(async () => {
    await sql`DELETE FROM sessions WHERE expire < NOW()`.catch(() => {})
  }, 10 * 60 * 1000)

  return {
    get(sid, callback) {
      sql`SELECT sess FROM sessions WHERE sid = ${sid} AND expire > NOW() LIMIT 1`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(([row]) => callback(null, row ? (row.sess as any) : null))
        .catch((err) => callback(err as Error, null))
    },
    set(sid, session, callback) {
      const expire = new Date(Date.now() + 8 * 60 * 60 * 1000)
      const sessJson = sql.json(JSON.parse(JSON.stringify(session)))
      sql`
        INSERT INTO sessions (sid, sess, expire)
        VALUES (${sid}, ${sessJson}, ${expire})
        ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire
      `
        .then(() => callback(null))
        .catch((err) => callback(err as Error))
    },
    destroy(sid, callback) {
      sql`DELETE FROM sessions WHERE sid = ${sid}`
        .then(() => callback(null))
        .catch((err) => callback(err as Error))
    },
  }
}
