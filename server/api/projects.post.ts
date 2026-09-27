import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'
import { createProject } from '../db/projects'

export default defineEventHandler(async (event) => {
  const body: unknown = await readBody(event)
  const name = body !== null && typeof body === 'object' && 'name' in body
    ? body.name
    : undefined

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Project名は空白以外の文字を含む文字列で入力してください。'
    })
  }

  try {
    const project = await createProject(name.trim())
    setResponseStatus(event, 201)
    return project
  } catch {
    // 元の例外には接続情報が含まれ得るため、レスポンスへ引き継がない。
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save Project',
      message: 'Projectの保存に失敗しました。'
    })
  }
})
