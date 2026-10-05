import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, expect, it, vi } from 'vitest'
import { createEntry, updateEntry, deleteEntry, getEntry, listEntries, EntryProjectNotFoundError } from '../server/db/entries'
import { getDb } from '../server/db/index'
import { entries } from '../server/db/schema'
import type { EntryType } from '../shared/entry-types'

vi.mock('../server/db/index', () => ({ getDb: vi.fn() }))

it.each([true, false])('詳細はProjectとEntryのAND条件で1件取得する（対象あり: %s）', async (found) => {
  const entryId = '407e8117-278a-4cb8-9bc8-799a22075351'
  const row = { ...input, id: entryId }
  const limit = vi.fn().mockResolvedValue(found ? [row] : [])
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>)
  expect(await getEntry(input.projectId, entryId)).toEqual(found ? row : undefined)
  expect(select).toHaveBeenCalledExactlyOnceWith()
  expect(from).toHaveBeenCalledExactlyOnceWith(entries)
  expect(where).toHaveBeenCalledTimes(1)
  // ORやEntry IDだけの検索では別ProjectのEntryが混入するため、実際のSQLと引数を検証する。
  expect(new PgDialect().sqlToQuery(where.mock.calls[0]![0])).toMatchObject({
    sql: '("entries"."project_id" = $1 and "entries"."id" = $2)',
    params: [input.projectId, entryId]
  })
  expect(limit).toHaveBeenCalledExactlyOnceWith(1)
})
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

it.each([true, false])('更新は所属をAND条件で保証し、更新日時だけを変更する（対象あり: %s）', async (found) => {
  const now = new Date('2026-10-05T10:00:00Z')
  vi.useFakeTimers()
  vi.setSystemTime(now)
  try {
    const entryId = '407e8117-278a-4cb8-9bc8-799a22075351'
    const changes = { title: 'Updated title', body: 'Updated body', types: ['decision', 'note'] as EntryType[] }
    const row = { ...changes, projectId: input.projectId, id: entryId, createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: now }
    const returning = vi.fn().mockResolvedValue(found ? [row] : [])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    const update = vi.fn().mockReturnValue({ set })
    vi.mocked(getDb).mockReturnValue({ update } as unknown as ReturnType<typeof getDb>)
    expect(await updateEntry(input.projectId, entryId, changes)).toEqual(found ? row : undefined)
    expect(update).toHaveBeenCalledExactlyOnceWith(entries)
    // 完全一致でcreatedAtやprojectIdがSETに含まれないことも保証する。
    expect(set).toHaveBeenCalledExactlyOnceWith({ ...changes, updatedAt: now })
    expect(new PgDialect().sqlToQuery(where.mock.calls[0]![0])).toMatchObject({
      sql: '("entries"."project_id" = $1 and "entries"."id" = $2)', params: [input.projectId, entryId]
    })
    expect(returning).toHaveBeenCalledExactlyOnceWith()
  } finally {
    vi.useRealTimers()
  }
})

it.each([true, false])('削除はProjectとEntryのAND条件で1件だけを対象にする（対象あり: %s）', async (found) => {
  const entryId = '407e8117-278a-4cb8-9bc8-799a22075351'
  const row = { id: entryId }
  const returning = vi.fn().mockResolvedValue(found ? [row] : [])
  const where = vi.fn().mockReturnValue({ returning })
  const remove = vi.fn().mockReturnValue({ where })
  vi.mocked(getDb).mockReturnValue({ delete: remove } as unknown as ReturnType<typeof getDb>)
  expect(await deleteEntry(input.projectId, entryId)).toEqual(found ? row : undefined)
  expect(remove).toHaveBeenCalledExactlyOnceWith(entries)
  expect(where).toHaveBeenCalledTimes(1)
  expect(new PgDialect().sqlToQuery(where.mock.calls[0]![0])).toMatchObject({
    sql: '("entries"."project_id" = $1 and "entries"."id" = $2)', params: [input.projectId, entryId]
  })
  expect(returning).toHaveBeenCalledExactlyOnceWith({ id: entries.id })
})

it.each([
  { query: '', pattern: null },
  { query: ' \t　', pattern: null },
  { query: ' Nuxt UI ', pattern: '%Nuxt UI%' },
  { query: '100%_!\\', pattern: '%100!%!_!!\\%' },
  { query: '\' OR 1=1 --', pattern: '%\' OR 1=1 --%' }
])('検索はProject AND（タイトル OR 本文）、特殊文字をエスケープし順序を維持する: $query', async ({ query, pattern }) => {
  const rows = [{ ...input, id: 'entry-id' }]
  const orderBy = vi.fn().mockResolvedValue(rows)
  const where = vi.fn().mockReturnValue({ orderBy })
  const from = vi.fn().mockReturnValue({ where })
  const select = vi.fn().mockReturnValue({ from })
  vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>)
  expect(await listEntries(input.projectId, query)).toEqual(rows)
  expect(select).toHaveBeenCalledExactlyOnceWith()
  expect(from).toHaveBeenCalledExactlyOnceWith(entries)
  const dialect = new PgDialect()
  expect(dialect.sqlToQuery(where.mock.calls[0]![0])).toMatchObject(pattern === null
    ? { sql: '"entries"."project_id" = $1', params: [input.projectId] }
    : {
        sql: '("entries"."project_id" = $1 and ("entries"."title" ilike $2 escape \'!\' or "entries"."body" ilike $3 escape \'!\'))',
        params: [input.projectId, pattern, pattern]
      })
  expect(orderBy.mock.calls[0]!.map(expression => dialect.sqlToQuery(expression).sql)).toEqual([
    '"entries"."created_at" desc', '"entries"."id" desc'
  ])
})
