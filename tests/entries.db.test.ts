import { drizzle } from 'drizzle-orm/neon-http'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createEntry, updateEntry, deleteEntry, getEntry, listEntries, EntryProjectNotFoundError } from '../server/db/entries'
import { getDb } from '../server/db/index'
import type { EntryType } from '../shared/entry-types'

vi.mock('../server/db/index', () => ({ getDb: vi.fn() }))

// Drizzle自体は実装を使用し、Neonの実行境界だけを差し替える。DBには接続しない。
type Query = { text: string, params: unknown[] }
const query = vi.fn()
const transaction = vi.fn()
const client = Object.assign(() => {}, { query, transaction }) as unknown as NeonQueryFunction<false, false>
const db = drizzle(client)
const projectId = 'b7427f31-2432-4aa8-a766-5ecbb333ff7b'
const entryId = '407e8117-278a-4cb8-9bc8-799a22075351'
const input = { projectId, title: 'Title', body: 'Body', types: ['solution'] as EntryType[] }
const date = new Date('2026-10-01T00:00:00Z')
const row = { ...input, id: entryId, createdAt: date, updatedAt: date, tags: ['Nuxt', 'nuxt'] }
const rowValues = [entryId, projectId, row.title, row.body, row.types, date.toISOString(), date.toISOString(), row.tags]
const batchQueries = () => transaction.mock.calls[0]![0] as Query[]
const compact = (text: string) => text.replace(/\s+/g, ' ').trim()

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getDb).mockReturnValue(db)
  // batchはqueryを構築後、transactionを1回だけ呼ぶ。
  query.mockImplementation((text: string, params: unknown[]) => ({ text, params }))
  transaction.mockImplementation(async (queries: Query[]) => queries.map((_, i) => ({ rows: i === queries.length - 1 ? [rowValues] : [] })))
})
afterEach(() => vi.useRealTimers())

it.each([true, false])('詳細は所属条件とTag集約を1回のSQLで取得する（対象あり: %s）', async (found) => {
  query.mockResolvedValue({ rows: found ? [rowValues] : [] })
  expect(await getEntry(projectId, entryId)).toEqual(found ? row : undefined)
  expect(query).toHaveBeenCalledTimes(1)
  const [text, params] = query.mock.calls[0]!
  expect(compact(text)).toContain('where ("entries"."project_id" = $1 and "entries"."id" = $2) limit $3')
  expect(params).toEqual([projectId, entryId, 1])
  expect(compact(text)).toContain('array_agg(t.name order by t.name collate "C")')
  expect(compact(text)).toContain('where et.entry_id = "entries"."id"')
  expect(compact(text)).toContain('ARRAY[]::text[]')
  expect(transaction).not.toHaveBeenCalled()
})

it.each([
  { keyword: undefined, pattern: null },
  { keyword: '', pattern: null },
  { keyword: ' \t　', pattern: null },
  { keyword: ' Nuxt UI ', pattern: '%Nuxt UI%' },
  { keyword: '100%_!\\', pattern: '%100!%!_!!\\%' },
  { keyword: '\' OR 1=1 --', pattern: '%\' OR 1=1 --%' }
])('一覧は検索条件・順序を維持しTagも1回のSQLで取得: $keyword', async ({ keyword, pattern }) => {
  query.mockResolvedValue({ rows: [rowValues, [...rowValues.slice(0, 7), []]] })
  const result = await listEntries(projectId, keyword)
  expect(result).toEqual([row, { ...row, tags: [] }])
  expect(query).toHaveBeenCalledTimes(1)
  const [text, params] = query.mock.calls[0]!
  expect(compact(text)).toContain(pattern === null
    ? 'where "entries"."project_id" = $1 order by'
    : 'where ("entries"."project_id" = $1 and ("entries"."title" ilike $2 escape \'!\' or "entries"."body" ilike $3 escape \'!\')) order by')
  expect(params).toEqual(pattern === null ? [projectId] : [projectId, pattern, pattern])
  expect(compact(text)).toContain('order by "entries"."created_at" desc, "entries"."id" desc')
  expect(compact(text)).toContain('array_agg(')
  // 外側はentriesのみなので、複数TagがあってもEntryを増幅させない。
  expect(compact(text)).toContain('as "tags" from "entries" where')
})

it.each([['solution'], ['note'], ['decision', 'problem', 'solution', 'learning', 'note']] as EntryType[][])('Type %jとTagを同一トランザクションに保存する', async (...types) => {
  expect(await createEntry({ ...input, types, tags: row.tags })).toEqual(row)
  expect(transaction).toHaveBeenCalledTimes(1)
  const queries = batchQueries()
  expect(queries).toHaveLength(5)
  expect(queries[0]!.text).toContain('insert into "entries"')
  expect(queries[0]!.params).toEqual([expect.any(String), projectId, input.title, input.body, expect.any(String)])
  expect(queries[0]!.params[4]).toContain(types[0])
  const generatedId = queries[0]!.params[0]
  expect(generatedId).toMatch(/^[0-9a-f-]{36}$/)
  expect(queries[4]!.params).toEqual([projectId, generatedId, 1])
  expect(compact(queries[1]!.text)).toContain('order by name collate "C" on conflict (name) do nothing')
  expect(queries[1]!.params).toContain(JSON.stringify(row.tags))
  // Tagの再利用は競合解決後の別statementで取得する（単一CTEの古いsnapshotを避ける）。
  expect(compact(queries[3]!.text)).toContain('from "entries" cross join "tags"')
  expect(compact(queries[3]!.text)).toContain('"tags"."name" in (select jsonb_array_elements_text(')
})

