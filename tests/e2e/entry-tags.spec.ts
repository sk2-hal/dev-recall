import { expect, test } from '@playwright/test'

const project = { id: 'b7427f31-2432-4aa8-a766-5ecbb333ff7b', name: 'Tag Project', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }
const entry = { id: '407e8117-278a-4cb8-9bc8-799a22075351', projectId: project.id, title: 'Tag Entry', body: 'Body', types: ['note'], tags: ['既存Tag'], createdAt: project.createdAt, updatedAt: project.updatedAt }
const path = `/projects/${project.id}`
const detail = `${path}/entries/${entry.id}`

test('Tag付き作成、保存中無効化、一覧と詳細の安全な表示', async ({ page }) => {
  let saved = { ...entry, tags: [] as string[] }
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route(`**/api${path}`, route => route.fulfill({ json: project }))
  await page.route(`**/api${path}/entries`, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: [saved] })
    expect(route.request().postDataJSON().tags).toEqual(['Nuxt', 'a,b', '<img src=x>', '未確定Tag'])
    saved = { ...entry, ...route.request().postDataJSON() }
    await pending
    await route.fulfill({ status: 201, json: saved })
  })
  await page.route(`**/api${detail}`, route => route.fulfill({ json: saved }))
  await page.goto(path)
  await expect(page.getByRole('heading', { name: project.name })).toBeVisible({ timeout: 15000 })
  await page.getByRole('link', { name: 'Entryを追加' }).click()
  await page.getByLabel('Title', { exact: true }).fill(entry.title)
  await page.getByLabel('Body', { exact: true }).fill(entry.body)
  await page.getByRole('checkbox', { name: 'Note', exact: true }).check()
  const tag = page.getByPlaceholder('Tagを入力')
  for (const value of [' Nuxt ', 'Nuxt', 'a,b', '<img src=x>']) {
    await tag.fill(value)
    await tag.press('Enter')
  }
  await tag.fill('未確定Tag')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(tag).toBeDisabled()
  finish()
  await expect(page).toHaveURL(path)
  const tags = page.getByLabel('Tag一覧')
  await expect(tags).toContainText('Nuxt')
  await expect(tags).toContainText('a,b')
  await expect(tags).toContainText('<img src=x>')
  await expect(tags.locator('img')).toHaveCount(0)
  await page.getByRole('link', { name: entry.title }).click()
  await expect(page.getByLabel('Tag一覧')).toContainText('未確定Tag')
  await expect(page.getByLabel('Tag一覧').locator('img')).toHaveCount(0)
})

test('既存Tagを編集、失敗後も保持して再試行し、全解除できる', async ({ page }) => {
  let saved = { ...entry }
  let calls = 0
  await page.route(`**/api${detail}`, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: saved })
    calls++
    if (calls === 1) return route.fulfill({ status: 500, json: { message: 'INTERNAL_MARKER' } })
    saved = { ...entry, ...route.request().postDataJSON() }
    return route.fulfill({ json: saved })
  })
  await page.goto(`${detail}/edit`)
  await expect(page.getByText('既存Tag', { exact: true })).toBeVisible({ timeout: 15000 })
  const tag = page.getByPlaceholder('Tagを入力')
  await tag.fill('追加Tag')
  await tag.press('Enter')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('保存に失敗')
  await expect(page.getByText('追加Tag', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page).toHaveURL(detail)
  await expect(page.getByLabel('Tag一覧')).toContainText('追加Tag')
  expect(saved.tags).toEqual(['既存Tag', '追加Tag'])
  await page.getByRole('link', { name: '編集', exact: true }).click()
  await expect(tag).toBeVisible()
  await tag.focus()
  for (let i = 0; i < 4; i++) await tag.press('Backspace')
  await expect(page.getByText('既存Tag', { exact: true })).toHaveCount(0)
  await expect(page.getByText('追加Tag', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page).toHaveURL(detail)
  expect(saved.tags).toEqual([])
  await expect(page.getByLabel('Tag一覧')).toHaveCount(0)
})
