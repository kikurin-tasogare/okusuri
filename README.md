# やさしい習慣リマインダー

祐希ちゃん向けの、LINEで届くやさしい習慣リマインダーです。  
祐希ちゃん本人がLINEで内容と時間を登録すると、指定時刻にLINE Messaging API経由で通知し、`飲んだよ` または `やったよ` の操作を記録します。

## できること

- LINEで `重曹クエン酸水 8:00` のように送るだけで登録
- `一覧` と送ると本人のLINEだけに登録内容を表示
- 一覧から本人がリマインダーを削除
- 一覧の `時間を変える` から通知時刻を変更
- 指定時刻にLINEへPush通知
- 通知の `あとで` を押すと15分後にもう一度お知らせ
- Quick Replyの `飲んだよ` / `やったよ` で記録
- 記録後に `いいこ、いいこ、よくできました。` と返信
- `きろく` と送ると本人のLINEだけに最近の記録を表示

## 技術構成

- フロント: Vercel Serverless上のシンプルなHTML画面
- バックエンド: Vercel Functions (TypeScript)
- 通知: LINE Messaging API
- DB: Supabase PostgreSQL
- 定時実行: Supabase / 外部無料Cron から `POST /api/cron/send-reminders` を呼び出す想定

## セットアップ

1. 依存を入れます。

```bash
npm install
```

2. `.env.example` を `.env` にコピーして値を入れます。

```bash
cp .env.example .env
```

3. Supabase SQL Editorで [supabase/schema.sql](/Users/yuyakikuchi/Documents/okusuri/supabase/schema.sql) を実行します。

管理者設定ページの `設定状態` で、`Supabase URL` と `Supabase Key` と `Supabase 接続` が確認できます。秘密情報の中身は表示しません。

4. LINE Developersで Messaging APIチャネルを作成します。

- `Channel secret` を控える
- `Channel access token` を発行する
- Webhook URL を `https://あなたのドメイン/api/webhook/line` に設定する
- Webhook を有効化する
- 応答メッセージはオフ推奨
- 祐希ちゃん側でボットのトークをミュートしない

5. Vercelに環境変数を登録します。

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`
- `CRON_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## ローカル開発

Vercel CLIを使う前提です。

```bash
npx vercel dev
```

- 登録画面: `http://localhost:3000/api`
- 管理者設定: `http://localhost:3000/api/admin`
- 設定状態API: `GET /api/setup-status`
- リマインダーAPI: `GET /api/reminders` は管理用の匿名サマリーのみ。登録・削除はLINE本人操作のみ
- LINE友だち一覧API: `GET /api/line-users`
- Webhook: `POST /api/webhook/line`
- LINEテスト送信API: `POST /api/test-line-push`
- 管理画面にはBasic認証がかかります

アプリ画面にはSupabaseやLINEなどの技術設定を表示しません。技術設定は管理者設定ページに分離しています。

## 佑哉さんのLINEで先に試す

1. Vercelに `LINE_CHANNEL_ACCESS_TOKEN` と `LINE_CHANNEL_SECRET` を設定します。
2. LINE DevelopersのWebhook URLを `https://あなたのドメイン/api/webhook/line` にします。
3. 佑哉さんのLINEで公式アカウントを友だち追加します。
4. ボットから届く `テスト用ID` を管理者設定ページへ貼ります。
5. `LINEテスト送信` からテスト通知を送ります。

Supabase未設定でも、LINE接続だけ先に確認できます。

## 一時公開で確認する場合

`localtunnel` などで一時公開すると、スマホやLINE Developersからローカル環境へアクセスできます。

```bash
pnpm dlx localtunnel --port 3000 --subdomain 任意の一時名
```

一時公開中は以下を守ります。

- `ADMIN_USERNAME` と `ADMIN_PASSWORD` を必ず設定する
- 確認が終わったらトンネルを止める
- 一時URLは本番運用に使わない
- LINE Webhook URLは必要なときだけ一時URLへ向ける
- 本番はVercelの正式URLで運用する

## プライバシー方針

