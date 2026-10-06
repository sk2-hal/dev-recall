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

STEP 6-5では`GET /api/projects`を追加し、一覧をDBの実データへ切り替えた。`server/db/projects.ts`でDrizzleを使って`createdAt DESC, id DESC`の順に取得し、APIは`{ id, name, createdAt, updatedAt }[]`（0件は`[]`）を返す。同日時の順序はUUIDの降順で固定する。取得失敗は内部詳細を含まない500に変換する。

画面は`useFetch('/api/projects', { server: false })`でブラウザから初回取得する。読み込み・取得失敗・0件・成功を区別し、再試行ボタンと保存成功後に`refresh()`を呼ぶ。保存結果と一覧のエラーは独立して保持し、再取得失敗でも保存成功メッセージは残す。トップページのprerender指定は削除した。API・DBクエリのVitestと画面のPlaywrightはモックを使用し、Neonに接続しない。

STEP 6-6では`GET /api/projects/:id`と`/projects/[id]`のProject詳細画面を追加した。APIはUUIDの標準表記（16進数8-4-4-4-12桁、大文字小文字を許容、バージョンは限定しない）を検証し、不正ならDBを呼ばず400を返す。`server/db/projects.ts`のDrizzleクエリでIDを条件に1件取得し、成功時は`{ id, name, createdAt, updatedAt }`、該当なしは404、DB例外は内部情報を引き継がない固定メッセージの500を返す。

詳細画面もSTEP 6-5と同じ`useFetch`の`server: false, retry: 0`を採用する。直接アクセス時もブラウザから取得し、SSR時のidleと取得中のpendingを読み込み表示にする。URLのIDに応じた取得先を使い、404とその他の取得失敗を区別し、取得失敗時には手動で再試行できる。名前・作成日時（ブラウザのタイムゾーン）・一覧へ戻るリンクを表示する。一覧のProject名から詳細へ遷移できる。Entry領域は「Entry機能は今後実装します」のみで、Entryのデータ取得は行わない。API・DBテストはDB関数／接続を、E2EはAPIをモックし、実際のNeonへ接続しない。

## 責務と配置の方針

- `app/pages/`：画面、入力、表示、API呼び出し。
- `app/components/`：画面間で共通化するUI。必要になった時点で抽出する。
- `shared/`：クライアントとサーバーの両方で使う、DBや秘密情報に依存しない定義。
- `server/api/`：入力検証、HTTP応答、DB操作の呼び出し。
- `server/db/`：DB接続、Drizzleスキーマ、必要なクエリ。
- `drizzle/`：レビュー可能なDBマイグレーション。
- `tests/`：Vitestのテスト、Playwrightの主要操作シナリオ。

C#/.NETで考えると、Nitro APIはWeb APIのエンドポイント、DrizzleはDBアクセスとスキーマ管理の役割に相当する。学習MVPのため、必要性のないサービス層や汎用Repositoryは先に増やさない。

## データモデル

| テーブル | カラム |
| --- | --- |
| projects | id, name, createdAt, updatedAt |
| entries | id, projectId, title, body, types（text配列）, createdAt, updatedAt |
| tags | id, name |
| entry_tags | entryId, tagId |

- Project 1:N Entry。`entries.projectId`で所属先を持つ。
- EntryのTypeはtext[]で保持する。Entry N:N Tagは`entry_tags`中間テーブルで表現する（STEP 6-14）。
- Typeはdecision / problem / solution / learning / noteの固定5種類。1件以上・重複なしで、利用者によるType追加・編集は設けない。noteは他の4種類に分類しにくい汎用メモ用とする。
- Tagは自由入力。初期実装では全Project共通のTagマスターとし、Entryへの関連で利用する。
- ProblemとSolutionは別Entry。Entry間のリンク用カラム・テーブルはMVPには追加しない。

