import { createError, defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { createEntry, EntryProjectNotFoundError } from '../../../db/entries'
import { getProject } from '../../../db/projects'
import { entryTypes, type EntryType } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    throw createError({ statusCode: 400, message: 'Project IDはUUID形式で指定してください。' })
  }
  const input: unknown = await readBody(event)
  const { title, body, types } = input && typeof input === 'object'
    ? input as Record<string, unknown>
    : {}
  if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) {
    throw createError({ statusCode: 400, message: 'タイトルと本文は空白以外の文字を含む文字列で入力してください。' })
  }
  if (!Array.isArray(types) || types.length === 0
    || !types.every((value): value is EntryType => entryTypes.includes(value))
    || new Set(types).size !== types.length) {
    throw createError({ statusCode: 400, message: 'Typeは固定の5種類から重複なく1件以上指定してください。' })
  }

  let entry
  try {
    const project = await getProject(projectId)
    if (project) entry = await createEntry({ projectId: project.id, title: title.trim(), body: body.trim(), types })
  } catch (error) {
    if (!(error instanceof EntryProjectNotFoundError)) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to save Entry', message: 'Entryの保存に失敗しました。' })
    }
  }
  if (!entry) throw createError({ statusCode: 404, message: 'Projectが見つかりません。' })
  setResponseStatus(event, 201)
  return entry
})
