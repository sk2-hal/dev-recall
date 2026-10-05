import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, expect, it, vi } from 'vitest'
import { updateEntry } from '../server/db/entries'
import handler from '../server/api/projects/[projectId]/entries/[entryId].patch'
import type { EntryType } from '../shared/entry-types'

vi.mock('../server/db/entries', () => ({ updateEntry: vi.fn() }))
const id = 'b7427f31-2432-4aa8-a766-5ecbb333ff7b'
const date = new Date('2026-09-27T00:00:00.000Z')
const valid = { title: 'Title', body: 'Body', types: ['decision', 'learning'] }
const entry = { ...valid, types: ['decision', 'learning'] as ('decision' | 'learning')[], id: 'a7427f31-2432-4aa8-a766-5ecbb333ff7b', projectId: id, createdAt: date, updatedAt: date }
const app = createApp().use(createRouter().patch('/api/projects/:projectId/entries/:entryId', handler))
const request = toWebHandler(app)
const patch = (body: unknown = valid, projectId = id, entryId = entry.id) => request(new Request(`http://localhost/api/projects/${encodeURIComponent(projectId)}/entries/${encodeURIComponent(entryId)}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
}))
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(updateEntry).mockResolvedValue(entry)
})
it.each([id, id.toUpperCase()])('200と保存結果・ISO日時を返し空白を除去する: %s', async (projectId) => {
  const response = await patch({ ...valid, title: ' \tTitle　', body: '\nBody \t', projectId: entry.id }, projectId)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(JSON.parse(JSON.stringify(entry)))
  expect(updateEntry).toHaveBeenCalledExactlyOnceWith(projectId, entry.id, valid)
})
it.each(['title', 'body'])('%sの不正値を400にする', async (field) => {
  for (const value of ['', ' \t\n　', null, 123, [], {}, undefined]) {
    expect((await patch({ ...valid, [field]: value })).status).toBe(400)
  }
  expect(updateEntry).not.toHaveBeenCalled()
})
it.each<{ types: EntryType[] }>([
  { types: ['note'] },
  { types: ['decision', 'problem', 'solution', 'learning', 'note'] }
])('noteを含むType $typesを保存して200', async ({ types }) => {
  const saved = { ...entry, types }
  vi.mocked(updateEntry).mockResolvedValue(saved)
  const response = await patch({ ...valid, types })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(JSON.parse(JSON.stringify(saved)))
  expect(updateEntry).toHaveBeenCalledExactlyOnceWith(id, entry.id, { ...valid, types })
})
it.each([[], ['decision', 'decision'], ['note', 'note'], ['unknown'], ['note', 'unknown'], ['Decision'], [null], 'decision', null, undefined])('不正なType %jは400', async (types) => {
  expect((await patch({ ...valid, types })).status).toBe(400)
  expect(updateEntry).not.toHaveBeenCalled()
})
it.each([null, [], 'text', {}])('不正Body %jは400', async (body) => {
  expect((await patch(body)).status).toBe(400)
})
it.each(['invalid', id.replaceAll('-', ''), ` ${id}`, `g${id.slice(1)}`])('不正UUID %sはDBを呼ばず400', async (projectId) => {
  expect((await patch(valid, projectId)).status).toBe(400)
  expect(updateEntry).not.toHaveBeenCalled()
})
it.each(['invalid', id.replaceAll('-', '')])('不正Entry UUID %sはDBを呼ばず400', async (entryId) => {
  expect((await patch(valid, id, entryId)).status).toBe(400)
  expect(updateEntry).not.toHaveBeenCalled()
})
it.each(['Projectなし', 'Entryなし', '別Project所属'])('%sは404', async () => {
  vi.mocked(updateEntry).mockResolvedValue(undefined)
  expect((await patch()).status).toBe(404)
  expect(updateEntry).toHaveBeenCalledExactlyOnceWith(id, entry.id, valid)
})
it('DB詳細を漏らさず500', async () => {
  vi.mocked(updateEntry).mockRejectedValue(new Error('INTERNAL_SQL_CONNECTION_MARKER postgres://user:secret@example.invalid/db UPDATE entries'))
  const response = await patch()
  const body = await response.json()
  expect(response.status).toBe(500)
  expect(body).toMatchObject({ statusMessage: 'Failed to update Entry' })
  for (const secret of ['INTERNAL_SQL_CONNECTION_MARKER', 'postgres://', 'secret', 'UPDATE', 'cause']) {
    expect(JSON.stringify(body)).not.toContain(secret)
  }
})
