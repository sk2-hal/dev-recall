import { expect, test } from '@playwright/test'

const entry = {
  id: '407e8117-278a-4cb8-9bc8-799a22075351', projectId: 'b7427f31-2432-4aa8-a766-5ecbb333ff7b',
  tags: ['既存Tag'], title: '元のTitle', body: '元のBody\n2行目', types: ['decision', 'learning'],
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z'
}
const projectPath = `/projects/${entry.projectId}`
const entryPath = `${projectPath}/entries/${entry.id}`
const api = `**/api${entryPath}`

test('詳細から編集し、初期値・必須検証・Note・二重送信防止・最新の詳細を確認する', async ({ page }) => {
  let saved = { ...entry }
  let patches = 0
  let gets = 0
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route(api, async (route) => {
    if (route.request().method() === 'GET') {
      gets++
      return route.fulfill({ json: saved })
    }
    expect(route.request().method()).toBe('PATCH')
    patches++
    expect(route.request().postDataJSON()).toEqual({ title: '新しいTitle', body: '新しいBody', types: ['learning', 'note'], tags: ['既存Tag'] })
    await pending
    saved = { ...entry, ...route.request().postDataJSON(), updatedAt: '2026-10-05T00:00:00.000Z' }
    await route.fulfill({ json: saved })
  })
  await page.goto(entryPath)
  await page.getByRole('link', { name: '編集', exact: true }).click()
  await expect(page).toHaveURL(`${entryPath}/edit`)
  const title = page.getByLabel('Title', { exact: true })
  const body = page.getByLabel('Body', { exact: true })
  await expect(title).toHaveValue(entry.title)
  await expect(body).toHaveValue(entry.body)
  for (const name of ['Decision', 'Learning']) await expect(page.getByRole('checkbox', { name, exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Note', exact: true })).not.toBeChecked()
  await title.fill(' ')
  await body.fill(' ')
  await body.press('Tab')
  await expect(page.getByText('Bodyを入力してください（空白のみは使えません）。')).toBeVisible()
  for (const name of ['Decision', 'Learning']) await page.getByRole('checkbox', { name, exact: true }).uncheck()
  const save = page.getByRole('button', { name: '保存', exact: true })
  await save.focus()
  await save.press('Enter')
  await expect(page.getByText('Titleを入力してください（空白のみは使えません）。')).toBeVisible()
  await expect(page.getByText('Bodyを入力してください（空白のみは使えません）。')).toBeVisible()
  await expect(page.getByText('Typeを1件以上選択してください。')).toBeVisible()
  expect(patches).toBe(0)
  await title.fill(' 新しいTitle ')
  await body.fill(' 新しいBody ')
  await body.press('Tab')
  await expect(page.getByText('Bodyを入力してください（空白のみは使えません）。')).toHaveCount(0)
  for (const name of ['Learning', 'Note']) await page.getByRole('checkbox', { name, exact: true }).check()
  await save.focus()
  await save.press('Enter')
  await expect(page.getByRole('button', { name: '保存中…' })).toBeDisabled()
  await expect(title).toBeDisabled()
  await expect(body).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: 'Note', exact: true })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'キャンセル' })).toHaveAttribute('aria-disabled', 'true')
  await body.press('Enter')
  expect(patches).toBe(1)
  finish()
  await expect(page).toHaveURL(entryPath)
  await expect(page.getByRole('heading', { name: '新しいTitle', exact: true })).toBeVisible()
  await expect(page.getByText('新しいBody', { exact: true })).toBeVisible()
  await expect(page.getByText('Note', { exact: true })).toBeVisible()
  expect(gets).toBeGreaterThanOrEqual(3)
})

test('保存失敗で入力を保持し内部詳細を隠して再保存できる', async ({ page }) => {
  let patches = 0
  await page.route(api, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: entry })
    patches++
    return route.fulfill({ status: patches === 1 ? 400 : patches === 2 ? 500 : 200, json: { message: 'INTERNAL_ERROR_MARKER' } })
  })
  await page.goto(`${entryPath}/edit`)
  await page.getByLabel('Title', { exact: true }).fill('保持するTitle')
  await page.getByLabel('Body', { exact: true }).fill('保持するBody')
  await page.getByRole('checkbox', { name: 'Note', exact: true }).check()
  for (const message of ['入力内容を確認して', 'Entryの保存に失敗しました']) {
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(message)
    await expect(page.getByText('INTERNAL_ERROR_MARKER')).toHaveCount(0)
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('保持するTitle')
    await expect(page.getByLabel('Body', { exact: true })).toHaveValue('保持するBody')
    await expect(page.getByRole('checkbox', { name: 'Note', exact: true })).toBeChecked()
  }
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page).toHaveURL(entryPath)
  expect(patches).toBe(3)
})

test('キャンセルはPATCHせず詳細へ戻る', async ({ page }) => {
  const methods: string[] = []
  await page.route(api, (route) => {
    methods.push(route.request().method())
    return route.fulfill({ json: entry })
  })
  await page.goto(`${entryPath}/edit`)
  await page.getByLabel('Title', { exact: true }).fill('保存しない')
  await page.getByRole('link', { name: 'キャンセル' }).click()
  await expect(page).toHaveURL(entryPath)
  await expect(page.getByRole('heading', { name: entry.title, exact: true })).toBeVisible()
  expect(methods).not.toContain('PATCH')
})

test('404はProjectへ戻れる表示にする', async ({ page }) => {
  await page.route(api, route => route.fulfill({ status: 404, json: { message: 'INTERNAL_ERROR_MARKER' } }))
  await page.goto(`${entryPath}/edit`)
  await expect(page.getByRole('alert')).toContainText('Entryが見つかりません。')
  await expect(page.getByRole('link', { name: 'Project詳細へ戻る' })).toHaveAttribute('href', projectPath)
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0)
  await expect(page.getByText('INTERNAL_ERROR_MARKER')).toHaveCount(0)
})

test('読み込み中はフォームを出さず、取得失敗から再試行で初期化する', async ({ page }) => {
  let gets = 0
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route(api, async (route) => {
    gets++
    if (gets === 1) {
      await pending
      return route.fulfill({ status: 500, json: { message: 'INTERNAL_ERROR_MARKER' } })
    }
    return route.fulfill({ json: entry })
  })
  await page.goto(`${entryPath}/edit`)
  await expect(page.getByRole('status')).toContainText('Entryを読み込み中')
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0)
  finish()
  await expect(page.getByRole('alert')).toContainText('Entryの取得に失敗しました')
  await expect(page.getByText('INTERNAL_ERROR_MARKER')).toHaveCount(0)
  await page.getByRole('button', { name: '再試行' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(entry.title)
  await expect(page.getByRole('checkbox', { name: 'Decision', exact: true })).toBeChecked()
  expect(gets).toBe(2)
})