初期実装方針：各マスターとEntryのIDはUUID、日時はタイムゾーン付きで保存する。外部キーで関連を保証し、中間テーブルは2つのIDを複合主キーとして重複登録を防ぐ。Tag名は一意にする。Tagの前後の空白は除去し、空文字は登録せず、同名Tagは再利用する。大文字・小文字の異なるTagは初期実装では別名として扱う。

Project名、Entryタイトル・本文は必須、Typeは1件以上、Tagは任意とする。これらは未指定の細部を補う初期実装方針で、変更する場合は要件との整合を確認する。EntryとTypeは1回のINSERTで保存する。STEP 6-14ではTagと関連を含めてNeon HTTPのbatchトランザクションで保存する。編集時にはupdatedAtも更新する。

## 画面とAPIの初期案

| 画面URL | 用途 |
| --- | --- |
| `/` | Projects一覧 / 新規 |
| `/projects/[id]` | Project詳細・Entry一覧・タイトル/本文検索（実装済み） |
| `/projects/[projectId]/entries/new` | Entry作成 |
| `/projects/[projectId]/entries/[entryId]` | Entry詳細（実装済み） |
| `/projects/[projectId]/entries/[entryId]/edit` | Entry編集（実装済み） |

| API | 用途 |
| --- | --- |
| `GET /api/projects` | Project一覧 |
| `POST /api/projects` | Project作成 |
| `GET /api/projects/:id` | Project詳細 |
| `GET /api/projects/:projectId/entries?q=...` | 所属Entry一覧 / 検索 |
| `POST /api/projects/:projectId/entries` | Entry作成 |
| `GET /api/projects/:projectId/entries/:entryId` | Entry詳細（実装済み） |
| `PATCH /api/projects/:projectId/entries/:entryId` | Entry編集 |

サーバーで必須項目、Typeの存在、ProjectとEntryの所属関係を検証する。入力不正は400、対象なしは404とし、内部エラーやDB接続情報をそのまま返さない。TagはEntryの保存時に名前から登録・再利用する。

## キーワード検索

選択中のProjectに限定して、タイトル・本文・関連Tag名のいずれかにキーワードを含むEntryを返す。初期実装はPostgreSQLの部分一致検索で、前後の空白を除いた入力全体を1つの検索語として扱う。空欄は一覧表示。SQLはパラメーター化し、`%`や`_`は検索文字として扱うようエスケープする。複数Tagに一致してもEntryは重複表示しない。

並び順はSTEP 6-9で採用したcreatedAt DESC, id DESCを基本とする。全文検索エンジン、ベクトル検索、RAGは導入しない。

## 公開と秘密情報

NuxtアプリとNitro APIをVercelへ公開し、Neonに永続化する。DB接続情報はサーバー専用の環境変数で管理する。`DATABASE_URL`等をクライアント向け設定やソースに埋め込まない。ローカルと公開環境の接続先を分離し、テストでは公開データを変更しない。

`.env`はコミットしない。必要な変数名は実値を含めず`.env.example`に記載する。マイグレーションはGitで管理し、対象DBを確認して明示的に適用する。認証なしのため公開可能データのみを保存する。公開先のURLが秘密であることをアクセス制御として扱わない。

## テスト方針

- Vitest：入力検証、Tag正規化、Projectをまたがない検索、タイトル・本文・タグの検索、保存・更新時の関連整合性を優先する。DBを使うテストは専用接続先で実施する。
- Playwright：1）Project作成からEntry作成・詳細確認、2）編集から検索・再読み込み後の保存確認、の主要1〜2シナリオ。
- 既存のlint / typecheckを維持し、導入時にテスト用scriptとCIを追加する。公開前にbuildと公開環境での主要操作も確認する。

## Must後の拡張

チャット貼付 → サーバーでAIに構造化を依頼 → Entry候補表示 → 人間が確認・修正 → 既存の保存API、の流れを追加する。AIの出力も検証し、確認前には保存しない。AIサービス、モデル、SDKは未決定。Could機能とEntry相互リンクはMustに混ぜず、別の変更として扱う。

