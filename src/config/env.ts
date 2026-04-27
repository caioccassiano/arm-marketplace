import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  MAGAZORD_API_URL: z.string().url().default('https://api.magazord.com.br'),
  MAGAZORD_API_KEY: z.string().default(''),
  MAGAZORD_STORE_ID: z.string().default(''),

  ML_APP_ID: z.string().default(''),
  ML_APP_SECRET: z.string().default(''),
  ML_SELLER_ID: z.string().default(''),
  ML_ACCESS_TOKEN: z.string().default(''),
  ML_REFRESH_TOKEN: z.string().default(''),

  TIKTOK_APP_KEY: z.string().default(''),
  TIKTOK_APP_SECRET: z.string().default(''),
  TIKTOK_SHOP_CIPHER: z.string().default(''),
  TIKTOK_ACCESS_TOKEN: z.string().default(''),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
