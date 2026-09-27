import { desc } from 'drizzle-orm'
import { getDb } from './index'
import { projects } from './schema'

export async function listProjects() {
  return getDb().select().from(projects).orderBy(desc(projects.createdAt), desc(projects.id))
}

export async function createProject(name: string) {
  const [project] = await getDb().insert(projects).values({ name }).returning()
  if (!project) {
    throw new Error('Project insert returned no row')
  }
  return project
}
