import { expect, test } from '@playwright/test'

const project = {
  id: 'b7427f31-2432-4aa8-a766-5ecbb333ff7b', name: 'Entry作成Project',
  createdAt: '2026-09-27T00:00:00.000Z', updatedAt: '2026-09-27T00:00:00.000Z'
}
const projectPath = `/projects/${project.id}`

test.beforeEach(async ({ page }) => {
  await page.route(`**/api/projects/${project.id}`, route => route.fulfill({ json: project }))
})

test('詳細から作成へ移動し、必須検証・複数Type・二重送信防止・201後の復帰', async ({ page }) => {
  let posts = 0
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route(`**/api/projects/${project.id}/entries`, async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: posts ? [{ id: 'entry-id', projectId: project.id, title: 'Title', body: 'Body', types: ['decision', 'note'], createdAt: project.createdAt, updatedAt: project.updatedAt }] : [] })
    }
    posts++
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({ title: 'Title', body: 'Body', types: ['decision', 'note'], tags: [] })
    await pending
    await route.fulfill({ status: 201, json: { id: 'entry-id', tags: [] } })
  })
  await page.goto(projectPath)
  await page.getByRole('link', { name: 'Entryを追加' }).click()
  await expect(page).toHaveURL(`${projectPath}/entries/new`)
  const save = page.getByRole('button', { name: '保存', exact: true })
  // blur時のエラー表示による位置変化に依存しないキーボード操作で送信する。
  await save.focus()
  await save.press('Enter')
  await expect(page.getByText('Titleを入力してください（空白のみは使えません）。')).toBeVisible()
  await expect(page.getByText('Bodyを入力してください（空白のみは使えません）。')).toBeVisible()
  await expect(page.getByText('Typeを1件以上選択してください。')).toBeVisible()
  expect(posts).toBe(0)
  await page.getByLabel('Title', { exact: true }).fill(' Title ')
  await page.getByLabel('Body', { exact: true }).fill(' Body ')
  await page.getByLabel('Body', { exact: true }).press('Tab')
  await expect(page.getByText('Bodyを入力してください（空白のみは使えません）。')).toHaveCount(0)
  for (const name of ['Decision', 'Problem', 'Solution', 'Learning', 'Note']) {
    await expect(page.getByRole('checkbox', { name, exact: true })).toBeVisible()
  }
  await page.getByRole('checkbox', { name: 'Decision', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Note', exact: true }).check()
  await save.click()
  await expect(page.getByRole('button', { name: '保存中…' })).toBeDisabled()
  await expect(page.getByLabel('Title', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Body', { exact: true })).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: 'Note', exact: true })).toBeDisabled()
  expect(posts).toBe(1)
  finish()
  await expect(page).toHaveURL(projectPath)
  await expect(page.getByRole('heading', { name: project.name })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Title', exact: true })).toBeVisible()
})

test('400と500で入力を保持し内部詳細を隠して再試行できる', async ({ page }) => {
  let posts = 0
  await page.route(`**/api/projects/${project.id}/entries`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: posts ? [{ id: 'entry-id', projectId: project.id, title: 'Title', body: 'Body', types: ['decision', 'note'], createdAt: project.createdAt, updatedAt: project.updatedAt }] : [] })
    }
    posts++
    return route.fulfill({ status: posts === 1 ? 400 : posts === 2 ? 500 : 201, json: { message: 'INTERNAL_ERROR_MARKER' } })
  })
  await page.goto(`${projectPath}/entries/new`)
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown }
    return Boolean(root?.__vue_app__)
  })
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
  await expect(page).toHaveURL(projectPath)
  expect(posts).toBe(3)
})
