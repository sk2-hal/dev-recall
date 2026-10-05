import { expect, test } from '@playwright/test'

const project = {
  id: 'b7427f31-2432-4aa8-a766-5ecbb333ff7b', name: '詳細確認Project',
  createdAt: '2026-09-27T00:00:00.000Z', updatedAt: '2026-09-27T00:00:00.000Z'
}
const entry = {
  id: '407e8117-278a-4cb8-9bc8-799a22075351', projectId: project.id, title: 'Entry詳細の設計',
  body: '最初の行\n\n  字下げを保持\n' + '本文'.repeat(150) + '\n<script>document.title="EXECUTED"</script>\n<img src=x onerror="document.title=\'EXECUTED\'">\n最後の行',
  types: ['decision', 'learning', 'note'],
  createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-10-01T12:34:00.000Z'
}
const projectUrl = `/projects/${project.id}`
const url = `${projectUrl}/entries/${entry.id}`

test.beforeEach(async ({ page }) => {
  await page.route(`**/api${projectUrl}`, route => route.fulfill({ json: project }))
  await page.route(`**/api${projectUrl}/entries`, route => route.fulfill({ json: [entry] }))
})

test('一覧タイトルのリンクから詳細全文・Type・日時を確認してProjectへ戻る', async ({ page }) => {
  await page.route(`**/api${url}`, route => route.fulfill({ json: entry }))
  await page.goto(projectUrl)
  const link = page.getByRole('link', { name: entry.title })
  await expect(link).toBeVisible({ timeout: 15000 })
  await expect(link).toHaveAttribute('href', url)
  await link.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(url)
  await expect(page.getByRole('heading', { name: entry.title, level: 1 })).toBeVisible()
  for (const label of ['Decision', 'Learning', 'Note']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible()
  }
  const body = page.locator('article p.whitespace-pre-wrap')
  await expect(body).toHaveText(entry.body, { useInnerText: true })
  expect(await body.textContent()).toBe(entry.body)
  await expect(body).toHaveCSS('white-space', 'pre-wrap')
  await expect(body.locator('script, img')).toHaveCount(0)
  await expect(page).toHaveTitle('Entry詳細 | DevRecall')
  for (const [label, date] of [['作成日時：', entry.createdAt], ['更新日時：', entry.updatedAt]]) {
    const time = page.locator('article p').filter({ hasText: label }).locator('time')
    await expect(time).toHaveAttribute('datetime', date!)
    const displayed = await page.evaluate(value => new Date(value).toLocaleString('ja-JP'), date!)
    await expect(time).toHaveText(displayed)
  }
  await page.getByRole('link', { name: 'Project詳細へ戻る' }).click()
  await expect(page.getByRole('heading', { name: project.name })).toBeVisible()
  await expect(page).toHaveURL(projectUrl)
})

test('直接アクセスで読み込み・安全な失敗表示・再試行で復旧', async ({ page }) => {
  let calls = 0
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route(`**/api${url}`, async (route) => {
    calls++
    if (calls === 1) {
      await pending
      await route.fulfill({ status: 500, json: { message: 'INTERNAL_DATABASE_ERROR_MARKER' } })
    } else {
      await route.fulfill({ json: entry })
    }
  })
  await page.goto(url)
  // SSRのidle表示だけで応答を解放せず、ハイドレーション後の実リクエストを待つ。
  await expect.poll(() => calls, { timeout: 15000 }).toBe(1)
  await expect(page.getByRole('status')).toHaveText('Entryを読み込み中…', { timeout: 15000 })
  finish()
  await expect(page.getByRole('alert')).toContainText('Entryの取得に失敗しました。再試行してください。')
  await expect(page.getByText('INTERNAL_DATABASE_ERROR_MARKER')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Project詳細へ戻る' })).toHaveAttribute('href', projectUrl)
  await page.getByRole('button', { name: '再試行', exact: true }).click()
  await expect(page.getByRole('heading', { name: entry.title })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(calls).toBe(2)
})

test('404はEntryなしを表示しProjectへ戻れる', async ({ page }) => {
  await page.route(`**/api${url}`, route => route.fulfill({ status: 404, json: { message: 'INTERNAL_DATABASE_ERROR_MARKER' } }))
  await page.goto(url)
  await expect(page.getByRole('alert')).toContainText('Entryが見つかりません。', { timeout: 15000 })
  await expect(page.getByText('INTERNAL_DATABASE_ERROR_MARKER')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '再試行' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Project詳細へ戻る' }).click()
  await expect(page).toHaveURL(projectUrl)
  await expect(page.getByRole('heading', { name: project.name })).toBeVisible()
})
