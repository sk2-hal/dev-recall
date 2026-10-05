// @vitest-environment happy-dom
import { shallowMount } from '@vue/test-utils'
import { computed, reactive, ref, watch } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import EntryPage from '../app/pages/projects/[projectId]/entries/[entryId]/edit.vue'
import type { EntryType } from '../shared/entry-types'

const entryId = '407e8117-278a-4cb8-9bc8-799a22075351'
const projectId = 'b7427f31-2432-4aa8-a766-5ecbb333ff7b'
const fetchMock = vi.fn()
const navigateMock = vi.fn()
let wrapper: ReturnType<typeof shallowMount>
let form: {
  state: { title: string, body: string, types: EntryType[] }
  isSaving: boolean
  saveError: string
  saveEntry: () => Promise<void>
}

beforeEach(() => {
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useFetch', () => ({ data: ref({ title: '元のTitle', body: '元のBody', types: ['learning'] }), status: ref('success'), error: ref(null), refresh: vi.fn() }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('useRoute', () => ({ params: { projectId, entryId } }))
  vi.stubGlobal('useSeoMeta', vi.fn())
  vi.stubGlobal('$fetch', fetchMock.mockReset())
  vi.stubGlobal('navigateTo', navigateMock.mockReset())
  wrapper = shallowMount(EntryPage, {
    global: { stubs: ['UContainer', 'UCard', 'UForm', 'UFormField', 'UInput', 'UTextarea', 'UCheckboxGroup', 'UAlert', 'UButton'] }
  })
  form = wrapper.vm as unknown as typeof form
  Object.assign(form.state, { title: ' Title ', body: ' Body ', types: ['decision', 'note'] })
})

afterEach(() => {
  wrapper.unmount()
  vi.unstubAllGlobals()
})

it.each([
  { title: '' }, { title: ' \t　' }, { body: '' }, { body: ' \n　' }, { types: [] }
])('必須入力が不正なら送信しない: %j', async (input) => {
  Object.assign(form.state, input)
  await form.saveEntry()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(navigateMock).not.toHaveBeenCalled()
})

it('複数Typeとnoteを送信し、保存中と保存済みの二重送信を防いで詳細へ戻る', async () => {
  let finish!: () => void
  fetchMock.mockReturnValue(new Promise<void>((resolve) => {
    finish = resolve
  }))
  const pending = form.saveEntry()
  expect(form.isSaving).toBe(true)
  await form.saveEntry()
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/projects/${projectId}/entries/${entryId}`, {
    method: 'PATCH', retry: 0, body: { title: 'Title', body: 'Body', types: ['decision', 'note'] }
  })
  expect(navigateMock).not.toHaveBeenCalled()
  finish()
  await pending
  expect(navigateMock).toHaveBeenCalledExactlyOnceWith(`/projects/${projectId}/entries/${entryId}`)
  await form.saveEntry()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each([400, 500, undefined])('HTTP %s / 通信失敗でも入力を保持し安全なエラーから再試行できる', async (statusCode) => {
  fetchMock.mockRejectedValueOnce(Object.assign(new Error('INTERNAL_ERROR_MARKER'), { statusCode }))
  await form.saveEntry()
  expect(form.state).toEqual({ title: ' Title ', body: ' Body ', types: ['decision', 'note'] })
  expect(form.saveError).toBe(statusCode === 400
    ? '入力内容を確認して、もう一度保存してください。'
    : 'Entryの保存に失敗しました。時間をおいて再試行してください。')
  expect(form.isSaving).toBe(false)
  expect(navigateMock).not.toHaveBeenCalled()
  fetchMock.mockResolvedValueOnce({})
  await form.saveEntry()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(form.saveError).toBe('')
  expect(navigateMock).toHaveBeenCalledTimes(1)
})
