# DevRecall アーキテクチャ

## 確定した技術構成

| 役割 | 採用技術 |
| --- | --- |
| 言語 / UI | TypeScript、Vue 3、Nuxt 4、Nuxt UI |
| サーバーAPI | NuxtのNitro server API |
| DB操作 | Drizzle |
| 永続化 | PostgreSQL / Neon |
| 自動テスト | Vitest、主要1〜2シナリオのPlaywright |
| ソース管理 / 公開先 | GitHub / Vercel |
| パッケージ管理 | pnpm 12.5.1 |

ブラウザ → Nitro API → Drizzle → Neonの順にアクセスする。UIとAPIを1つのNuxtアプリとして管理し、小さな単位で実装・公開できる構成にする。ブラウザからDBへ直接接続しない。

## 現在のリポジトリ

文書作成時点ではNuxt 4とNuxt UIのスターター。`app/`、`nuxt.config.ts`、pnpmのlockfileが存在し、`package.json`のpackageManagerは`pnpm@12.5.1`。既存CIはlintとtypecheckを実行する。

Drizzle、DBスキーマ、API、Vitest、Playwrightはこれから導入する。本書の以下の構成は実装方針であり、実装済みの機能ではない。既存のトップページにはprerender設定があるため、Project一覧の実装時に動的データ取得と矛盾しないよう見直す。

STEP 6-2では、DB導入前の段階的な実装として`POST /api/projects`の入力検証のみを実装した。Bodyの`name`は空白以外を含む文字列を必須とし、不正な場合は400、正常な場合は前後の空白を除去して200と`{ name, saved: false }`を返す。保存は行わず、既存フォームとの接続も後続STEPで扱う。Vitestを導入し、`pnpm test`とCIでAPIのHTTP応答を検証する。DB・認証・Playwrightはこの段階では未導入。

STEP 6-3ではDrizzleと`@neondatabase/serverless`のHTTP接続を導入した。`POST /api/projects`は同じ入力検証後に1件INSERTし、201と`{ id, name, createdAt, updatedAt }`を返す。IDはDB生成のUUID、日時はPostgreSQLの`timestamp with time zone`（APIではISO 8601文字列）。DB上の日時カラム名は`created_at` / `updated_at`とし、DrizzleでcamelCaseに対応させる。DB失敗時は詳細を引き継がず固定メッセージの500を返す。接続・保存処理は`server/db/`に置き、サーバーで`DATABASE_URL`を読み込む。Vitestでは保存関数を差し替え、実際のNeonへ接続しない。フォーム・一覧は変更せず、接続は後続STEPで扱う。

マイグレーションはDrizzle Kitの`generate`でSQLとメタデータを`drizzle/`に生成し、`migrate`で明示的に適用する。起動時の自動適用や`push`による直接同期は行わない。適用・手動確認手順は[database.md](./database.md)を参照。

STEP 6-4では既存のProject作成フォームを`$fetch`で`POST /api/projects`へ接続した。名前は前後の空白を除去して送信し、保存中は入力・保存・キャンセルを無効化する。成功時はAPIが返した名前を表示して入力欄を空にし、空欄の保存ボタンを無効にして直後の再送信を防ぐ。一覧は引き続きモックのため更新・遷移しない。失敗時は入力を保持し、400は入力確認、それ以外は再試行を促す固定メッセージを表示する。APIのエラー詳細は表示しない。

フォーム送信処理はVitestで`$fetch`を差し替えて検証し、実際のNuxt UIでの入力・保存・再試行は`pnpm test:e2e`のPlaywright 2シナリオで確認する。PlaywrightはブラウザのAPI呼び出しをモックし、専用開発サーバーでは通常の`.env`を読み込まず`DATABASE_URL`も空にする。初回は`pnpm exec playwright install chromium`でブラウザを準備する。

## 責務と配置の方針

- `app/pages/`：画面、入力、表示、API呼び出し。
- `app/components/`：画面間で共通化するUI。必要になった時点で抽出する。
- `server/api/`：入力検証、HTTP応答、DB操作の呼び出し。
- `server/db/`：DB接続、Drizzleスキーマ、必要なクエリ。
- `drizzle/`：レビュー可能なDBマイグレーション。
- `tests/`：Vitestのテスト、Playwrightの主要操作シナリオ。

C#/.NETで考えると、Nitro APIはWeb APIのエンドポイント、DrizzleはDBアクセスとスキーマ管理の役割に相当する。学習MVPのため、必要性のないサービス層や汎用Repositoryは先に増やさない。

## データモデル