- 佑哉さんはサーバー運営者として、接続状態・件数・エラー確認だけを行う
- リマインダーの内容や時間は、通常の管理画面/APIには表示しない
- 祐希ちゃんはLINEだけで登録・一覧確認・削除・時間変更・記録確認ができる
- サーバー送信に必要な最小限の情報はDBに保存するため、運用者はDBへ直接入らない前提で管理する

## 使い方

### 初回

1. 祐希ちゃんがLINE公式アカウントを友だち追加
2. `follow` イベントで `line_user_id` を保存
3. 祐希ちゃんがLINEで `使い方` と送る

### 日常

1. 祐希ちゃんがLINEで `重曹クエン酸水 8:00` のように送る
2. 確認カードの `登録する` を押す
3. 時間になるとLINEで `祐希ちゃん、そろそろだよ` と届く
4. `飲んだよ` または `やったよ` を押す
5. `いいこ、いいこ、よくできました。` が返る

まだ飲めないときは、通知カードの `あとで` を押すと15分後にもう一度お知らせします。

### 一覧・削除・時間の変更

- `一覧` と送ると、登録済みリマインダーが本人のLINEに届く
- 一覧カードの `削除する` を押すと削除できる
- 一覧カードの `時間を変える` を押して、続けて `9:30` のように送ると時刻を変更できる
- 時間の変更は10分以内に新しい時間を送らなかった場合は取り消され、ふつうのメッセージとして扱われる

### 記録の確認

- `きろく`(または `記録` / `ログ`)と送ると、最近の記録10件が本人のLINEにだけ届く
- 表示例: `7/12(土) 8:03 ✅ 重曹クエン酸水`

## 通知の中身

### 飲みもの・おくすり

- 通知: `祐希ちゃん、そろそろだよ`
- 本文: `飲めそう？`
- ボタン: `飲んだよ`

### 習慣

- 通知: `祐希ちゃん、そろそろだよ`
- 本文: `飲めそう？`
- ボタン: `やったよ`

## デプロイ

1. GitHubに配置
2. Vercelへインポート
3. 環境変数を設定
4. デプロイ
5. LINE Webhook URL を本番URLに更新
6. `GET /api/reminders` は匿名サマリー、`POST /api/cron/send-reminders` は送信確認に使う

## 定時実行

Vercel Hobbyでは、1日1回を超えるCronが使えません。  
そのため、無料運用ではSupabase側のスケジュール機能、または外部の無料Cronサービスから以下を定期実行します。

```text
POST /api/cron/send-reminders
Authorization: Bearer CRON_SECRET
```

外部Cronは1分ごとに実行します。`reminder_send_logs` に送信済み記録を残すため、同じ分に複数回呼ばれても二重送信を防ぎます。  
`あとで` の再通知も同じCronが送ります。こちらは `reminder_snoozes` の行を削除してから送る方式なので、一度だけ届きます。

既存DBへ送信ログ表を追加する場合は、Supabase SQL Editorで以下を実行します。

```text
supabase/20260629_add_reminder_send_logs.sql
```

既存DBへ `あとで` と時間変更用の表を追加する場合は、Supabase SQL Editorで以下を実行します。

```text
supabase/20260712_add_snooze_edit_logs.sql
```

1日2〜3回の通知ならLINE Messaging APIの無料枠内に収めやすい想定です。無料枠は変更されうるので、運用前に最新の公式条件を確認してください。

## 注意

- 秘密情報は `.env` 管理し、コミットしない
- リマインダー内容の暗号化鍵は、`ENCRYPTION_SECRET` 未設定時は `LINE_CHANNEL_SECRET` から導出される。`ENCRYPTION_SECRET`(任意)を設定すると鍵をLINEシークレットから切り離せる。設定しないまま `LINE_CHANNEL_SECRET` をローテーションすると保存済みタイトルが復号できなくなるので、先に `ENCRYPTION_SECRET` を設定すること
- `ADMIN_PASSWORD` は長くランダムな文字列にする
- 一時公開URLをSNSや公開チャットに貼らない
- Webhook署名検証を実装済み
- LINE Notify は使わない
- 公式IPの名称・素材は使わない

## 今後の拡張

- 1ユーザー固定から複数ユーザー対応(呼び名のカスタマイズなど)
