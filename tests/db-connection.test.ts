import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { afterEach, expect, it, vi } from 'vitest'
import { getDb } from '../server/db/index'

vi.mock('@neondatabase/serverless', () => ({ neon: vi.fn(() => 'mock-client') }))
vi.mock('drizzle-orm/neon-http', () => ({ drizzle: vi.fn(() => 'mock-db') }))
afterEach(() => vi.unstubAllEnvs())

it('batchの後続statementが競合後のTagを参照できるREAD COMMITTEDを明示する', () => {
  const url = 'postgresql://test:test@example.invalid/test'
  vi.stubEnv('DATABASE_URL', url)
  expect(getDb()).toBe('mock-db')
  expect(neon).toHaveBeenCalledExactlyOnceWith(url, { isolationLevel: 'ReadCommitted' })
  expect(drizzle).toHaveBeenCalledExactlyOnceWith('mock-client')
})
