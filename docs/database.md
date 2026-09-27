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
STEP 6-5以降はフォームと一覧もDBに接続しているため、ブラウザの再読み込みで保存内容を確認できる。

## STEP 6-5：ブラウザでの保存・一覧取得の手動確認

既存のローカル設定が開発用Neonを指し、マイグレーション適用済みであることを確認する。接続文字列を画面共有・ログへ出さない。

1. `pnpm dev`で起動し、ブラウザで`http://localhost:3000`を開く。
2. 開発者ツールのNetworkで`GET /api/projects`が200と配列を返し、保存済みProjectが一覧に表示されることを確認する。開発用DBが空なら空状態が表示される。
3. 「新規Project」から公開可能な名前（例：`STEP 6-5 manual A`）を保存する。POSTの201に続いてGETが発生し、成功メッセージと一覧の先頭への追加を確認する。
4. 別名`STEP 6-5 manual B`も保存し、B、Aの順に表示されることを確認する。GETの日時が降順で、同日時の行はID降順であることも確認する。
5. ブラウザを再読み込みし、保存したProjectが残ることを確認する。
6. 一覧取得エラーは開発者ツールのリクエストブロックで`*/api/projects`をブロックし、画面を再読み込みして確認する。ブロックを解除し「再試行」で復帰できることを確認する。保存成功後のGETだけの失敗は自動E2Eテストで検証する。

この手順は実際に開発用DBへ行を追加する。自動テストでは行わない。

## STEP 6-6：Project詳細の手動確認

既存の開発用Neon設定と適用済みの`projects`テーブルを使用する。スキーマ変更は不要。

1. `pnpm dev`で起動し、一覧で保存済みProject名をクリックする。
2. `/projects/<選択したUUID>`へ遷移し、名前・作成日時・Entryの予告が表示されることを確認する。Networkの`GET /api/projects/<UUID>`が200で、一覧と同じID・名前・日時を返すことを確認する。
3. 詳細URLを再読み込み、または新しいタブで直接開いても表示されることを確認する。「Project一覧へ戻る」で一覧へ戻る。
4. `/api/projects/not-a-uuid`を開いて400を確認する。開発用DBに存在しないUUIDを指定して404を確認し、そのUUIDの詳細画面で「Projectが見つかりません。」を確認する。
5. 開発者ツールで詳細APIをリクエストブロックし、詳細画面を再読み込みする。取得失敗の表示後、ブロックを解除して「再試行」で復帰することを確認する。低速通信設定では読み込み表示も確認できる。

この手順では接続設定を変更しない。DB例外の500と内部情報の非公開は自動テストで検証し、実DBを故意に壊して確認しない。

## 自動検証コマンド

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

APIテストはDB関数をモックし、作成・一覧・詳細の成功、入力不正400、対象なし404、DB失敗500とエラー詳細の非公開を検証する。DBクエリのテストも接続をモックする。E2Eでは一覧からの遷移、直接アクセス、読み込み・404・取得失敗・再試行と既存の作成・一覧機能をブラウザのAPIモックで確認する。
実際のNeonへの接続、マイグレーション適用、永続化の確認は上記の手動手順で行う。
