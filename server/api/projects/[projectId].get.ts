import { isUuid } from '../../utils/uuid'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getProject } from '../../db/projects'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'projectId')
  if (!isUuid(id)) {
    throw createError({ statusCode: 400, message: 'Project IDはUUID形式で指定してください。' })
  }

  let project
  try {
    project = await getProject(id)
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load Project',
      message: 'Projectの取得に失敗しました。'
    })
  }

  if (!project) {
    throw createError({ statusCode: 404, message: 'Projectが見つかりません。' })
  }
  return project
})
