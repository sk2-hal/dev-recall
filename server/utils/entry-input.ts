import { createError } from 'h3'
import { entryTypes, type EntryType } from '../../shared/entry-types'

export function parseEntryInput(input: unknown) {
  const { title, body, types, tags } = input && typeof input === 'object'
    ? input as Record<string, unknown>
    : {}
  if (typeof title !== 'string' || !title.trim() || typeof body !== 'string' || !body.trim()) {
    throw createError({ statusCode: 400, message: 'タイトルと本文は空白以外の文字を含む文字列で入力してください。' })
  }
  if (!Array.isArray(types) || types.length === 0
    || !types.every((value): value is EntryType => entryTypes.includes(value))
    || new Set(types).size !== types.length) {
    throw createError({ statusCode: 400, message: 'Typeは固定の5種類から重複なく1件以上指定してください。' })
  }
  if (tags !== undefined && (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string'))) {
    throw createError({ statusCode: 400, message: 'Tagは文字列の配列で指定してください。' })
  }
  const normalizedTags = tags === undefined ? undefined : [...new Set((tags as string[]).map(tag => tag.trim()).filter(Boolean))]
  return { title: title.trim(), body: body.trim(), types, ...(normalizedTags === undefined ? {} : { tags: normalizedTags }) }
}
