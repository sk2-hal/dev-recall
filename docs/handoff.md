# DevRecall 引き継ぎ（2026-10-07）

- 作業場所：C:\Users\seiki\dev\dev-recall。main、基点3ba568c（STEP 6-12/13はpush済み）。
- 進め方：今後はWorkのみで実装・必要なテスト・差分確認を行う。別Codexタスクへの委任はしない。過去チャット全文ではなく本書と必要な設計箇所を読む。
- STEP 6-14：TagのDB・API対応は実装・差分確認済み。既存タスクは利用上限で停止していたが、テストとビルドは完了済みだった。Workで残りの確認と本書の作成を完了。未commit・未push。
- 仕様：tags/entry_tagsを追加。同名Tag再利用、trim・空要素除去・重複除去。POST省略は[]、PATCH省略は維持、[]は解除。作成・更新・詳細・一覧の応答にtags:string[]。Entry削除で関連のみ削除し共有Tagは保持。
- 保存：既存Neon HTTPのDrizzle batchを使用し、EntryとTag関連を同一トランザクションで保存。READ COMMITTED、所属条件、Tag名一意制約を使用。依存追加なし。
- 検証記録：pnpm 12.5.1、lint/typecheck/build成功、Vitest 209件、E2E 26件（--workers=2）成功。Workでは実行記録・実ファイル・差分・インストール済みbatch実装・0001→0002の既存テーブル不変を確認。コード変更がなくテストは再実行していない。git diff --check成功。
- 重要：drizzle/0002_dizzy_pet_avengers.sqlは未適用。新APIを実DBで使う前に適用が必要。対象の開発DBを確認し、適用は別途ユーザー承認後に実施。手順はdocs/database.md。実Neonへの接続・操作は行っていない。実DBの並行実行・rollbackは未検証。
- 次：STEP 6-14のcommit/pushは別途依頼後。STEP 6-15でTag入力・表示UI、その後Tag検索。MVPにはこれらと公開確認が残る。不要な機能追加・過去履歴の大量読込・理由のないテスト反復を避ける。
