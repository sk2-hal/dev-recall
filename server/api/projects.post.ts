import { createError, defineEventHandler, readBody } from 'h3'

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

  // STEP 6-2では入力の確認のみ行い、永続化はしない。
  return { name: name.trim(), saved: false }
})
