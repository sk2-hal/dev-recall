// @vitest-environment happy-dom
import { shallowMount } from '@vue/test-utils'
import { nextTick, reactive, ref, watch } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectsPage from '../app/pages/index.vue'

interface ProjectForm {
  state: { name: string }
  isSaving: boolean
  savedProjectName: string
  saveError: string
  saveProject: () => Promise<void>
}

const fetchMock = vi.fn()
const refreshMock = vi.fn()
let wrapper: ReturnType<typeof shallowMount>
let form: ProjectForm

beforeEach(() => {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('reactive', reactive)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useSeoMeta', vi.fn())
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useFetch', vi.fn(() => ({
    data: ref([]), status: ref('success'), error: ref(null), refresh: refreshMock
  })))
  refreshMock.mockReset().mockResolvedValue(undefined)
  fetchMock.mockReset()
  wrapper = shallowMount(ProjectsPage, {
    global: {
      stubs: ['UContainer', 'UBadge', 'UButton', 'UCard', 'UForm', 'UFormField', 'UInput', 'UEmpty', 'UAlert']
    }
  })
  form = wrapper.vm as unknown as ProjectForm
})

afterEach(() => {
  wrapper.unmount()
  vi.unstubAllGlobals()
})

describe('Project作成フォームの送信', () => {
  it('trimした名前を1回POSTし、APIの名前を表示用に保持して入力を空にする', async () => {
    fetchMock.mockResolvedValue({ name: 'APIが返した名前' })
    form.state.name = ' \t DevRecall　'

    await form.saveProject()

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/projects', {
      method: 'POST', body: { name: 'DevRecall' }
    })
    expect(form.savedProjectName).toBe('APIが返した名前')
    expect(form.state.name).toBe('')
    expect(form.saveError).toBe('')
    expect(form.isSaving).toBe(false)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    await form.saveProject()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('成功時の入力クリア後も成功メッセージが残り、次の入力で消える', async () => {
    fetchMock.mockResolvedValue({ name: 'DevRecall' })
    form.state.name = 'DevRecall'
    await form.saveProject()
    await nextTick()

    expect(form.state.name).toBe('')
    expect(form.savedProjectName).toBe('DevRecall')

    form.state.name = '次のProject'
    await nextTick()
    expect(form.savedProjectName).toBe('')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([400, 500])('HTTP %sのエラーは入力を修正すると消える', async (statusCode) => {
    fetchMock.mockRejectedValue({ statusCode })
    form.state.name = 'DevRecall'
    await form.saveProject()
    await nextTick()
    expect(form.saveError).not.toBe('')

    form.state.name = '修正したProject'
    await nextTick()
    expect(form.saveError).toBe('')
    expect(form.state.name).toBe('修正したProject')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('保存中の再送信を無視する', async () => {
    let finish!: (value: { name: string }) => void
    fetchMock.mockReturnValue(new Promise((resolve) => {
      finish = resolve
    }))
    form.state.name = 'DevRecall'
    const pending = form.saveProject()

    expect(form.isSaving).toBe(true)
    await form.saveProject()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    finish({ name: 'DevRecall' })
    await pending
    expect(form.isSaving).toBe(false)
  })

  it.each(['', ' \t\n　'])('空入力%jはAPIを呼ばない', async (name) => {
    form.state.name = name
    await form.saveProject()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'Project名を確認して、もう一度保存してください。'],
    [500, 'Projectの保存に失敗しました。時間をおいて再試行してください。'],
    [undefined, 'Projectの保存に失敗しました。時間をおいて再試行してください。']
  ])('HTTP %sや通信失敗では安全なエラーと入力を保持し、再試行できる', async (statusCode, message) => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('INTERNAL_ERROR_MARKER'), { statusCode }))
    form.state.name = ' DevRecall '
    await form.saveProject()

    expect(form.saveError).toBe(message)
    expect(form.state.name).toBe(' DevRecall ')
    expect(form.savedProjectName).toBe('')
    expect(form.isSaving).toBe(false)

    fetchMock.mockResolvedValueOnce({ name: 'DevRecall' })
    await form.saveProject()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(form.saveError).toBe('')
    expect(form.savedProjectName).toBe('DevRecall')
  })
})
