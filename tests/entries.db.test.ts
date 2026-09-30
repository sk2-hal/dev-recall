import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, expect, it, vi } from 'vitest'
import { createEntry, listEntries, EntryProjectNotFoundError } from '../server/db/entries'
import { getDb } from '../server/db/index'
import { entries } from '../server/db/schema'
import type { EntryType } from '../shared/entry-types'

vi.mock('../server/db/index', () => ({ getDb: vi.fn() }))
const returning = vi.fn()
const values = vi.fn(() => ({ returning }))
const insert = vi.fn(() => ({ values }))
const input = { projectId: 'b7427f31-2432-4aa8-a766-5ecbb333ff7b', title: 'Title', body: 'Body', types: ['solution'] as 'solution'[] }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getDb).mockReturnValue({ insert } as unknown as ReturnType<typeof getDb>)
})
it.each<{ types: EntryType[] }>([
  { types: ['solution'] },
  { types: ['note'] },
  { types: ['decision', 'problem', 'solution', 'learning', 'note'] }
])('正しいProject IDとType $typesをINSERTしDB生成値を返す', async ({ types }) => {
  const data = { ...input, types }
  const row = { ...data, id: 'generated-id', createdAt: new Date(), updatedAt: new Date() }
  returning.mockResolvedValue([row])
  expect(await createEntry(data)).toEqual(row)
  expect(insert).toHaveBeenCalledExactlyOnceWith(entries)
  expect(values).toHaveBeenCalledExactlyOnceWith(data)
  expect(returning).toHaveBeenCalledExactlyOnceWith()
})
it('RETURNINGが空なら成功にしない', async () => {
  returning.mockResolvedValue([])
  await expect(createEntry(input)).rejects.toThrow('Entry insert returned no row')
})
it.each([false, true])('Project外部キー違反を専用例外へ変換する（ラップ: %s）', async (wrapped) => {
  const cause = { code: '23503', constraint: 'entries_project_id_projects_id_fk' }
  returning.mockRejectedValue(wrapped ? new Error('query failed', { cause }) : cause)
  await expect(createEntry(input)).rejects.toBeInstanceOf(EntryProjectNotFoundError)
})
it.each([
  { code: '23503', constraint: 'another_fk' },
  { code: '23514', constraint: 'entries_types_valid' },
  new Error('connection failed')
])('その他のDBエラーを404にしない: %j', async (error) => {
  returning.mockRejectedValue(error)
  await expect(createEntry(input)).rejects.toBe(error)
})

it('指定Projectだけを作成日時降順・ID降順の1クエリで取得する', async () => {
  const rows = [{ ...input, id: 'entry-id' }]
  const orderBy = vi.fn().mockResolvedValue(rows)
  const where = vi.fn().mockReturnValue({ orderBy })
  const from = vi.fn().mockReturnValue({ where })
  const select = vi.fn().mockReturnValue({ from })
  vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>)
  expect(await listEntries(input.projectId)).toEqual(rows)
  expect(select).toHaveBeenCalledExactlyOnceWith()
  expect(from).toHaveBeenCalledExactlyOnceWith(entries)
  const dialect = new PgDialect()
  expect(dialect.sqlToQuery(where.mock.calls[0]![0])).toMatchObject({
    sql: '"entries"."project_id" = $1', params: [input.projectId]
  })
  expect(orderBy.mock.calls[0]!.map(expression => dialect.sqlToQuery(expression).sql)).toEqual([
    '"entries"."created_at" desc', '"entries"."id" desc'
  ])
})