## STEP 6-7：Entry作成API

`POST /api/projects/:projectId/entries`は`{ title, body, types }`を受け取り、201と`{ id, projectId, title, body, types, createdAt, updatedAt }`を返す。日時はISO 8601。Project IDは既存詳細APIと同じUUID検証を行い、不正ならDBへアクセスせず400。タイトル・本文は文字列必須でJavaScriptの`trim()`後に空なら400、前後空白を除去して保存する。Typeは5種類から1件以上・重複なしで指定し、それ以外は400。

APIは`getProject`で存在確認し、未存在は404。保存は`server/db/entries.ts`へ分離する。存在確認後にProjectが削除された場合は、`entries_project_id_projects_id_fk`の外部キー違反だけを専用例外に変換して404とする。その他のDBエラーは詳細を引き継がない固定500（`Failed to save Entry`）。INSERTが先に成立した場合はRESTRICTによりProject削除が拒否される。

DBはUUID主キー、NOT NULL、Project外部キー（ON DELETE RESTRICT）、タイトル・本文の空白のみを拒否するCHECK、Typeの1次元・1〜5要素・既知値のみ・NULL要素なし・重複なしのCHECKを持つ。文字列の正規化はAPIが担当し、DBの空白判定はPostgreSQLのPOSIX空白と全角スペースを対象とする（JavaScriptのtrimとはUnicode範囲が完全には同一でない）。日時はDBのnow()で初期化する。

固定少数のTypeはtext[]により結合や複数INSERTが不要になる。別テーブルはType属性の拡張やマスター管理に適するが、今回その必要はなく採用しない。Tagは未実装の将来設計。環境変数追加はなく、既存DATABASE_URLを使用する。

VitestはAPIのDB関数とDB接続をモックする。Playwrightは既存画面の回帰確認に加え、DB接続を無効化した実Nitroサーバーに不正Entry入力を送り400を確認する。保存成功の実DB検証は開発用Neonでの手動確認とし、自動テストでNeonを使わない。

## STEP 6-8：Entry作成画面

Project詳細の「Entryを追加」から`/projects/:projectId/entries/new`へ移動する。Nuxt UIのUForm、UInput、UTextarea、UCheckboxGroupを使い、Title・Body・Typeを入力する。Typeは5候補を常時表示して複数選択でき、Noteの用途を説明する。固定値とEntryType型は`shared/entry-types.ts`で共有し、画面からサーバー専用モジュールを参照しない。

空白のみのTitle・Body、Type未選択はフロントでも拒否する。保存時は前後空白を除去した`{ title, body, types }`を既存APIへPOSTする。保存中はフォームと戻る操作を無効化し、処理内のガードでも二重送信を防ぐ。自動リトライは行わない。成功後はProject詳細へ戻り、Entry一覧はまだ取得・表示しない。

400は入力確認、それ以外は再試行を促す固定メッセージを表示し、内部エラー詳細を表示しない。失敗時は入力を保持して保存操作を再度有効にする。サーバー検証・DBスキーマ・マイグレーションは変更しない。Tag・Entry一覧・詳細・編集・検索は後続STEPとする。

Vitestで必須検証、送信内容、二重送信防止、成功時の遷移、失敗時の入力保持と再試行を確認する。Playwrightでは実際のNuxt UIで詳細からの作成と201後の復帰、400/500からの再試行の2シナリオを追加する。APIはモックし、既存Projectの回帰テストも維持する。

## STEP 6-9：ProjectごとのEntry一覧

`GET /api/projects/:projectId/entries`はUUIDを検証し、Projectの存在確認後、所属Entryだけを`createdAt DESC, id DESC`の1回のSELECTで返す。Projectなしは404、Entryなしは200と`[]`、DB失敗は内部詳細を含めない固定500。Type配列はEntryと同時に取得し、N+1は発生しない。

