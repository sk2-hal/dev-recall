# STEP 9：Vercel + Neon 本番環境

## 状態（2026-10-08）

STEP 9・10完了。ユーザーから共有された2026-10-08の実績として、本番用Neon `devrecall-production`へのマイグレーション適用とVercelへのデプロイが成功し、Project一覧の正常表示をユーザーが確認した。

公開URL：[DevRecall](https://dev-recall-cyan.vercel.app/)。STEP 10ではユーザー操作で主要機能と保存保持を確認し、MVPのMust要件を達成した。確認項目は[acceptance.md](./acceptance.md)を参照。

文書更新開始時の作業基点・最後にpush済みと確認できたコミットはmainの`29dc262`（STEP 8）。実デプロイの対象コミット・管理画面の設定詳細は今回再確認していない。以下は構成・運用手順であり、各設定値の実施確認を表すものではない。

## 構成と手順

1. Neonに開発用とは別の本番用Project / DBを用意する。空のDBから開始し、開発データをコピーしない。プラン・リージョンは管理画面の実際の選択肢を確認する。有料契約は勝手に追加しない。
2. 本番接続先に既存0000〜0002 migrationを明示的に適用し、履歴とprojects / entries / tags / entry_tagsを確認する。ローカル.envの開発用接続は上書きしない。ビルド時や起動時にmigrationを自動実行しない。
3. Vercelへsk2-hal/dev-recallをImportする。Production branchはmain、Root Directoryはリポジトリ直下、FrameworkはNuxt、Build Commandはpnpm build、Output Directoryは自動設定。Node.jsは既存検証に合わせ22.xを選ぶ。
4. packageManagerのpnpm@12.5.1を尊重する。VercelのCorepack設定を確認し、必要ならENABLE_EXPERIMENTAL_COREPACK=1を設定する。インストールはlockfileを維持し、ビルドログで実際のpnpmバージョンを確認する。
5. 本番用DATABASE_URLはVercelのProduction環境にのみ登録する。Preview / Developmentに同じ本番接続先を流用しない。接続文字列はGit・チャット・ログへ出さない。
6. デプロイ後にReady、対象コミット、公開URLを記録。画面とGET /api/projectsの応答を確認する。STEP 10で公開可能なデモデータによる主要操作・再アクセスを最終確認する。

## 運用上の区切り

認証なしの公開デモであり、第三者も閲覧・作成・編集・削除できる。実業務情報を持ち込まない。開発用の自動テストを本番DBへ向けない。Git連携後はmainへのpushが本番デプロイにつながるため、次回以降のpushではその影響も確認する。

.vercelはローカル紐付け・生成物なのでGit対象外。通常のNuxt設定は変更せず、Vercel環境の自動検出を使う。ローカルでNITRO_PRESET=vercelを指定する検証と、実Vercelのデプロイ成功は区別する。

## 参照

- https://vercel.com/docs/frameworks/full-stack/nuxt
- https://vercel.com/docs/builds/configure-a-build
- https://nuxt.com/deploy/vercel

## ローカル検証結果

2026-10-08：NITRO_PRESET=vercelでpnpm build成功。.vercel/outputにFunctionsと静的アセットを生成した記録。実VercelへのデプロイとProject一覧表示も同日完了（上記のユーザー確認実績）。今回の文書更新ではビルド・再デプロイを行っていない。

## 未検証事項

公開環境での並行更新・途中失敗時のrollbackは未実施。主要操作の成功やSTEP 8の自動テスト通過を、その検証の代わりには扱わない。追加検証は隔離された検証DBで行い、公開DBを自動テストや故意の失敗操作に使用しない。
