import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // SSRのボタンが見えた直後ではなく、Vueが操作を受け付けるまで待つ。
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown }
    return Boolean(root?.__vue_app__)
  })
})

test('入力検証、保存中の二重送信防止、成功表示と再送信防止', async ({ page }) => {
  const requests: unknown[] = []
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.route('**/api/projects', async (route) => {
    expect(route.request().method()).toBe('POST')
    requests.push(route.request().postDataJSON())
    await pending
    await route.fulfill({ status: 201, json: { name: 'APIから返ったProject名' } })
  })
  await page.getByRole('button', { name: '新規Project', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Project名' })
  const submit = page.getByRole('button', { name: '保存', exact: true })

  for (const name of ['', '　   ']) {
    await input.fill(name)
    await expect(submit).toBeDisabled()
    await input.press('Enter')
    await input.press('Tab')
    await expect(page.getByText('Project名を入力してください（空白のみは使えません）。')).toBeVisible()
  }
  expect(requests).toHaveLength(0)

  await input.fill('  DevRecall　')
  await input.press('Tab')
  await expect(page.getByText('Project名を入力してください（空白のみは使えません）。')).toHaveCount(0)
  await submit.click()
  await expect.poll(() => requests.length).toBe(1)
  expect(requests).toEqual([{ name: 'DevRecall' }])
  await expect(page.getByRole('button', { name: '保存中…' })).toBeDisabled()
  await expect(input).toBeDisabled()
  await expect(page.getByRole('button', { name: 'キャンセル' })).toBeDisabled()
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  finish()

  await expect(page.getByRole('status')).toHaveText('Project「APIから返ったProject名」を保存しました。')
  await expect(input).toHaveValue('')
  await expect(submit).toBeDisabled()
  await expect(page).toHaveURL('/')
  await input.fill('次のProject')
  await expect(page.getByRole('status')).toHaveCount(0)
  expect(requests).toHaveLength(1)
})

test('400・500は内部詳細を表示せず入力を保持し、そのまま再試行できる', async ({ page }) => {
  const statuses = [400, 500, 201]
  const requests: unknown[] = []
  await page.route('**/api/projects', async (route) => {
    requests.push(route.request().postDataJSON())
    const status = statuses.shift()!
    await route.fulfill({
      status,
      json: status === 201 ? { name: 'DevRecall' } : { message: 'INTERNAL_ERROR_MARKER' }
    })
  })
  await page.getByRole('button', { name: '新規Project', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Project名' })
  const submit = page.getByRole('button', { name: '保存', exact: true })
  await input.fill(' DevRecall ')

  for (const message of [
    'Project名を確認して、もう一度保存してください。',
    'Projectの保存に失敗しました。時間をおいて再試行してください。'
  ]) {
    await submit.click()
    await expect(page.getByRole('alert')).toHaveText(message)
    await expect(input).toHaveValue(' DevRecall ')
    await expect(submit).toBeEnabled()
    await expect(page.getByText('INTERNAL_ERROR_MARKER')).toHaveCount(0)
    await input.fill('修正したProject')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await input.fill(' DevRecall ')
  }
  await submit.click()
  await expect(page.getByRole('status')).toHaveText('Project「DevRecall」を保存しました。')
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(requests).toEqual(Array.from({ length: 3 }, () => ({ name: 'DevRecall' })))
})
