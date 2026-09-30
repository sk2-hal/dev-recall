import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, expect, it, vi } from 'vitest'
import { createEntry, EntryProjectNotFoundError } from '../server/db/entries'
import { getProject } from '../server/db/projects'
import handler from '../server/api/projects/[projectId]/entries.post'
import type { EntryType } from '../server/db/schema'

vi.mock('../server/db/projects', () => ({ getProject: vi.fn() }))
vi.mock('../server/db/entries', () => ({ createEntry: vi.fn(), EntryProjectNotFoundError: class extends Error {} }))
const id = 'b7427f31-2432-4aa8-a766-5ecbb333ff7b'
const date = new Date('2026-09-27T00:00:00.000Z')
const valid = { title: 'Title', body: 'Body', types: ['decision', 'learning'] }
const entry = { ...valid, types: ['decision', 'learning'] as ('decision' | 'learning')[], id: 'a7427f31-2432-4aa8-a766-5ecbb333ff7b', projectId: id, createdAt: date, updatedAt: date }
const app = createApp().use(createRouter().post('/api/projects/:projectId/entries', handler))
const request = toWebHandler(app)
const post = (body: unknown = valid, projectId = id) => request(new Request(`http://localhost/api/projects/${encodeURIComponent(projectId)}/entries`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
}))
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getProject).mockResolvedValue({ id, name: 'Project', createdAt: date, updatedAt: date })
  vi.mocked(createEntry).mockResolvedValue(entry)
})
it.each([id, id.toUpperCase()])('201と保存結果・ISO日時を返し空白を除去する: %s', async (projectId) => {
  const response = await post({ ...valid, title: ' \tTitle　', body: '\nBody \t', projectId: entry.id }, projectId)
  expect(response.status).toBe(201)
  expect(await response.json()).toEqual(JSON.parse(JSON.stringify(entry)))
  expect(getProject).toHaveBeenCalledExactlyOnceWith(projectId)
  expect(createEntry).toHaveBeenCalledExactlyOnceWith({ ...valid, projectId: id })
})
it.each(['title', 'body'])('%sの不正値を400にする', async (field) => {
  for (const value of ['', ' \t\n　', null, 123, [], {}, undefined]) {
    expect((await post({ ...valid, [field]: value })).status).toBe(400)
  }
  expect(getProject).not.toHaveBeenCalled()
  expect(createEntry).not.toHaveBeenCalled()
})
it.each<{ types: EntryType[] }>([
  { types: ['note'] },
  { types: ['decision', 'problem', 'solution', 'learning', 'note'] }
])('noteを含むType $typesを保存して201', async ({ types }) => {
  const saved = { ...entry, types }
  vi.mocked(createEntry).mockResolvedValue(saved)
  const response = await post({ ...valid, types })
  expect(response.status).toBe(201)
  expect(await response.json()).toEqual(JSON.parse(JSON.stringify(saved)))
  expect(createEntry).toHaveBeenCalledExactlyOnceWith({ ...valid, types, projectId: id })
})
it.each([[], ['decision', 'decision'], ['note', 'note'], ['unknown'], ['note', 'unknown'], ['Decision'], [null], 'decision', null, undefined])('不正なType %jは400', async (types) => {
  expect((await post({ ...valid, types })).status).toBe(400)
  expect(getProject).not.toHaveBeenCalled()
  expect(createEntry).not.toHaveBeenCalled()
})
it.each([null, [], 'text', {}])('不正Body %jは400', async (body) => {
  expect((await post(body)).status).toBe(400)
  expect(getProject).not.toHaveBeenCalled()
})
it.each(['invalid', id.replaceAll('-', ''), ` ${id}`, `g${id.slice(1)}`])('不正UUID %sはDBを呼ばず400', async (projectId) => {
  expect((await post(valid, projectId)).status).toBe(400)
  expect(getProject).not.toHaveBeenCalled()
  expect(createEntry).not.toHaveBeenCalled()
})
it('Projectなしは保存せず404', async () => {
  vi.mocked(getProject).mockResolvedValue(undefined)
  expect((await post()).status).toBe(404)
  expect(createEntry).not.toHaveBeenCalled()
})
it('存在確認後の削除競合は404', async () => {
  vi.mocked(createEntry).mockRejectedValue(new EntryProjectNotFoundError())
  expect((await post()).status).toBe(404)
})
it.each(['lookup', 'insert'])('%sのDB詳細を漏らさず固定500', async (stage) => {
  const error = new Error('INTERNAL_SQL_CONNECTION_MARKER')
  if (stage === 'lookup') vi.mocked(getProject).mockRejectedValue(error)
  else vi.mocked(createEntry).mockRejectedValue(error)
  const response = await post()
  const body = await response.json()
  expect(response.status).toBe(500)
  expect(body).toMatchObject({ statusMessage: 'Failed to save Entry' })
  expect(JSON.stringify(body)).not.toContain(error.message)
})
