import { createError } from 'h3'
import { entryTypes, type EntryType } from '../../shared/entry-types'

export function parseEntryInput(input: unknown) {
  const { title, body, types } = input && typeof input === 'object'
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
  return { title: title.trim(), body: body.trim(), types }
}
