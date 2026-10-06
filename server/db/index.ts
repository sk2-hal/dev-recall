import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  // batch内の後続SQLが、同名Tagの競合解決後にコミットされた行を参照できるよう明示する。
  return drizzle(neon(databaseUrl, { isolationLevel: 'ReadCommitted' }))
}
