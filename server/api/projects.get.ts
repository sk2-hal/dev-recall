import { createError, defineEventHandler } from 'h3'
import { listProjects } from '../db/projects'

export default defineEventHandler(async () => {
  try {
    return await listProjects()
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load Projects',
      message: 'Project一覧の取得に失敗しました。'
    })
  }
})
