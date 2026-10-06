import { readFileSync } from 'node:fs'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { expect, it } from 'vitest'
import { entries, entryTags, tags } from '../server/db/schema'

it('Tag名は必須・一意、関連は複合主キーで重複しない', () => {
  expect(tags.id.primary).toBe(true)
  expect(tags.name.notNull).toBe(true)
  expect(tags.name.isUnique).toBe(true)
  expect(entryTags.entryId.notNull).toBe(true)
  expect(entryTags.tagId.notNull).toBe(true)
  expect(getTableConfig(entryTags).primaryKeys[0]!.columns.map(column => column.name)).toEqual(['entry_id', 'tag_id'])
})

it('Entry削除は関連のみCASCADEし、共有Tagの削除はRESTRICTする', () => {
  const foreignKeys = getTableConfig(entryTags).foreignKeys
  expect(foreignKeys).toHaveLength(2)
  expect(foreignKeys[0]!.reference().foreignTable).toBe(entries)
  expect(foreignKeys[0]!.onDelete).toBe('cascade')
  expect(foreignKeys[1]!.reference().foreignTable).toBe(tags)
  expect(foreignKeys[1]!.onDelete).toBe('restrict')
})

it('生成migrationは新しい2テーブルとその制約のみ追加する', () => {
  const migration = readFileSync(new URL('../drizzle/0002_dizzy_pet_avengers.sql', import.meta.url), 'utf8')
  expect(migration.match(/CREATE TABLE/g)).toHaveLength(2)
  expect(migration).toContain('PRIMARY KEY("entry_id","tag_id")')
  expect(migration).toContain('UNIQUE("name")')
  expect(migration).toContain('REFERENCES "public"."entries"("id") ON DELETE cascade')
  expect(migration).toContain('REFERENCES "public"."tags"("id") ON DELETE restrict')
  expect(migration).not.toMatch(/DROP |TRUNCATE |UPDATE "|DELETE FROM |ALTER TABLE "entries"|ALTER TABLE "projects"/i)
})
