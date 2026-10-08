# DevRecall 引き継ぎ（2026-10-08）

- リポジトリ：C:\Users\seiki\dev\dev-recall。STEP 7を07618fdでmainへcommit・push済み。以後もWorkのみで作業する。
- STEP 8：主要操作の総合テスト・開発DB受け入れ確認完了。実DB検証で本番ビルドのEntry詳細APIが404になる問題を発見。Project詳細APIの動的パラメータをidからprojectIdに統一して修正し、実Nitroルートの回帰テストを追加。URL形状・DB・依存は変更なし。
- 検証：修正後lint / typecheck / Vitest 211件 / 全E2E 29件 / build成功。実APIで作成・複数Type・Tag正規化・タイトル本文Tag検索・特殊文字・Project間分離・Tag省略と全解除・削除を確認。実ブラウザで編集・再読込・新規コンテキストでの永続化確認。詳細はacceptance.md。
- DB：ユーザーがローカル設定先Neonを開発用と確認し、専用データの作成・検証・後片付けを承認。失敗試行も含め専用Project・Entry・Tagを削除し残存なし。既存データ・接続設定・schemaに変更なし。0002は2026-10-07適用済み。
- 限界：並行更新・途中失敗rollbackは未実施。公開環境の主要操作はSTEP 9〜10で確認済み（下記）。
- Git：STEP 8は29dc262でmainへcommit・push済み。
- 現在：STEP 9・10完了、MVPのMust要件達成。次の機能追加は別の作業として範囲を決める。公開デモは認証なし・公開可能なサンプルのみ。STEP 6-17は設けず、元のロードマップを使う。

## STEP 9 完了記録

- 2026-10-08のユーザー共有実績：本番用Neon `devrecall-production`へマイグレーション適用成功。Vercelへデプロイし、Project一覧の正常表示をユーザーが確認。
- 公開URL：[DevRecall](https://dev-recall-cyan.vercel.app/)。構成・運用手順と確認範囲は[deployment.md](./deployment.md)を参照。
- Vercel用ローカルビルド（NITRO_PRESET=vercel、pnpm build）成功。.vercelをGit対象外に追加。docs/deployment.mdへ設定と実施順を記録。
- 文書更新開始時に最後にpush済みと確認できたコミットは`29dc262`（STEP 8）。今回の文書と.gitignoreは、更新・差分確認後にユーザーからcommit・pushの依頼を受けた。確定コミットはGit履歴を参照。実デプロイの対象コミット・設定詳細は今回再確認していない。

## STEP 10 完了記録

- 2026-10-08にユーザー操作でProject／Entry作成、複数Type・Tag、編集、タイトル・本文・Tag検索、0件表示・クリア、Project間の分離、再読み込み・再アクセス後の保存保持を確認。MVPのMust要件達成。
- 公開環境での並行更新・rollbackの検証は未実施。詳細は[acceptance.md](./acceptance.md)を参照。
- 今回は共有された実績を文書へ反映する作業。アプリの機能変更・手動の再デプロイは行わず、開発用.envも変更していない。文書更新後のcommit・pushはユーザー依頼により実施する。mainへのpushに伴う自動デプロイはGit連携設定に従う。
