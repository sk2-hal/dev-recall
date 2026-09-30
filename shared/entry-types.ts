export const entryTypes = ['decision', 'problem', 'solution', 'learning', 'note'] as const
export type EntryType = typeof entryTypes[number]
