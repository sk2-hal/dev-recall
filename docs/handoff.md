# DevRecall 引き継ぎ（2026-10-07）

- 作業場所：C:\Users\seiki\dev\dev-recall。mainの基点は04d47d9（Tag DB/API）。STEP 6-14はコミット済みで、作業開始時はorigin/mainと一致・clean。
- 運用：Workのみで実装・必要なテスト・差分確認を行う。別Codexへの委任なし。過去チャット全文ではなく本書と必要な設計箇所を参照する。
- STEP 6-15完了：作成・編集共通フォームに任意の複数Tag入力、一覧・詳細にTag表示を追加。Enter/フォーカス移動で追加、×/Backspaceで削除。trim・空要素除去・重複除去。大小文字を区別し、カンマもTag名として保持。編集は既存Tagを初期表示し、全解除は[]。保存中無効化、失敗時保持、HTMLを解釈しない表示を確認。
- 検証：pnpm 12.5.1。lint/typecheck/build成功、Vitest 211件成功。E2Eは--workers=2で初回27/28成功。新規作成テストの初期画面準備待ちを修正し、Tagの2件を再実行して2/2成功（既存26件は初回通過）。固定sleepなし。git diff --check成功。API/DBはモックで実Neon未使用。
- 変更はUI・テスト・設計文書・本書のみ。STEP 6-15はユーザー承認により本変更でcommit・pushする。確定ハッシュと送信状態はgit log / git statusで確認。
- DB適用：2026-10-07、ユーザー承認のもとローカル設定先Neonに0002_dizzy_pet_avengers.sqlを適用。履歴のSQLハッシュとtags/entry_tagsの存在を確認済み。接続情報は記録しない。実DBでのTag操作・並行実行・rollbackの機能確認は未実施。
- 次はSTEP 6-16：既存のProject内検索にTag名を追加（Project条件を維持、複数Tag一致でもEntry重複なし）。その後、実DB・公開環境の確認。認証・AI構造化などへスコープを広げない。
