import { createError, defineEventHandler, getRouterParam } from 'h3'
import { listEntries } from '../../../db/entries'
import { getProject } from '../../../db/projects'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    throw createError({ statusCode: 400, message: 'Project IDはUUID形式で指定してください。' })
  }
  try {
    const project = await getProject(projectId)
    if (project) return await listEntries(project.id)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load Entries', message: 'Entry一覧の取得に失敗しました。' })
  }
  throw createError({ statusCode: 404, message: 'Projectが見つかりません。' })
})
