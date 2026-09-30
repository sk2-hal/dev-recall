import { expect, test } from '@playwright/test'

test('初回取得の読み込み表示、取得失敗、再試行と空状態', async ({ page }) => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  let gets = 0
  await page.route('**/api/projects', async (route) => {
    gets++
    if (gets === 1) {
      await pending
      await route.fulfill({ status: 500, json: { message: 'INTERNAL_ERROR_MARKER' } })
    } else {
      await route.fulfill({ json: [] })
    }
  })
  await page.goto('/')
  // SSR表示だけでなく、ハイドレーション後の実際のGET開始を待つ。
  await expect.poll(() => gets, { timeout: 15000 }).toBe(1)
  await expect(page.getByText('Project一覧を読み込み中…')).toBeVisible()
  finish()
  await expect(page.getByRole('alert')).toContainText('Project一覧の取得に失敗しました。')
  await expect(page.getByText('Projectはまだありません')).toHaveCount(0)
  await expect(page.getByText('INTERNAL_ERROR_MARKER')).toHaveCount(0)
  await page.getByRole('button', { name: '再試行', exact: true }).click()
  await expect(page.getByText('Projectはまだありません')).toBeVisible()
  expect(gets).toBe(2)
})

test('保存後の再取得が失敗しても保存成功を維持し、一覧だけ再試行する', async ({ page }) => {
  let gets = 0
  let posts = 0
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'POST') {
      posts++
      await route.fulfill({ status: 201, json: { id: 'new', name: '新しいProject' } })
      return
    }
    gets++
    await route.fulfill(gets === 2
      ? { status: 500, json: { message: 'INTERNAL_ERROR_MARKER' } }
      : { json: gets === 1
          ? [{ id: 'old', name: '既存Project' }]
          : [
              { id: 'new', name: '新しいProject' }, { id: 'old', name: '既存Project' }
            ] })
  })
  await page.goto('/')
  // 開発サーバーの初期化・ハイドレーションを含む初回取得を待つ。
  await expect(page.getByRole('heading', { name: '既存Project', exact: true })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: '新規Project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project名' }).fill('新しいProject')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Project一覧の取得に失敗しました。')
  await expect(page.getByRole('status')).toHaveText('Project「新しいProject」を保存しました。')
  await expect(page.getByText('Projectの保存に失敗しました。', { exact: false })).toHaveCount(0)
  await expect(page.getByText('INTERNAL_ERROR_MARKER')).toHaveCount(0)
  await page.getByRole('button', { name: '再試行', exact: true }).click()
  await expect(page.locator('li h2')).toHaveText(['新しいProject', '既存Project'])
  await expect(page.getByRole('status')).toHaveText('Project「新しいProject」を保存しました。')
  expect(gets).toBe(3)
  expect(posts).toBe(1)
})
