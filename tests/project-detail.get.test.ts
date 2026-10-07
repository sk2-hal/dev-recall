import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProject } from '../server/db/projects'
import projectGet from '../server/api/projects/[projectId].get'

vi.mock('../server/db/projects', () => ({ getProject: vi.fn() }))
beforeEach(() => vi.resetAllMocks())

const app = createApp()
app.use(createRouter().get('/api/projects/:projectId', projectGet))
const handleRequest = toWebHandler(app)
const id = 'b7427f31-2432-4aa8-a766-5ecbb333ff7b'
const get = (value: string) => handleRequest(new Request(`http://localhost/api/projects/${encodeURIComponent(value)}`))

describe('GET /api/projects/:id', () => {
  it.each([id, id.toUpperCase()])('UUID %sでProjectとISO日時を返す', async (value) => {
    const project = { id, name: 'DevRecall', createdAt: new Date('2026-09-27T00:00:00.000Z'), updatedAt: new Date('2026-09-27T00:00:00.000Z') }
    vi.mocked(getProject).mockResolvedValue(project)
    const response = await get(value)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(JSON.parse(JSON.stringify(project)))
    expect(getProject).toHaveBeenCalledExactlyOnceWith(value)
  })

  it.each(['invalid', '123', id.replaceAll('-', ''), `${id}0`, `g${id.slice(1)}`, ` ${id}`])('不正なID %sはDBを呼ばず400', async (value) => {
    const response = await get(value)
    expect(response.status).toBe(400)
    expect(getProject).not.toHaveBeenCalled()
  })

  it('存在しないUUIDは404', async () => {
    vi.mocked(getProject).mockResolvedValue(undefined)
    const response = await get(id)
    expect(response.status).toBe(404)
    expect(getProject).toHaveBeenCalledExactlyOnceWith(id)
  })

  it('DBエラーの内部情報を含めず500', async () => {
    vi.mocked(getProject).mockRejectedValue(new Error('INTERNAL_DATABASE_ERROR_MARKER'))
    const response = await get(id)
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body).toMatchObject({ statusCode: 500, statusMessage: 'Failed to load Project' })
    expect(JSON.stringify(body)).not.toContain('INTERNAL_DATABASE_ERROR_MARKER')
  })
})
