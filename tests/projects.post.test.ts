import { createApp, createRouter, toWebHandler } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject } from '../server/db/projects'
import projectsPost from '../server/api/projects.post'

vi.mock('../server/db/projects', () => ({ createProject: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
})

const app = createApp()
app.use(createRouter().post('/api/projects', projectsPost))
const handleRequest = toWebHandler(app)

function postProject(body?: unknown) {
  return handleRequest(new Request('http://localhost/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  }))
}

describe('POST /api/projects', () => {
  it.each([
    ['通常の名前', 'DevRecall', 'DevRecall'],
    ['前後の空白', ' \t Dev Recall　\n', 'Dev Recall']
  ])('%sを保存して201と作成したProjectを返す', async (_, name, expected) => {
    const project = {
      id: 'b7427f31-2432-4aa8-a766-5ecbb333ff7b',
      name: expected,
      createdAt: new Date('2026-09-27T00:00:00.000Z'),
      updatedAt: new Date('2026-09-27T00:00:00.000Z')
    }
    vi.mocked(createProject).mockResolvedValue(project)
    const response = await postProject({ name })

    expect(createProject).toHaveBeenCalledExactlyOnceWith(expected)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    })
  })

  it.each([
    ['空文字', { name: '' }],
    ['空白のみ', { name: ' \t\n　' }],
    ['数値', { name: 123 }],
    ['真偽値', { name: true }],
    ['null', { name: null }],
    ['配列', { name: ['DevRecall'] }],
    ['オブジェクト', { name: {} }],
    ['名前の未指定', {}],
    ['Bodyなし', undefined],
    ['nullのBody', null],
    ['文字列のBody', 'DevRecall']
  ])('%sは400を返す', async (_, body) => {
    const response = await postProject(body)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ statusCode: 400 })
    expect(createProject).not.toHaveBeenCalled()
  })

  it('DBエラーの詳細を含めず500を返す', async () => {
    const internalDetail = 'INTERNAL_DATABASE_ERROR_MARKER'
    vi.mocked(createProject).mockRejectedValue(new Error(internalDetail))

    const response = await postProject({ name: 'DevRecall' })
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({
      statusCode: 500,
      statusMessage: 'Failed to save Project'
    })
    expect(JSON.stringify(body)).not.toContain(internalDetail)
    expect(createProject).toHaveBeenCalledExactlyOnceWith('DevRecall')
  })
})
