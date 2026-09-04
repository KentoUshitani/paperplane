# Paper Plane

名作ミニゲーム「紙ヒコーキ」ライクな 2D アクション（シングルプレイ）+ Supabase 全体ランキング。

## 技術スタック

- HTML5 Canvas + TypeScript + Vite
- Supabase（無料枠）: メール / Google ログイン + 全体ハイスコア

## 操作

| 入力 | 動作 |
|------|------|
| `←` / `A` または画面左タップ | 左へバンク |
| `→` / `D` または画面右タップ | 右へバンク |
| `Space` / タップ | スタート / リトライ |
| 上部 `LOGIN` | メール or Google ログイン |
| 上部 `RANK` | 全体ランキング |

## ローカル起動

```bash
npm install
cp .env.example .env
# .env に Supabase の URL / anon key を記入
npm run dev
```

`.env` 未設定でもゲーム自体は遊べます（ランキングは OFFLINE）。

## Supabase 無料セットアップ（約10分）

### 1. プロジェクト作成

1. [https://supabase.com](https://supabase.com) でアカウント作成（Free）
2. **New project** → リージョンは近い場所、DB パスワードを控える
3. **Project Settings → API**
   - `Project URL` → `.env` の `VITE_SUPABASE_URL`
   - `anon` `public` key → `.env` の `VITE_SUPABASE_ANON_KEY`

### 2. テーブル作成

**SQL Editor** で `supabase/schema.sql` の内容をすべて実行。

### 3. メールログイン（すぐ試す用）

**Authentication → Providers → Email** を ON。

開発中は **Confirm email を OFF** にすると、登録直後にログインできます（無料枠でメール確認が面倒なとき向け）。

### 4. Google ログイン

1. [Google Cloud Console](https://console.cloud.google.com/) で OAuth クライアント（ウェブ）を作成
2. 承認済みリダイレクト URI に Supabase が表示する Callback URL を入れる  
   例: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
3. **Authentication → Providers → Google** に Client ID / Secret を貼る
4. **Authentication → URL Configuration**
   - Site URL: `http://127.0.0.1:5173`（本番はデプロイ先）
   - Redirect URLs に同じオリジンを追加

### 5. 動作確認

1. `npm run dev` → `LOGIN` → メール登録 or Google
2. プレイしてクラッシュ / CLEAR
3. `RANK` で深度順の全体ランキングを確認

## ビルド

```bash
npm run build
npm run preview
```

## アプリアイコン / PWA

方針: **黒地 + 白ワイヤーの紙ヒコーキ**（ゲーム画面と同じ世界観）。文字は入れない（小さいサイズで潰れるため）。

| ファイル | 用途 |
|----------|------|
| `public/icon.svg` | favicon / 任意サイズ |
| `public/icons/icon-192.png` / `icon-512.png` | PWA・ホーム画面 |
| `public/icons/icon-512-maskable.png` | Android 適応アイコン（余白多め） |
| `public/icons/apple-touch-icon.png` | iOS ホーム画面 |
| `public/manifest.webmanifest` | インストール用マニフェスト |

ブラウザで「ホーム画面に追加」するとアイコン付きでアプリ風に起動できます。

## 公開・料金・セキュリティ

詳細は [docs/PUBLISH_AND_SECURITY.md](docs/PUBLISH_AND_SECURITY.md)。

個人利用のランキング運用は **Supabase Free + 静的ホスティング無料枠** で足ります。  
公開前に SQL Editor で `supabase/migration_security.sql` を実行してください（スコア改ざん・連投対策）。
