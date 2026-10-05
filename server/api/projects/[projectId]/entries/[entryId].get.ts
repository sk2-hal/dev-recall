import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getEntry } from '../../../../db/entries'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  const entryId = getRouterParam(event, 'entryId')
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!projectId || !uuid.test(projectId)) {
    throw createError({ statusCode: 400, message: 'Project IDはUUID形式で指定してください。' })
  }
  if (!entryId || !uuid.test(entryId)) {
    throw createError({ statusCode: 400, message: 'Entry IDはUUID形式で指定してください。' })
  }

  let entry
  try {
    entry = await getEntry(projectId, entryId)
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load Entry',
      message: 'Entryの取得に失敗しました。'
    })
  }
  if (!entry) {
    throw createError({ statusCode: 404, message: 'Entryが見つかりません。' })
  }
  return entry
})
