// @vitest-environment happy-dom
import { shallowMount } from '@vue/test-utils'
import { computed, reactive, ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import EntryPage from '../app/pages/projects/[projectId]/entries/new.vue'
import type { EntryType } from '../shared/entry-types'

const projectId = 'b7427f31-2432-4aa8-a766-5ecbb333ff7b'
const fetchMock = vi.fn()
const navigateMock = vi.fn()
let wrapper: ReturnType<typeof shallowMount>
let form: {
  state: { title: string, body: string, types: EntryType[], tags: string[] }
  isSaving: boolean
  saveError: string
  saveEntry: () => Promise<void>
}

beforeEach(() => {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('useRoute', () => ({ params: { projectId } }))
  vi.stubGlobal('useSeoMeta', vi.fn())
  vi.stubGlobal('$fetch', fetchMock.mockReset())
  vi.stubGlobal('navigateTo', navigateMock.mockReset())
  wrapper = shallowMount(EntryPage, {
    global: { stubs: ['UContainer', 'UCard', 'UForm', 'UFormField', 'UInput', 'UTextarea', 'UCheckboxGroup', 'UAlert', 'UButton'] }
  })
  form = wrapper.vm as unknown as typeof form
  Object.assign(form.state, { title: ' Title ', body: ' Body ', types: ['decision', 'note'], tags: [] })
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
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/projects/${projectId}/entries`, {
    method: 'POST', retry: 0, body: { title: 'Title', body: 'Body', types: ['decision', 'note'], tags: [] }
  })
  expect(navigateMock).not.toHaveBeenCalled()
  finish()
  await pending
  expect(navigateMock).toHaveBeenCalledExactlyOnceWith(`/projects/${projectId}`)
  await form.saveEntry()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each([400, 500, undefined])('HTTP %s / 通信失敗でも入力を保持し安全なエラーから再試行できる', async (statusCode) => {
  fetchMock.mockRejectedValueOnce(Object.assign(new Error('INTERNAL_ERROR_MARKER'), { statusCode }))
  await form.saveEntry()
  expect(form.state).toEqual({ title: ' Title ', body: ' Body ', types: ['decision', 'note'], tags: [] })
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

it('Tagを正規化して送信し、失敗時も入力を保持する', async () => {
  form.state.tags = [' Nuxt ', '', 'Nuxt', 'nuxt', '<tag>', 'a,b']
  fetchMock.mockRejectedValueOnce(new Error('network'))
  await form.saveEntry()
  expect(fetchMock.mock.calls[0]![1].body.tags).toEqual(['Nuxt', 'nuxt', '<tag>', 'a,b'])
  expect(form.state.tags).toEqual([' Nuxt ', '', 'Nuxt', 'nuxt', '<tag>', 'a,b'])
  form.state.tags = []
  fetchMock.mockResolvedValueOnce({})
  await form.saveEntry()
  expect(fetchMock.mock.calls[1]![1].body.tags).toEqual([])
})