Project詳細にタイトル・共有ラベルの複数Type・本文プレビュー（最大200文字、3行）・作成日時を表示する。ProjectとEntry一覧は別々の`useFetch`で状態を保持し、Entryの読み込み・0件・失敗を区別する。再試行はEntry一覧のみ。作成画面から戻った際もキャッシュを使わずAPIから取得する。Typeラベルは`shared/entry-types.ts`を作成画面と共有する。

Vitestで検索条件・順序・API応答とエラーの秘匿、Playwrightで一覧状態・再試行・作成後の最新一覧を検証する。Tag・詳細リンク・編集・削除・検索・ページネーションは含めず、DBスキーマ・migration・環境変数は変更しない。

## STEP 6-10：Entry詳細

`GET /api/projects/:projectId/entries/:entryId`は両方のUUIDを検証し、不正ならDBにアクセスせず400を返す。`getEntry`は`projectId = 指定Project AND id = 指定Entry`をDB検索条件にして1件取得し、所属関係を保証する。Projectの存在確認は別途行わず、Projectなし・Entryなし・別Project所属を同じ404とする。成功時は`{ id, projectId, title, body, types, createdAt, updatedAt }`、DBエラーは内部情報を含まない固定500を返す。

一覧タイトルのNuxtLinkから`/projects/:projectId/entries/:entryId`へ移動する。詳細画面は共有Typeラベル、本文全文、作成・更新日時を表示する。本文はVueのテキスト補間で安全に表示し、`white-space: pre-wrap`で改行・空白を保持する。HTML・Markdownは解釈しない。既存画面と同じ`useFetch`の`server: false, retry: 0`とブラウザの`toLocaleString('ja-JP')`を採用し、SSR・タイムゾーン方針の整理は将来に残す。読み込み、404、その他の取得失敗を区別し、その他の失敗には再試行、全状態にはProject詳細へ戻るリンクを設ける。

VitestでAND検索条件とAPIの入力・応答・エラー秘匿を、Playwrightで一覧からの遷移、全文と改行、安全なテキスト表示、日時、読み込み・失敗・再試行を検証する。DBスキーマ・migration・環境変数・依存は変更しない。

## STEP 6-11：Entry編集

詳細の「編集」リンクから`/projects/:projectId/entries/:entryId/edit`へ移動する。取得成功後だけフォームを表示し、Title・Body・選択済みTypeをコピーして初期化する。読み込み・404・取得失敗を区別し、取得失敗には再試行、対象なしにはProject詳細への導線を用意する。保存中は入力とキャンセルを無効化し、処理内でも二重送信を防ぐ。失敗時は入力を保持して固定メッセージを表示し、再保存できる。キャンセルは保存せず詳細へ戻る。

`PATCH /api/projects/:projectId/entries/:entryId`は作成APIと共通の入力検証でtitle/bodyをtrimし、固定5種類のTypeを1件以上・重複なしで受け付ける。UUID検証も既存APIと小さな関数で共有する。不正入力はDBアクセス前に400。DBはProject IDとEntry IDのAND条件で1回のUPDATEを行い、title/body/typesと現在日時のupdatedAtだけを変更する。createdAtは保持する。RETURNINGの更新後Entryを200で返し、対象なし（別Project所属を含む）は404、DB例外は内部情報を引き継がない500とする。

入力欄はEntryFields、フロント検証はvalidateEntryで作成画面と共有し、保存先・遷移先・取得状態はページごとに扱う。詳細ページを同一URLの`[entryId]/index.vue`へ移し、edit.vueを独立したページにする。保存成功後は詳細へ戻りAPIから最新内容を再取得する。キャッシュ同期は追加しない。

Vitestは時計を固定して更新項目・所属条件・API応答とエラー秘匿を確認する。PlaywrightはAPIをモックして編集・必須検証・保存失敗からの再試行・キャンセル・取得状態と既存画面の回帰を確認する。公開DBには接続しない。DB schema・migration・環境変数・依存パッケージは変更しない。

## STEP 6-12：Entry削除

