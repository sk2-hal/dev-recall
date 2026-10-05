import { isUuid } from '../../../../utils/uuid'
import { createError, defineEventHandler, getRouterParam, sendNoContent } from 'h3'
import { deleteEntry } from '../../../../db/entries'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  const entryId = getRouterParam(event, 'entryId')
  if (!isUuid(projectId)) {
    throw createError({ statusCode: 400, message: 'Project IDはUUID形式で指定してください。' })
  }
  if (!isUuid(entryId)) {
    throw createError({ statusCode: 400, message: 'Entry IDはUUID形式で指定してください。' })
  }

  let entry
  try {
    entry = await deleteEntry(projectId, entryId)
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete Entry',
      message: 'Entryの削除に失敗しました。'
    })
  }
  if (!entry) {
    throw createError({ statusCode: 404, message: 'Entryが見つかりません。' })
  }
  return sendNoContent(event)
})
