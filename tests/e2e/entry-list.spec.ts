import { expect, test } from '@playwright/test'

const project = {
  id: 'b7427f31-2432-4aa8-a766-5ecbb333ff7b', name: 'Entry一覧Project',
  createdAt: '2026-09-27T00:00:00.000Z', updatedAt: '2026-09-27T00:00:00.000Z'
}
const entry = {
  id: 'entry-id', projectId: project.id, title: '設計メモ', body: '<script>プレビュー</script>' + '本文'.repeat(120),
  types: ['decision', 'problem', 'solution', 'learning', 'note'],
  createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z'
}
const url = `/projects/${project.id}`

test('一覧のタイトル・複数Type・本文プレビュー・日時と追加導線', async ({ page }) => {
  await page.route(`**/api${url}`, route => route.fulfill({ json: project }))
  await page.route(`**/api${url}/entries`, route => route.fulfill({ json: [entry] }))
  await page.goto(url)
  const item = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: entry.title }) })
  // 初回の開発サーバーの変換・ハイドレーション完了を待つ。
  await expect(item).toBeVisible({ timeout: 15000 })
  for (const label of ['Decision', 'Problem', 'Solution', 'Learning', 'Note']) {
    await expect(item.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(item.getByText(entry.body.slice(0, 200) + '…', { exact: true })).toBeVisible()
  await expect(item.locator('script')).toHaveCount(0)
  await expect(item.locator('time')).toHaveAttribute('datetime', entry.createdAt)
  await expect(item.getByRole('link')).toHaveCount(0)
  await page.getByRole('link', { name: 'Entryを追加' }).click()
  await expect(page).toHaveURL(`${url}/entries/new`)
})

test('Entry読み込み・安全な失敗・一覧のみ再試行・空状態でもProjectと追加導線を維持', async ({ page }) => {
  let projectGets = 0
  let entryGets = 0
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route(`**/api${url}`, (route) => {
    projectGets++
    return route.fulfill({ json: project })
  })
  await page.route(`**/api${url}/entries`, async (route) => {
    entryGets++
    if (entryGets === 1) {
      await pending
      await route.fulfill({ status: 500, json: { message: 'INTERNAL_DATABASE_ERROR_MARKER' } })
    } else {
      await route.fulfill({ json: [] })
    }
  })
  await page.goto(url)
  await expect(page.getByRole('heading', { name: project.name })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('status')).toHaveText('Entry一覧を読み込み中…')
  finish()
  await expect(page.getByRole('alert')).toContainText('Entry一覧の取得に失敗しました。')
  await expect(page.getByText('INTERNAL_DATABASE_ERROR_MARKER')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: project.name })).toBeVisible()
  await page.getByRole('button', { name: 'Entry一覧を再試行' }).click()
  await expect(page.getByText('まだEntryがありません')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(projectGets).toBe(1)
  expect(entryGets).toBe(2)
  await page.getByRole('link', { name: 'Entryを追加' }).click()
  await expect(page).toHaveURL(`${url}/entries/new`)
})
