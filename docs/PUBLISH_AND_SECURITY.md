# 公開・料金・セキュリティ

## データ管理は無料？

**通常プレイ規模なら Free で足ります。**

| サービス | 無料でできること | 注意 |
|----------|------------------|------|
| Supabase Free | Auth / DB / ランキング | 非アクティブだと一時停止、容量・通信に上限あり |
| Vite 静的ホスティング（Vercel / Cloudflare Pages / Netlify） | サイト公開 | 個人利用なら通常無料 |
| Google ログイン（OAuth） | ログイン自体 | 課金対象の GCP 利用をしなければ実質無料 |

有料になる例: 同時接続が極端に多い、DB が很大、Supabase Pro に上げたとき。

`service_role` キーは **絶対にフロントや Git に入れない**（今回も入れていません）。

---

## 公開手順（無料）

1. GitHub にリポジトリを置く（`.env` はコミットしない）
2. [Cloudflare Pages](https://pages.cloudflare.com/) か [Vercel](https://vercel.com/) で接続
3. ビルド設定:
   - Build command: `npm run build`
   - Output: `dist`
4. Environment variables に追加:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`（publishable / anon のみ）
5. Supabase **Authentication → URL Configuration**
   - Site URL: `https://あなたの公開URL`
   - Redirect URLs に同じ URL を追加
   - ローカル＋スマホ確認時は LAN IP も追加（例: `http://192.168.1.6:5173`）
6. Google Cloud の OAuth クライアント
   - 承認済みの JavaScript 生成元に公開 URL（とローカル／LAN）
   - リダイレクト URI は従来どおり  
     `https://vhcjefgptzrpmtmtkvcf.supabase.co/auth/v1/callback`

スマホは Safari / Chrome で開く（SNS 内ブラウザは非推奨）。

---

## セキュリティ強化（このリポで入れた対策）

クライアントから直接テーブルに書けないようにし、サーバー側 RPC で検証します。

SQL Editor で実行してください:

`supabase/migration_security.sql`

内容:

- スコアは **RPC のみ**（直接 INSERT 禁止）
- 深度 1〜730 / ステージ 1〜10 以外は拒否
- **1ユーザーあたり 1時間20回**まで（連投・荒らし対策）
- 表示名から制御文字を除去
- ランキングは誰でも読めるが、改ざん用の更新・削除は不可

### 限界（正直な話）

ブラウザゲームは「完全チート不可」にはできません。  
上記で **不正スコア・連投・権限昇格のリスクを大きく下げます**。  
`service_role` を漏らさず、Confirm email / Google テストユーザー運用を守れば、個人公開として十分安全寄りです。

### 公開前チェック

- [ ] `migration_security.sql` 実行済み
- [ ] `.env` / `service_role` が Git に無い
- [ ] 本番 URL を Supabase / Google に登録
- [ ] 不要なら Email の Confirm を本番向けに戻す（任意）
