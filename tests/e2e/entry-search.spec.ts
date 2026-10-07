import { expect, test } from '@playwright/test'

const project = { id: 'b7427f31-2432-4aa8-a766-5ecbb333ff7b', name: '検索Project', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }
const projectPath = `/projects/${project.id}`
const entry = { id: '407e8117-278a-4cb8-9bc8-799a22075351', projectId: project.id, title: 'Nuxt UIの設計', body: '本文', types: ['note'], createdAt: project.createdAt, updatedAt: project.updatedAt }
const bodyEntry = { ...entry, id: '407e8117-278a-4cb8-9bc8-799a22075352', title: '本文一致', body: 'Nuxt UIを使う' }
const unrelated = { ...entry, id: '407e8117-278a-4cb8-9bc8-799a22075353', title: '検索対象外' }

const tagEntry = { ...entry, id: '407e8117-278a-4cb8-9bc8-799a22075354', title: 'Tagだけで一致', tags: ['Nuxt UI', 'Nuxt UI Tips'] }

test.beforeEach(async ({ page }) => {
  await page.route(`**/api${projectPath}`, route => route.fulfill({ json: project }))
})

test('送信時だけ検索し、タイトル・本文・Tagの結果と導線を表示してクリアで一覧へ戻る', async ({ page }) => {
  const queries: (string | null)[] = []
  await page.route(`**/api${projectPath}/entries*`, (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')
    queries.push(q)
    return route.fulfill({ json: q ? [entry, bodyEntry, tagEntry] : [entry, bodyEntry, tagEntry, unrelated] })
  })
  await page.goto(projectPath)
  await expect(page.getByRole('heading', { name: project.name })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('heading', { name: unrelated.title })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('4件のEntry')
  await page.getByLabel('Entry検索', { exact: true }).fill('  Nuxt UI  ')
  expect(queries).toEqual([null])
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.getByText('検索条件：Nuxt UI', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('検索結果：3件')
  await expect(page.getByRole('heading', { name: unrelated.title })).toHaveCount(0)
  for (const item of [entry, bodyEntry, tagEntry]) {
    await expect(page.getByRole('link', { name: item.title })).toHaveAttribute('href', `${projectPath}/entries/${item.id}`)
  }
  await expect(page.getByRole('link', { name: 'Entryを追加' })).toHaveAttribute('href', `${projectPath}/entries/new`)
  await expect(page.getByRole('link', { name: tagEntry.title })).toHaveCount(1)
  await expect(page.getByLabel('Tag一覧')).toContainText('Nuxt UI Tips')
  expect(queries).toEqual([null, 'Nuxt UI'])
  await page.getByRole('button', { name: 'クリア' }).click()
  await expect(page.getByRole('heading', { name: unrelated.title })).toBeVisible()
  await expect(page.getByLabel('Entry検索', { exact: true })).toHaveValue('')
  await expect(page.getByRole('status')).toHaveText('4件のEntry')
  expect(queries).toEqual([null, 'Nuxt UI', null])
})

test('空のProjectと検索0件を区別し、失敗時は適用済み条件で再試行する', async ({ page }) => {
  const keyword = '<img src=x>100%_!\\'
  const queries: (string | null)[] = []
  let attempts = 0
  await page.route(`**/api${projectPath}/entries*`, (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')
    queries.push(q)
    if (q && ++attempts === 1) return route.fulfill({ status: 500, json: { message: 'INTERNAL_SQL_SECRET' } })
    return route.fulfill({ json: [] })
  })
  await page.goto(projectPath)
  await expect(page.getByRole('heading', { name: project.name })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('まだEntryがありません', { exact: true })).toBeVisible()
  await page.getByLabel('Entry検索', { exact: true }).fill(` ${keyword} `)
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Entry一覧の取得に失敗しました')
  await expect(page.getByText('INTERNAL_SQL_SECRET')).toHaveCount(0)
  await expect(page.getByText(`検索条件：${keyword}`, { exact: true })).toBeVisible()
  await expect(page.locator('img[src="x"]')).toHaveCount(0)
  await page.getByLabel('Entry検索', { exact: true }).fill('まだ送信していない語')
  await page.getByRole('button', { name: 'Entry一覧を再試行' }).click()
  await expect(page.getByText('検索条件に一致するEntryがありません。')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('別のキーワードで検索するか、クリアして全件表示に戻してください。')
  await expect(page.getByText('まだEntryがありません', { exact: true })).toHaveCount(0)
  expect(queries).toEqual([null, keyword, keyword])
  await page.getByRole('button', { name: 'クリア' }).click()
  await expect(page.getByText('まだEntryがありません', { exact: true })).toBeVisible()
})

test('遅い検索応答が新しい条件の結果を上書きしない', async ({ page }) => {
  let release!: () => void
  let completed!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const oldCompleted = new Promise<void>((resolve) => {
    completed = resolve
  })
  await page.route(`**/api${projectPath}/entries*`, async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')
    if (q === 'old') {
      await pending
      await route.fulfill({ json: [unrelated] })
      completed()
      return
    }
    return route.fulfill({ json: q === 'new' ? [entry] : [] })
  })
  await page.goto(projectPath)
  await expect(page.getByRole('heading', { name: project.name })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('まだEntryがありません', { exact: true })).toBeVisible()
  await page.getByLabel('Entry検索', { exact: true }).fill('old')
  const oldRequest = page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'old')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await oldRequest
  await expect(page.getByRole('status')).toHaveText('Entry一覧を読み込み中…')
  await page.getByLabel('Entry検索', { exact: true }).fill('new')
  await page.getByRole('button', { name: '検索', exact: true }).click()
  await expect(page.getByRole('heading', { name: entry.title })).toBeVisible()
  release()
  await oldCompleted
  // 応答処理と次の描画が完了しても、現在の条件の結果を維持する。
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect(page.getByRole('heading', { name: entry.title })).toBeVisible()
  await expect(page.getByRole('heading', { name: unrelated.title })).toHaveCount(0)
  await expect(page.getByText('検索条件：new', { exact: true })).toBeVisible()
})
