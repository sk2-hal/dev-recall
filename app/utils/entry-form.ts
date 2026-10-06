import type { FormError } from '@nuxt/ui'
import type { EntryType } from '../../shared/entry-types'

export type EntryFormState = { title: string, body: string, types: EntryType[], tags: string[] }

export function validateEntry(input: EntryFormState): FormError[] {
  const errors: FormError[] = []
  if (!input.title.trim()) errors.push({ name: 'title', message: 'Titleを入力してください（空白のみは使えません）。' })
  if (!input.body.trim()) errors.push({ name: 'body', message: 'Bodyを入力してください（空白のみは使えません）。' })
  if (!input.types.length) errors.push({ name: 'types', message: 'Typeを1件以上選択してください。' })
  return errors
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(tag => tag.trim()).filter(Boolean))]
}
