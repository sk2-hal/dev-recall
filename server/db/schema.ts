import { sql } from 'drizzle-orm'
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { EntryType } from '../../shared/entry-types'

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
})

export const entries = pgTable('entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  types: text('types').array().$type<EntryType[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, table => [
  check('entries_title_not_blank', sql`${table.title} ~ '[^[:space:]\u3000]'`),
  check('entries_body_not_blank', sql`${table.body} ~ '[^[:space:]\u3000]'`),
  check('entries_types_valid', sql`array_ndims(${table.types}) = 1
    AND cardinality(${table.types}) BETWEEN 1 AND 5
    AND ${table.types} <@ ARRAY['decision', 'problem', 'solution', 'learning', 'note']::text[]
    AND array_position(${table.types}, NULL) IS NULL
    AND cardinality(array_positions(${table.types}, 'decision')) <= 1
    AND cardinality(array_positions(${table.types}, 'problem')) <= 1
    AND cardinality(array_positions(${table.types}, 'solution')) <= 1
    AND cardinality(array_positions(${table.types}, 'learning')) <= 1
    AND cardinality(array_positions(${table.types}, 'note')) <= 1`)
])
