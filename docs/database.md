# STEP 6-3：ProjectのDB保存

## 接続設定

Node.js 22以降、pnpm 12.5.1を使用する。`pnpm install`で依存を導入する。
Neonで開発用のDB / branchを選び、その接続文字列をローカルの`.env`の`DATABASE_URL`へ設定する。
変数の形式は`.env.example`を参照し、既存の`.env`がある場合は上書きせず追記・更新する。
接続文字列をソース、スクリーンショット、ログへ掲載しない。

Nuxt開発サーバーは`.env`を読み込む。ビルド済みサーバーでは実行環境の`DATABASE_URL`を設定する。
DB接続は`server/db/index.ts`で必要時に生成し、クライアント向けruntimeConfigには置かない。
実行時はNeonのHTTPドライバーを利用する。1件のINSERTとRETURNINGで、DBが生成したProjectを取得する。

## マイグレーション

対象が開発用DBであることをNeonの画面とローカル設定で確認してから実行する。
自動テストやビルドでは適用しない。

```powershell
pnpm db:migrate
```

このコマンドは`.env`を読み、Git管理された未適用SQLを順に適用する。
今回のSQLは`projects`のみを新規作成し、`id`は`gen_random_uuid()`、日時は`now()`を初期値にする。
適用履歴はDrizzle Kitが管理する。既存テーブルと衝突した場合は削除せず、接続先と適用履歴を確認する。

今後スキーマを変更した場合は、次のコマンドで新しいSQLを生成し、SQLとメタデータをレビューしてから適用する。

```powershell
pnpm db:generate
```

## Neonへ1件保存する手動確認

1. 上記のマイグレーションを適用し、`pnpm dev`で起動する。
2. 別のPowerShellで以下を一度実行する（再実行すると別のProjectが追加される）。

```powershell
$response = Invoke-WebRequest -Uri 'http://localhost:3000/api/projects' -Method Post -ContentType 'application/json' -Body '{"name":"STEP 6-3 manual check"}'
$response.StatusCode
$response.Content
```

3. ステータスが201で、JSONにUUID形式の`id`、指定した`name`、`createdAt`、`updatedAt`があることを確認する。
4. 同じNeonのDB / branchのSQL Editorで、返ったIDを下の仮値に置き換えて実行する。

```sql
SELECT id, name, created_at, updated_at
FROM projects
WHERE id = '<返ったUUID>'::uuid;
```

一致する行が1件存在すれば保存確認は完了。開発サーバーを再起動した後も同じSELECTで行が残ることを確認できる。
現在のフォームとProject一覧はDB未接続なので、この操作の結果は画面へ反映されない。

## 自動検証

```powershell
pnpm lint
pnpm typecheck
pnpm test
```

APIテストは保存関数をモックし、201・入力不正400・保存失敗500とエラー詳細の非公開を検証する。
実際のNeonへの接続、マイグレーション適用、永続化の確認は上記の手動手順で行う。
