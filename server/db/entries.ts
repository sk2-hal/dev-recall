import { randomUUID } from 'node:crypto'
import { and, desc, eq, exists, getTableColumns, or, sql } from 'drizzle-orm'
import { getDb } from './index'
import { entries, entryTags, tags } from './schema'

export class EntryProjectNotFoundError extends Error {}

// 1 SQLでTagを配列化するため、Entryの重複もAPIからのN+1問い合わせも発生しない。
const entrySelection = {
  ...getTableColumns(entries),
  tags: sql<string[]>`coalesce((
    select array_agg(t.name order by t.name collate "C")
    from ${entryTags} et inner join ${tags} t on et.tag_id = t.id
    where et.entry_id = ${entries}.${sql.identifier(entries.id.name)}
  ), ARRAY[]::text[])`.as('tags')
}

function selectEntry(db: ReturnType<typeof getDb>, projectId: string, entryId: string) {
  return db.select(entrySelection).from(entries)
    .where(and(eq(entries.projectId, projectId), eq(entries.id, entryId))).limit(1)
}

export async function getEntry(projectId: string, entryId: string) {
  const [entry] = await selectEntry(getDb(), projectId, entryId)
  return entry
}

export async function listEntries(projectId: string, query = '') {
  const keyword = query.trim()
  // ESCAPEを明示し、!・%・_をリテラルにする。バックスラッシュも通常の文字として扱う。
  const pattern = `%${keyword.replace(/[!%_]/g, '!$&')}%`
  const projectCondition = eq(entries.projectId, projectId)
  const condition = keyword
    ? and(projectCondition, or(
        sql`${entries.title} ilike ${pattern} escape '!'`,
        sql`${entries.body} ilike ${pattern} escape '!'`
      ))
    : projectCondition
  return getDb().select(entrySelection).from(entries).where(condition)
    .orderBy(desc(entries.createdAt), desc(entries.id))
}

// 先行するEntryのINSERT/UPDATEと同じbatch内でのみ実行する。
// 全SQLを所属条件で制限し、対象なしのPATCHでは共有Tagにも変更を残さない。
function replaceTags(db: ReturnType<typeof getDb>, projectId: string, entryId: string, names: string[]) {
  const condition = and(eq(entries.projectId, projectId), eq(entries.id, entryId))
  const targetExists = exists(db.select({ id: entries.id }).from(entries).where(condition))
  const namesJson = JSON.stringify(names)
  return [
    db.execute(sql`insert into ${tags} (name)
      select name from jsonb_array_elements_text(${namesJson}::jsonb) as input(name)
      where ${targetExists}
      order by name collate "C"
      on conflict (name) do nothing`),
    db.delete(entryTags).where(and(eq(entryTags.entryId, entryId), targetExists)),
    // 別statementのREAD COMMITTEDスナップショットで、競合相手が作成したTagも取得する。
    db.execute(sql`insert into ${entryTags} (entry_id, tag_id)
      select ${entries.id}, ${tags.id} from ${entries} cross join ${tags}
      where ${condition}
        and ${tags.name} in (select jsonb_array_elements_text(${namesJson}::jsonb))`)
  ] as const
}

type EntryInput = Pick<typeof entries.$inferInsert, 'title' | 'body' | 'types'> & { tags?: string[] }

export async function createEntry(input: EntryInput & { projectId: string }) {
  try {
    const db = getDb()
    // batchは途中の返却値で分岐できないため、Entry UUIDを先に生成する。
    const id = randomUUID()
    const [, , , , [entry]] = await db.batch([
      db.insert(entries).values({ id, projectId: input.projectId, title: input.title, body: input.body, types: input.types }),
      ...replaceTags(db, input.projectId, id, input.tags ?? []),
      selectEntry(db, input.projectId, id)
    ])
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

export async function updateEntry(projectId: string, entryId: string, input: EntryInput) {
  const db = getDb()
  // このUPDATEの行ロックをbatchのcommitまで保持し、同じEntryの関連置換を直列化する。
  const update = db.update(entries)
    .set({ title: input.title, body: input.body, types: input.types, updatedAt: new Date() })
    .where(and(eq(entries.projectId, projectId), eq(entries.id, entryId)))
  if (input.tags === undefined) {
    const [, [entry]] = await db.batch([update, selectEntry(db, projectId, entryId)])
    return entry
  }
  const [, , , , [entry]] = await db.batch([
    update,
    ...replaceTags(db, projectId, entryId, input.tags),
    selectEntry(db, projectId, entryId)
  ])
  return entry
}

export async function deleteEntry(projectId: string, entryId: string) {
  const [entry] = await getDb().delete(entries)
    .where(and(eq(entries.projectId, projectId), eq(entries.id, entryId))).returning({ id: entries.id })
  return entry
}