| テーブル | カラム |
| --- | --- |
| projects | id, name, createdAt, updatedAt |
| entries | id, projectId, title, content, createdAt, updatedAt |
| types | id, name |
| tags | id, name |
| entry_types | entryId, typeId |
| entry_tags | entryId, tagId |

- Project 1:N Entry。`entries.projectId`で所属先を持つ。
- Entry N:N Type、Entry N:N Tag。中間テーブルで複数選択を表現する。
- TypeはDecision / Problem / Solution / Learning / Noteの5件を初期データとして登録する。利用者によるType追加・編集は設けない。
- Tagは自由入力。初期実装では全Project共通のTagマスターとし、Entryへの関連で利用する。
- ProblemとSolutionは別Entry。Entry間のリンク用カラム・テーブルはMVPには追加しない。

初期実装方針：各マスターとEntryのIDはUUID、日時はタイムゾーン付きで保存する。外部キーで関連を保証し、中間テーブルは2つのIDを複合主キーとして重複登録を防ぐ。Type名とTag名はそれぞれ一意にする。Tagの前後の空白は除去し、空文字は登録せず、同名Tagは再利用する。大文字・小文字の異なるTagは初期実装では別名として扱う。

Project名、Entryタイトル・本文は必須、Typeは1件以上、Tagは任意とする。これらは未指定の細部を補う初期実装方針で、変更する場合は要件との整合を確認する。EntryとType / Tagの関連はトランザクションでまとめて保存し、途中失敗による不整合を防ぐ。編集時にはupdatedAtも更新する。

## 画面とAPIの初期案

| 画面URL | 用途 |
| --- | --- |
| `/` | Projects一覧 / 新規 |
| `/projects/[projectId]` | Entry一覧 / 検索 |
| `/projects/[projectId]/entries/new` | Entry作成 |
| `/projects/[projectId]/entries/[entryId]` | 詳細 / 編集 |

| API | 用途 |
| --- | --- |
| `GET /api/projects` | Project一覧 |
| `POST /api/projects` | Project作成 |
| `GET /api/projects/:projectId/entries?q=...` | 所属Entry一覧 / 検索 |
| `POST /api/projects/:projectId/entries` | Entry作成 |
| `GET /api/projects/:projectId/entries/:entryId` | Entry詳細 |
| `PATCH /api/projects/:projectId/entries/:entryId` | Entry編集 |
| `GET /api/types` | 固定Type一覧 |

サーバーで必須項目、Typeの存在、ProjectとEntryの所属関係を検証する。入力不正は400、対象なしは404とし、内部エラーやDB接続情報をそのまま返さない。TagはEntryの保存時に名前から登録・再利用する。

## キーワード検索

選択中のProjectに限定して、タイトル・本文・関連Tag名のいずれかにキーワードを含むEntryを返す。初期実装はPostgreSQLの部分一致検索で、前後の空白を除いた入力全体を1つの検索語として扱う。空欄は一覧表示。SQLはパラメーター化し、`%`や`_`は検索文字として扱うようエスケープする。複数Tagに一致してもEntryは重複表示しない。

並び順は初期案としてupdatedAtの降順とする。全文検索エンジン、ベクトル検索、RAGは導入しない。

## 公開と秘密情報

NuxtアプリとNitro APIをVercelへ公開し、Neonに永続化する。DB接続情報はサーバー専用の環境変数で管理する。`DATABASE_URL`等をクライアント向け設定やソースに埋め込まない。ローカルと公開環境の接続先を分離し、テストでは公開データを変更しない。

`.env`はコミットしない。必要な変数名は実値を含めず`.env.example`に記載する。マイグレーションはGitで管理し、対象DBを確認して明示的に適用する。認証なしのため公開可能データのみを保存する。公開先のURLが秘密であることをアクセス制御として扱わない。

## テスト方針

- Vitest：入力検証、Tag正規化、Projectをまたがない検索、タイトル・本文・タグの検索、保存・更新時の関連整合性を優先する。DBを使うテストは専用接続先で実施する。
- Playwright：1）Project作成からEntry作成・詳細確認、2）編集から検索・再読み込み後の保存確認、の主要1〜2シナリオ。
- 既存のlint / typecheckを維持し、導入時にテスト用scriptとCIを追加する。公開前にbuildと公開環境での主要操作も確認する。

## Must後の拡張

チャット貼付 → サーバーでAIに構造化を依頼 → Entry候補表示 → 人間が確認・修正 → 既存の保存API、の流れを追加する。AIの出力も検証し、確認前には保存しない。AIサービス、モデル、SDKは未決定。Could機能とEntry相互リンクはMustに混ぜず、別の変更として扱う。
