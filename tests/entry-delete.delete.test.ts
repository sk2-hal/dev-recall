import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, expect, it, vi } from 'vitest'
import { deleteEntry } from '../server/db/entries'
import entryDelete from '../server/api/projects/[projectId]/entries/[entryId].delete'

vi.mock('../server/db/entries', () => ({ deleteEntry: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
const app = createApp()
app.use(createRouter().delete('/api/projects/:projectId/entries/:entryId', entryDelete))
const handleRequest = toWebHandler(app)
const projectId = 'b7427f31-2432-4aa8-a766-5ecbb333ff7b'
const entryId = '407e8117-278a-4cb8-9bc8-799a22075351'
const get = (project = projectId, entry = entryId) => handleRequest(new Request(`http://localhost/api/projects/${encodeURIComponent(project)}/entries/${encodeURIComponent(entry)}`, { method: 'DELETE' }))

it.each([false, true])('正常削除は本文なし204を返す（大文字: %s）', async (uppercase) => {
  const row = { id: entryId, projectId, title: 'Title', body: 'Body\n全文', types: ['decision', 'note'] as ('decision' | 'note')[], createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-02T00:00:00Z') }
  vi.mocked(deleteEntry).mockResolvedValue(row)
  const project = uppercase ? projectId.toUpperCase() : projectId
  const entry = uppercase ? entryId.toUpperCase() : entryId
  const response = await get(project, entry)
  expect(response.status).toBe(204)
  expect(await response.text()).toBe('')
  expect(deleteEntry).toHaveBeenCalledExactlyOnceWith(project, entry)
})

it.each(['invalid', '123', projectId.replaceAll('-', ''), `${projectId}0`, `g${projectId.slice(1)}`, ` ${projectId}`])('不正UUID %sはどちらの引数でもDBを呼ばず400', async (invalid) => {
  expect((await get(invalid, entryId)).status).toBe(400)
  expect((await get(projectId, invalid)).status).toBe(400)
  expect(deleteEntry).not.toHaveBeenCalled()
})

it.each(['Entryなし', 'Projectなし', '別Project所属'])('%sは同じ404', async () => {
  vi.mocked(deleteEntry).mockResolvedValue(undefined)
  const response = await get()
  expect(response.status).toBe(404)
  expect(await response.json()).toMatchObject({ statusCode: 404 })
  expect(deleteEntry).toHaveBeenCalledExactlyOnceWith(projectId, entryId)
})

it('DB例外の接続情報・SQL・内部メッセージを含めず500', async () => {
  vi.mocked(deleteEntry).mockRejectedValue(new Error('INTERNAL_DATABASE_ERROR_MARKER postgres://user:secret@example.invalid/db SELECT * FROM entries'))
  const response = await get()
  const body = await response.json()
  expect(response.status).toBe(500)
  expect(body).toMatchObject({ statusCode: 500, statusMessage: 'Failed to delete Entry' })
  for (const secret of ['INTERNAL_DATABASE_ERROR_MARKER', 'postgres://', 'secret', 'SELECT', 'cause']) {
    expect(JSON.stringify(body)).not.toContain(secret)
  }
})
