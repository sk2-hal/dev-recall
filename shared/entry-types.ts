export const entryTypes = ['decision', 'problem', 'solution', 'learning', 'note'] as const
export type EntryType = typeof entryTypes[number]

export const entryTypeLabels: Record<EntryType, string> = {
  decision: 'Decision', problem: 'Problem', solution: 'Solution', learning: 'Learning', note: 'Note'
}