詳細画面の「削除」でブラウザ標準の確認ダイアログを表示する。承認時だけDELETEを送り、処理中は削除・編集・戻る操作を無効化し、処理内でも二重送信を防ぐ。自動リトライは行わない。成功時はProject詳細へ戻り、既存の一覧取得で最新内容を表示する。失敗時は詳細を保持し、固定メッセージから手動で再試行できる。404は対象がないことと一覧へ戻る案内を表示する。

DELETE /api/projects/:projectId/entries/:entryIdは両方のUUIDを検証し、不正ならDBを呼ばず400。Project IDとEntry IDのAND条件で1回のDELETEを行い、RETURNINGで削除を確認して本文なしの204を返す。対象なし・別Project所属は404、DB例外は内部情報を含まない500。物理削除であり復元機能は設けない。スキーマ・migration・依存は変更しない。

Vitestで所属条件とAPI応答・エラー秘匿を、Playwrightでキャンセル・成功後の一覧更新・送信中の操作制限・失敗後の再試行を確認する。自動テストはDB/APIをモックし、Neonには接続しない。

## STEP 6-13：タイトル・本文検索

GET /api/projects/:projectId/entriesの任意のqで、Project内のタイトル・本文を部分一致検索する。qは文字列のみ受け付け、複数指定による配列はDBアクセス前に400。前後の空白を除き、残り全体を1つの検索語として扱う。未指定・空白のみは従来の一覧。Tagは未実装のためTag検索は後続STEPで扱う。

SQLはProject条件 AND（タイトル ILIKE OR 本文 ILIKE）とし、検索値はパラメーター化する。ILIKEで英字の大小を区別しない。ESCAPE '!'を明示し、!・%・_をエスケープするため、これらとバックスラッシュは文字どおり検索できる。createdAt DESC, id DESC、Projectなし404、内部情報を含まない500は従来どおり。

Project詳細には検索入力・検索・クリアを追加する。入力中の文字列と適用済み条件を分け、送信時だけ検索する。useFetchのリアクティブqueryで条件ごとの取得状態を切り替え、古い条件の遅い応答が現在の結果を上書きしないようにする。再試行は入力中の文字列ではなく適用済み条件で行う。クリアは全件一覧へ戻し、空のProjectと検索結果0件は表示を分ける。検索語はVueのテキスト補間で表示する。

Vitestで入力検証・SQL条件・特殊文字・順序・エラー秘匿を、Playwrightで検索とクリア、0件、同条件の再試行、応答順序の逆転を確認する。既存の作成・詳細・編集・削除は維持し、DB schema・migration・環境変数・依存は変更しない。自動テストはDB/APIをモックし、Neonには接続しない。

## STEP 6-14：TagのDB・API対応

TagのDBとAPIのみを追加する。Tag入力・表示UIとTagキーワード検索は後続STEPとし、現在の検索対象は引き続きタイトル・本文のみ。tagsは全Project共通で、UUID主キーとnameのNOT NULL / UNIQUEを持つ。entry_tagsは(entry_id, tag_id)の複合主キー。Entryへの外部キーはON DELETE CASCADEで関連だけを削除し、Tagへの外部キーはRESTRICT。使われなくなったTagの自動清掃は行わない。

POST /api/projects/:projectId/entriesとPATCH /api/projects/:projectId/entries/:entryIdは任意のtags: string[]を受け取る。配列以外・非文字列要素はDBアクセス前に400。各要素をJavaScriptのtrimで正規化し、空要素を除外して重複を取り除く。大文字小文字は別名として保存する。POSTの省略は[]、PATCHの省略は既存関連を維持、明示的な[]（正規化で空になった配列も含む）は全関連解除。既存UIはtagsを送らないので、Tag付きEntryを編集してもTagは消えない。

POST / PATCH / 詳細GET / 一覧GETのEntry応答は既存項目にtags: string[]を追加する。Tagなしは[]。返却順はPostgreSQLのCOLLATE "C"による名前昇順（UTF-8のバイト順）に統一する。詳細・一覧とも同じSELECT投影で関連名を配列集約し、外側の取得元はentriesのみとする。Entryの重複も、Entryごとの追加DB問い合わせも発生しない。検索・所属条件・一覧のcreatedAt DESC, id DESCは維持する。

