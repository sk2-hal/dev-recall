import { isUuid } from '../../../utils/uuid'
import { createError, defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { createEntry, EntryProjectNotFoundError } from '../../../db/entries'
import { getProject } from '../../../db/projects'
import { parseEntryInput } from '../../../utils/entry-input'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  if (!isUuid(projectId)) {
    throw createError({ statusCode: 400, message: 'Project IDはUUID形式で指定してください。' })
  }
  const input: unknown = await readBody(event)
  const { title, body, types } = parseEntryInput(input)

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
