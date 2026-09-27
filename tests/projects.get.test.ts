import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listProjects } from '../server/db/projects'
import projectsGet from '../server/api/projects.get'

vi.mock('../server/db/projects', () => ({ listProjects: vi.fn() }))

beforeEach(() => vi.resetAllMocks())

const app = createApp()
app.use(createRouter().get('/api/projects', projectsGet))
const handleRequest = toWebHandler(app)
const getProjects = () => handleRequest(new Request('http://localhost/api/projects'))

describe('GET /api/projects', () => {
  it('DBの取得順でProject配列とISO日時を返す', async () => {
    const rows = ['新しいProject', '古いProject'].map((name, index) => ({
      id: `00000000-0000-0000-0000-00000000000${index}`,
      name,
      createdAt: new Date(`2026-09-${27 - index}T00:00:00.000Z`),
      updatedAt: new Date('2026-09-27T00:00:00.000Z')
    }))
    vi.mocked(listProjects).mockResolvedValue(rows)
    const response = await getProjects()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(JSON.parse(JSON.stringify(rows)))
    expect(listProjects).toHaveBeenCalledExactlyOnceWith()
  })

  it('0件は空配列を返す', async () => {
    vi.mocked(listProjects).mockResolvedValue([])
    const response = await getProjects()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })

  it('DBの内部情報を含めず500を返す', async () => {
    vi.mocked(listProjects).mockRejectedValue(new Error('INTERNAL_DATABASE_ERROR_MARKER'))
    const response = await getProjects()
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body).toMatchObject({ statusCode: 500, statusMessage: 'Failed to load Projects' })
    expect(JSON.stringify(body)).not.toContain('INTERNAL_DATABASE_ERROR_MARKER')
  })
})
