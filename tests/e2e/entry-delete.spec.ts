import { expect, test } from '@playwright/test'

const project = { id: 'b7427f31-2432-4aa8-a766-5ecbb333ff7b', name: '削除確認Project', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }
const entry = { id: '407e8117-278a-4cb8-9bc8-799a22075351', projectId: project.id, title: '削除するEntry', body: '本文を保持', types: ['note'], createdAt: project.createdAt, updatedAt: project.updatedAt }
const projectUrl = `/projects/${project.id}`
const url = `${projectUrl}/entries/${entry.id}`

test('キャンセルでは送信せず、削除中の操作を制限し、成功後に一覧を再取得する', async ({ page }) => {
  let deleted = false
  let calls = 0
  let listCalls = 0
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route(`**/api${projectUrl}`, route => route.fulfill({ json: project }))
  await page.route(`**/api${projectUrl}/entries`, (route) => {
    listCalls++
    return route.fulfill({ json: deleted ? [] : [entry] })
  })
  await page.route(`**/api${url}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fulfill({ json: entry })
    calls++
    await pending
    deleted = true
    await route.fulfill({ status: 204 })
  })
  await page.goto(projectUrl)
  await page.getByRole('link', { name: entry.title }).click()
  await expect(page.getByRole('heading', { name: entry.title })).toBeVisible()
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: '削除', exact: true }).click()
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeEnabled()
  expect(calls).toBe(0)
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('取り消せません')
    await dialog.accept()
  })
  await page.getByRole('button', { name: '削除', exact: true }).click()
  await expect.poll(() => calls).toBe(1)
  await expect(page.getByRole('button', { name: '削除', exact: true })).toBeDisabled()
  await expect(page.getByRole('link', { name: '編集', exact: true })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('link', { name: 'Project詳細へ戻る' })).toHaveAttribute('aria-disabled', 'true')
  finish()
  await expect(page).toHaveURL(projectUrl)
  await expect(page.getByText('まだEntryがありません')).toBeVisible()
  await expect(page.getByRole('link', { name: entry.title })).toHaveCount(0)
  expect(listCalls).toBe(2)
  expect(calls).toBe(1)
})

test('失敗時は本文を保持し内部情報を隠して再試行でき、404なら一覧へ戻れる', async ({ page }) => {
  let calls = 0
  await page.route(`**/api${projectUrl}`, route => route.fulfill({ json: project }))
  await page.route(`**/api${projectUrl}/entries`, route => route.fulfill({ json: [] }))
  await page.route(`**/api${url}`, (route) => {
    if (route.request().method() !== 'DELETE') return route.fulfill({ json: entry })
    calls++
    return route.fulfill({ status: calls === 1 ? 500 : 404, json: { message: 'INTERNAL_DATABASE_ERROR_MARKER' } })
  })
  await page.goto(url)
  await expect(page.getByRole('heading', { name: entry.title })).toBeVisible()
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '削除', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Entryの削除に失敗しました。再試行してください。')
  await expect(page.getByText(entry.body, { exact: true })).toBeVisible()
  await expect(page.getByText('INTERNAL_DATABASE_ERROR_MARKER')).toHaveCount(0)
  expect(calls).toBe(1)
  await page.getByRole('button', { name: '削除', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('すでに削除された可能性があります')
  expect(calls).toBe(2)
  await page.getByRole('link', { name: 'Project詳細へ戻る' }).click()
  await expect(page).toHaveURL(projectUrl)
})
