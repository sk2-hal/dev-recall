import { PgDialect } from 'drizzle-orm/pg-core'
import { expect, it, vi } from 'vitest'
import { getDb } from '../server/db/index'
import { listProjects } from '../server/db/projects'
import { projects } from '../server/db/schema'

vi.mock('../server/db/index', () => ({ getDb: vi.fn() }))

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
