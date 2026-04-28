import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sql = postgres(process.env['DATABASE_URL']!, { max: 1 })
const db = drizzle(sql)

await migrate(db, { migrationsFolder: join(__dirname, '..', 'drizzle', 'migrations') })
console.log('Migrations aplicadas com sucesso.')
await sql.end()
