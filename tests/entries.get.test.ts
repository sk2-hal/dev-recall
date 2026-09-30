import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, expect, it, vi } from 'vitest'
import { getProject } from '../server/db/projects'
import { listEntries } from '../server/db/entries'
import entriesGet from '../server/api/projects/[projectId]/entries.get'

vi.mock('../server/db/projects', () => ({ getProject: vi.fn() }))
vi.mock('../server/db/entries', () => ({ listEntries: vi.fn() }))
const id = 'b7427f31-2432-4aa8-a766-5ecbb333ff7b'
const project = { id, name: 'Project', createdAt: new Date(), updatedAt: new Date() }
const app = createApp()
app.use(createRouter().get('/api/projects/:projectId/entries', entriesGet))
const handleRequest = toWebHandler(app)
const get = (value = id) => handleRequest(new Request(`http://localhost/api/projects/${encodeURIComponent(value)}/entries`))
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getProject).mockResolvedValue(project)
})

it.each(['invalid', '123', id.replaceAll('-', ''), `${id}0`, `g${id.slice(1)}`, ` ${id}`])('不正UUID %sはDBアクセスせず400', async (value) => {
  expect((await get(value)).status).toBe(400)
  expect(getProject).not.toHaveBeenCalled()
  expect(listEntries).not.toHaveBeenCalled()
})
it('Projectなしは404、Entryを検索しない', async () => {
  vi.mocked(getProject).mockResolvedValue(undefined)
  expect((await get()).status).toBe(404)
  expect(listEntries).not.toHaveBeenCalled()
})
it.each([false, true])('Entry一覧とISO日時を返す（Entryあり: %s）', async (exists) => {
  const rows = exists ? [{ id: 'entry-id', projectId: id, title: 'Title', body: 'Body', types: ['decision', 'note'] as ('decision' | 'note')[], createdAt: project.createdAt, updatedAt: project.updatedAt }] : []
  vi.mocked(listEntries).mockResolvedValue(rows)
  const response = await get(id.toUpperCase())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(JSON.parse(JSON.stringify(rows)))
  expect(getProject).toHaveBeenCalledExactlyOnceWith(id.toUpperCase())
  expect(listEntries).toHaveBeenCalledExactlyOnceWith(id)
})
it.each(['project', 'entries'])('%s取得失敗は内部情報を含めず500', async (stage) => {
  const error = new Error('INTERNAL_DATABASE_ERROR_MARKER SELECT * FROM entries postgresql://secret')
  if (stage === 'project') vi.mocked(getProject).mockRejectedValue(error)
  else vi.mocked(listEntries).mockRejectedValue(error)
  const response = await get()
  const body = await response.json()
  expect(response.status).toBe(500)
  expect(body).toMatchObject({ statusCode: 500, statusMessage: 'Failed to load Entries' })
  for (const detail of ['INTERNAL_DATABASE_ERROR_MARKER', 'SELECT', 'postgresql://secret']) {
    expect(JSON.stringify(body)).not.toContain(detail)
  }
})