it('Tag未指定の作成は空配列で関連を構築する', async () => {
  await createEntry(input)
  expect(batchQueries()[1]!.params[0]).toBe('[]')
})

it.each([{ tags: undefined }, { tags: [] }, { tags: ['Nuxt', 'nuxt'] }])('PATCH tags=$tagsは省略維持と明示置換を区別する', async ({ tags }) => {
  const now = new Date('2026-10-06T00:00:00Z')
  vi.useFakeTimers()
  vi.setSystemTime(now)
  expect(await updateEntry(projectId, entryId, { ...input, tags })).toEqual(row)
  const queries = batchQueries()
  expect(transaction).toHaveBeenCalledTimes(1)
  expect(queries).toHaveLength(tags === undefined ? 2 : 5)
  expect(compact(queries[0]!.text)).toBe('update "entries" set "title" = $1, "body" = $2, "types" = $3, "updated_at" = $4 where ("entries"."project_id" = $5 and "entries"."id" = $6)')
  expect(queries[0]!.params).toEqual([input.title, input.body, expect.any(String), now.toISOString(), projectId, entryId])
  expect(queries[0]!.text).not.toContain('created_at')
  if (tags !== undefined) {
    expect(queries[1]!.params).toContain(JSON.stringify(tags))
    expect(compact(queries[2]!.text)).toContain('delete from "entry_tags" where')
    expect(queries[2]!.params).toEqual([entryId, projectId, entryId])
  } else {
    expect(queries.map(q => q.text).join(' ')).not.toMatch(/insert into "tags"|delete from "entry_tags"|insert into "entry_tags"/)
  }
})

it('別Project所属・対象なしは全Tag書き込みも所属条件で制限しundefinedを返す', async () => {
  transaction.mockImplementation(async (queries: Query[]) => queries.map(() => ({ rows: [] })))
  expect(await updateEntry(projectId, entryId, { ...input, tags: ['new-tag'] })).toBeUndefined()
  for (const statement of batchQueries()) {
    expect(statement.params).toContain(projectId)
    expect(statement.params).toContain(entryId)
    expect(compact(statement.text)).toMatch(/"entries"\."project_id" = \$\d+ and "entries"\."id" = \$\d+/)
  }
  expect(compact(batchQueries()[1]!.text)).toContain('where exists (select')
})

it('トランザクション失敗を成功にせず、単独実行や後続の再取得をしない', async () => {
  const error = new Error('batch failed')
  transaction.mockRejectedValue(error)
  await expect(updateEntry(projectId, entryId, { ...input, tags: ['Nuxt'] })).rejects.toBe(error)
  expect(transaction).toHaveBeenCalledTimes(1)
  expect(query).toHaveBeenCalledTimes(5)
})

it('作成の返却行がなければ成功にしない', async () => {
  transaction.mockImplementation(async (queries: Query[]) => queries.map(() => ({ rows: [] })))
  await expect(createEntry(input)).rejects.toThrow('Entry insert returned no row')
})

it.each([false, true])('Project外部キー違反を専用例外へ変換する（ラップ: %s）', async (wrapped) => {
  const cause = { code: '23503', constraint: 'entries_project_id_projects_id_fk' }
  transaction.mockRejectedValue(wrapped ? new Error('query failed', { cause }) : cause)
  await expect(createEntry(input)).rejects.toBeInstanceOf(EntryProjectNotFoundError)
})
it.each([
  { code: '23503', constraint: 'another_fk' },
  { code: '23514', constraint: 'entries_types_valid' },
  new Error('connection failed')
])('その他のDBエラーを404にしない: %j', async (error) => {
  transaction.mockRejectedValue(error)
  await expect(createEntry(input)).rejects.toBe(error)
})

it.each([true, false])('削除は所属Entryのみを削除し、共有Tagを削除しない（対象あり: %s）', async (found) => {
  query.mockResolvedValue({ rows: found ? [[entryId]] : [] })
  expect(await deleteEntry(projectId, entryId)).toEqual(found ? { id: entryId } : undefined)
  expect(query).toHaveBeenCalledTimes(1)
  expect(compact(query.mock.calls[0]![0])).toBe('delete from "entries" where ("entries"."project_id" = $1 and "entries"."id" = $2) returning "id"')
  expect(query.mock.calls[0]![1]).toEqual([projectId, entryId])
})
