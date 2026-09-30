import { beforeEach, expect, it, vi } from 'vitest'
import { createEntry, EntryProjectNotFoundError } from '../server/db/entries'
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
