import { parseEntryInput } from '../../../../utils/entry-input'
import { isUuid } from '../../../../utils/uuid'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateEntry } from '../../../../db/entries'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  const entryId = getRouterParam(event, 'entryId')
  if (!isUuid(projectId)) {
    throw createError({ statusCode: 400, message: 'Project IDはUUID形式で指定してください。' })
  }
  if (!isUuid(entryId)) {
    throw createError({ statusCode: 400, message: 'Entry IDはUUID形式で指定してください。' })
  }

  const input = parseEntryInput(await readBody(event))

  let entry
  try {
    entry = await updateEntry(projectId, entryId, input)
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update Entry',
      message: 'Entryの更新に失敗しました。'
    })
  }
  if (!entry) {
    throw createError({ statusCode: 404, message: 'Entryが見つかりません。' })
  }
  return entry
})