### 保存の原子性と並行実行

既存のdrizzle-orm/neon-httpのbatch()を使う。インストール済みDrizzleの実装で、batchがNeon client.transactionへSQL群を1回渡すこと、対話的transaction()は非対応であることを確認した。[Drizzle Batch API](https://orm.drizzle.team/docs/batch-api)、[Neonドライバー設定](https://github.com/neondatabase/serverless/blob/main/CONFIG.md)も参照。依存追加やWebSocket接続への変更はしない。Neonクライアント生成時に分離レベルReadCommittedを明示する。

タグを指定した保存は次の5 SQLを1つのトランザクションで順に実行する。

1. EntryをINSERT、またはProject ID AND Entry IDを条件にUPDATE。作成時はbatch内で同じIDを参照できるようNodeのrandomUUIDでUUIDを先に生成する。更新は行ロックをcommitまで保持するため、同じEntryの並行更新はここで直列化する。
2. 対象Entryが指定Projectに存在する場合だけTagをINSERT。名前のC順で登録し、ON CONFLICT(name) DO NOTHINGで同名を再利用する。順序をそろえて共有Tagのロック競合を抑える。
3. 所属条件で対象を限定し、そのEntryの既存関連を削除。
4. 同じ所属条件と指定Tag名で関連をINSERT。別statementのREAD COMMITTEDスナップショットで、競合相手がコミットしたTagも参照する。単一の書き込みCTEでDO NOTHING後に古いスナップショットを参照する方式は採用しない。
5. 同じトランザクション内で更新後EntryとTag配列をSELECT。

PATCHでtags省略なら1と5だけを同じbatchで実行し、関連を触らない。対象なし・別Project所属では各Tag書き込みも所属条件によって0件となり、共有Tagにも変更を残さず404。どのSQLでも失敗するとトランザクション全体が失敗する。Project外部キー違反の404変換と、内部詳細を含めない500は維持する。

### 適用と検証の範囲

生成した0002_dizzy_pet_avengers.sqlは新しい2テーブルと制約の追加だけ。既存0000/0001を変更せず、既存Entryは関連0件として扱う。**本STEPでは実Neonへのmigration適用・DB操作を行っていない。新APIをDB接続環境で使う前に0002を適用する必要がある。** 手順はdatabase.md参照。

Vitestは実DrizzleのSQL生成・結果マッピングを使い、Neon実行境界をモックする。batchの単一トランザクション呼び出し・SQL順序・所属条件・競合時の同名再利用SQL・省略/[]・関連削除の外部キーを検証する。APIテストはTag入力と応答・安全なエラーを確認し、PlaywrightはTagなし送信を続ける既存UIを回帰確認する。**実DBでの並行動作、rollback、migration適用は未検証であり、モック通過をその実証とは扱わない。**

## STEP 6-15：Tag入力・表示UI

作成・編集共通のEntryFieldsに任意のUInputTagsを追加。Enterで追加、削除ボタンまたはBackspaceで解除する。フォーカスを外した入力も取り込むため、保存ボタンを押した際の未確定Tagも保存する。カンマは区切りにせずTag名の一部として保持する。保存前にtrim・空要素除去・重複除去を行い、大小文字は区別する。編集では取得Tag配列をコピーして初期化し、POST/PATCHともtagsを明示的に送る。全解除は[]。保存中の無効化、失敗時の入力保持、キャンセルは既存フォームの動作に従う。

一覧・詳細ではEntryTagsでTagをテキストとして表示し、HTMLは解釈しない。長い名前は折り返し、Tagなしでは領域を表示しない。Tag検索は次のSTEP。DB・API・依存は変更しない。実DBで利用するにはSTEP 6-14の0002 migrationが必要。
