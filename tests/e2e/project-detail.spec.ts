import { expect, test } from '@playwright/test'

const project = {
  id: 'b7427f31-2432-4aa8-a766-5ecbb333ff7b',
  name: '詳細確認Project',
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z'
}
const url = `/projects/${project.id}`

test.beforeEach(async ({ page }) => {
  await page.route('**/api/projects/*/entries', route => route.fulfill({ json: [] }))
  await page.route('**/api/projects', route => route.fulfill({ json: [project] }))
  await page.route('**/api/projects/*', route => route.fulfill({ json: project }))
})

test('一覧のリンク、詳細表示、一覧への復帰と直接アクセス', async ({ page }) => {
  await page.goto('/')
  const link = page.getByRole('link', { name: project.name, exact: true })
  // 初回の開発サーバーの変換・ハイドレーション完了を待つ。
  await expect(link).toHaveAttribute('href', url, { timeout: 15000 })
  await link.click()
  await expect(page).toHaveURL(url)
  await expect(page.getByRole('heading', { name: project.name, level: 1 })).toBeVisible()
  await expect(page.locator('time')).toHaveAttribute('datetime', project.createdAt)
  await expect(page.locator('time')).toContainText('2026')
  await expect(page.getByText('まだEntryがありません')).toBeVisible()
  await page.getByRole('link', { name: 'Project一覧へ戻る' }).click()
  await expect(page).toHaveURL('/')
  await page.goto(url)
  // 直接アクセスでは再びハイドレーション完了を待つ。
  await expect(page.getByRole('heading', { name: project.name, level: 1 })).toBeVisible({ timeout: 15000 })
})

test('読み込み、取得失敗と再試行を表示し内部詳細を隠す', async ({ page }) => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  let gets = 0
  await page.route('**/api/projects/*', async (route) => {
    gets++
    if (gets === 1) {
      await pending
      await route.fulfill({ status: 500, json: { message: 'INTERNAL_ERROR_MARKER' } })
    } else {
      await route.fulfill({ json: project })
    }
  })
  await page.goto(url)
  await expect.poll(() => gets, { timeout: 15000 }).toBe(1)
  await expect(page.getByRole('status')).toHaveText('Projectを読み込み中…')
  finish()
  await expect(page.getByRole('alert')).toContainText('Projectの取得に失敗しました。')
  await expect(page.getByText('INTERNAL_ERROR_MARKER')).toHaveCount(0)
  await page.getByRole('button', { name: '再試行', exact: true }).click()
  await expect(page.getByRole('heading', { name: project.name, level: 1 })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(gets).toBe(2)
})

test('404は専用表示から一覧へ戻れる', async ({ page }) => {
  await page.route('**/api/projects/*', route => route.fulfill({ status: 404, json: { message: 'INTERNAL_ERROR_MARKER' } }))
  await page.goto(url)
  await expect(page.getByRole('alert')).toContainText('Projectが見つかりません。')
  await expect(page.getByText('INTERNAL_ERROR_MARKER')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: project.name })).toHaveCount(0)
  await page.getByRole('link', { name: 'Project一覧へ戻る' }).click()
  await expect(page).toHaveURL('/')
})
