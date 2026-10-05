import { and, desc, eq } from 'drizzle-orm'
import { getDb } from './index'
import { entries } from './schema'

export class EntryProjectNotFoundError extends Error {}

export async function getEntry(projectId: string, entryId: string) {
  const [entry] = await getDb().select().from(entries)
    .where(and(eq(entries.projectId, projectId), eq(entries.id, entryId))).limit(1)
  return entry
}

export async function listEntries(projectId: string) {
  return getDb().select().from(entries).where(eq(entries.projectId, projectId))
    .orderBy(desc(entries.createdAt), desc(entries.id))
}

export async function createEntry(input: Pick<typeof entries.$inferInsert, 'projectId' | 'title' | 'body' | 'types'>) {
  try {
    const [entry] = await getDb().insert(entries).values(input).returning()
    if (!entry) throw new Error('Entry insert returned no row')
    return entry
  } catch (error) {
    // Drizzle wraps driver errors in cause. Only this FK violation means the parent disappeared.
    const cause = error instanceof Error && error.cause ? error.cause : error
    if (cause && typeof cause === 'object'
      && 'code' in cause && cause.code === '23503'
      && 'constraint' in cause && cause.constraint === 'entries_project_id_projects_id_fk') {
      throw new EntryProjectNotFoundError()
    }
    throw error
  }
}
