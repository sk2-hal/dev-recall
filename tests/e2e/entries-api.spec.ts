import { expect, test } from '@playwright/test'

test('Entry APIの不正UUIDは400', async ({ request }) => {
  const response = await request.post('/api/projects/invalid/entries', {
    data: { title: 'Title', body: 'Body', types: ['learning'] }
  })
  expect(response.status()).toBe(400)
})

test('Entry APIの空本文・重複TypeはDB接続なしで400', async ({ request }) => {
  for (const data of [
    { title: 'Title', body: '　 ', types: ['learning'] },
    { title: 'Title', body: 'Body', types: ['note', 'note'] },
    { title: 'Title', body: 'Body', types: ['note', 'unknown'] }
  ]) {
    const response = await request.post('/api/projects/b7427f31-2432-4aa8-a766-5ecbb333ff7b/entries', { data })
    expect(response.status()).toBe(400)
  }
})

// APIをモックせず、実際のNitroルーターが各HTTPメソッドを解決することを確認する。
test('Project詳細・Entry詳細編集削除のルートが入力検証まで到達する', async ({ request }) => {
  const project = await request.get('/api/projects/invalid')
  expect(project.status()).toBe(400)
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const response = await request.fetch('/api/projects/invalid/entries/invalid', { method })
    expect(response.status()).toBe(400)
  }
})
