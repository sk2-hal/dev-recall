import { isUuid } from '../../../utils/uuid'
import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { listEntries } from '../../../db/entries'
import { getProject } from '../../../db/projects'

export default defineEventHandler(async (event) => {
  const projectId = getRouterParam(event, 'projectId')
  if (!isUuid(projectId)) {
    throw createError({ statusCode: 400, message: 'Project IDはUUID形式で指定してください。' })
  }
  const { q } = getQuery(event)
  if (q !== undefined && typeof q !== 'string') {
    throw createError({ statusCode: 400, message: '検索語は1つの文字列で指定してください。' })
  }
  const keyword = q?.trim() ?? ''
  try {
    const project = await getProject(projectId)
    if (project) return await listEntries(project.id, keyword)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Failed to load Entries', message: 'Entry一覧の取得に失敗しました。' })
  }
  throw createError({ statusCode: 404, message: 'Projectが見つかりません。' })
})
