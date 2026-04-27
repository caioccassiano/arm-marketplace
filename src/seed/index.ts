import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import bcrypt from 'bcryptjs'

const SEED_USERS = [
  { email: 'admin@empresa.com', name: 'Administrador', password: 'mudar123' },
]

console.log('Criando usuários...')

for (const u of SEED_USERS) {
  const passwordHash = await bcrypt.hash(u.password, 12)
  await db
    .insert(users)
    .values({ email: u.email, name: u.name, passwordHash })
    .onConflictDoNothing()
  console.log(`  ✓ ${u.email} (senha: ${u.password})`)
}

console.log('Seed concluído.')
process.exit(0)
