import { getDb } from './index'
import { projects } from './schema'

export async function createProject(name: string) {
  const [project] = await getDb().insert(projects).values({ name }).returning()
  if (!project) {
    throw new Error('Project insert returned no row')
  }
  return project
}
