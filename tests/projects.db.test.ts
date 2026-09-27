import { PgDialect } from 'drizzle-orm/pg-core'
import { expect, it, vi } from 'vitest'
import { getDb } from '../server/db/index'
import { getProject, listProjects } from '../server/db/projects'
import { projects } from '../server/db/schema'

vi.mock('../server/db/index', () => ({ getDb: vi.fn() }))

it.each([true, false])('指定IDをパラメーター化して1件取得する（存在：%s）', async (exists) => {
  const id = 'b7427f31-2432-4aa8-a766-5ecbb333ff7b'
  const row = { id, name: 'DevRecall' }
  const limit = vi.fn().mockResolvedValue(exists ? [row] : [])
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where })
  const select = vi.fn().mockReturnValue({ from })
  vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>)
  expect(await getProject(id)).toEqual(exists ? row : undefined)
  expect(from).toHaveBeenCalledExactlyOnceWith(projects)
  expect(limit).toHaveBeenCalledExactlyOnceWith(1)
  expect(new PgDialect().sqlToQuery(where.mock.calls[0]![0])).toMatchObject({
    sql: '"projects"."id" = $1', params: [id]
  })
})

it('作成日時の降順、同日時はIDの降順で取得する', async () => {
  const orderBy = vi.fn().mockResolvedValue([])
  const from = vi.fn().mockReturnValue({ orderBy })
  const select = vi.fn().mockReturnValue({ from })
  vi.mocked(getDb).mockReturnValue({ select } as unknown as ReturnType<typeof getDb>)
  expect(await listProjects()).toEqual([])
  expect(from).toHaveBeenCalledExactlyOnceWith(projects)
  const dialect = new PgDialect()
  expect(orderBy.mock.calls[0]!.map(expression => dialect.sqlToQuery(expression).sql)).toEqual([
    '"projects"."created_at" desc',
    '"projects"."id" desc'
  ])
})
