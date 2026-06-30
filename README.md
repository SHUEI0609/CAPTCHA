# Secure Portal CAPTCHA App

Next.js App Routerで作成した、ログイン認証とIQテスト風CAPTCHAを組み合わせたデモアプリです。

## Features

- セッションベース認証
- Supabaseを使ったユーザー登録とログイン
- bcryptjsによるパスワードハッシュ保存
- メールアドレスの重複登録チェック
- 10問連続のIQテスト風CAPTCHA
- CAPTCHAクリア後のみログイン可能
- ログイン後は保護ページ `/congratulations` に遷移

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Supabase
- bcryptjs
- sharp

## Setup

依存関係をインストールします。

```bash
npm install
```

SupabaseのSQL Editorで以下のSQLを実行します。

```bash
supabase/schema.sql
```

ローカルでは `.env.local`、VercelではEnvironment Variablesに以下を設定します。

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=replace-with-a-long-random-string
CAPTCHA_SECRET=replace-with-a-long-random-string
```

`SUPABASE_SERVICE_ROLE_KEY` はサーバー側のRoute Handlerでのみ使用します。Client Componentや `NEXT_PUBLIC_` 付きの環境変数として公開しないでください。

## Development

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## How to Use

1. `REGISTER` に切り替えます。
2. メールアドレスとパスワードを入力して登録します。
3. `LOG IN` に戻ります。
4. メールアドレスとパスワードを入力します。
5. CAPTCHAを10問クリアします。
6. `LOG IN` を押すと `/congratulations` に移動します。

初期ユーザーとして、Supabaseに以下のアカウントが自動作成されます。

```text
email: test@gmail.com
password: test
```

## Authentication Flow

登録時:

1. `/api/register` がメールアドレスとパスワードを受け取ります。
2. メール形式とパスワード長を検証します。
3. bcryptjsでパスワードをハッシュ化します。
4. Supabaseの `app_users` テーブルに保存します。
5. 同じメールアドレスが存在する場合は登録を拒否します。

ログイン時:

1. CAPTCHAを10問クリアするとCAPTCHA証明トークンが発行されます。
2. `/api/login` がメールアドレス、パスワード、CAPTCHA証明トークンを受け取ります。
3. Supabaseからユーザーを取得し、bcryptjsでパスワードを照合します。
4. CAPTCHA証明トークンを検証します。
5. 成功時にHttpOnly Cookieへセッショントークンを保存します。

## Supabase Schema

テーブル定義は [supabase/schema.sql](./supabase/schema.sql) にあります。

```sql
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
```

## Scripts

```bash
npm run lint
npm run build
npm run start
```
