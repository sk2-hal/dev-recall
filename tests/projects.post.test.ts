import { createApp, createRouter, toWebHandler } from 'h3'
import { describe, expect, it } from 'vitest'
import projectsPost from '../server/api/projects.post'

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
  ])('%sは200と未保存の確認用JSONを返す', async (_, name, expected) => {
    const response = await postProject({ name })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ name: expected, saved: false })
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
  })
})
