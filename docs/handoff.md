# DevRecall 引き継ぎ（2026-10-07）

- リポジトリ：C:\Users\seiki\dev\dev-recall。main基点c520b31（STEP 6-15までpush済み）。以後もWorkのみで実装・必要なテスト・差分確認を行う。
- STEP 6-16：Project内のキーワード検索にTag名を追加。タイトル・本文・TagのOR全体にProjectのAND条件を適用。Tagは相関EXISTSで判定し複数一致でもEntryを増幅させない。空欄時一覧、ILIKE、特殊文字のエスケープ、並び順を維持。一覧には一致Tagだけでなく全Tagを表示。
- 変更：server/db/entries.ts、Project詳細の入力案内、DBテスト、検索E2E、設計・要件文書。本STEPでAPI仕様・DBスキーマ・依存変更なし。ユーザー依頼によりcommit・push対象。確定コミットはgit logで確認。
- 検証：lint/typecheckとVitest 211件成功。検索E2E 3件（--workers=2指定、同一ファイルのため実際は1 worker）・build成功。git diff --check成功。テストはDB/APIをモックし、実DB検索は未確認。
- DB：0002は2026-10-07に承認済みのローカル設定先Neonへ適用済み。履歴ハッシュ・Tag用2テーブル存在確認済み。Tag保存・編集・検索など実DBの受け入れ確認、並行実行・rollbackは未実施。
- 次：STEP 6-17として開発DBで主要操作の受け入れ確認、その後公開環境の設定・検証を進める。認証やAI構造化を先に追加しない。過去チャット全文を再取得せず本書と必要な設計箇所を参照。
