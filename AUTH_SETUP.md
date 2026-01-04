# Better Auth認証実装ガイド

このドキュメントは、AI BookmarksプロジェクトにGoogleとGitHubのOAuth認証を実装した手順とセットアップ方法を説明します。

## 実装内容

### セキュリティ対策（OWASP準拠）

1. **CSRF保護**
   - Origin検証
   - State/PKCE検証（OAuth 2.0 RFC 7636準拠）
   - SameSite=Lax クッキー

2. **セッション管理**
   - サーバーサイドセッション（D1データベース保存）
   - 自動有効期限延長（1日ごと）
   - httpOnly、secureクッキー

3. **IPトラッキング**
   - Cloudflare IPヘッダー使用
   - 不正アクセス検出用

4. **Node.js互換性**
   - `nodejs_compat`フラグ有効化
   - Better Authが`node:async_hooks`を使用するため必須

## セットアップ手順

### 1. 環境変数の設定

#### ローカル開発（.dev.vars）

`.dev.vars.example`をコピーして`.dev.vars`を作成：

```bash
cp .dev.vars.example .dev.vars
```

以下の値を設定：

```env
# Better Auth Secret (32文字以上のランダム文字列)
# 生成: openssl rand -base64 32
BETTER_AUTH_SECRET=your-secret-key-here

# Better Auth URL (開発環境)
BETTER_AUTH_URL=http://localhost:5173

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

#### 本番環境（Cloudflare Secrets）

Cloudflare Workersのシークレットとして設定：

```bash
# Better Auth Secret
pnpm wrangler secret put BETTER_AUTH_SECRET

# Google OAuth
pnpm wrangler secret put GOOGLE_CLIENT_SECRET

# GitHub OAuth
pnpm wrangler secret put GITHUB_CLIENT_SECRET
```

wrangler.jsoncで公開変数を設定：

```jsonc
{
  "vars": {
    "BETTER_AUTH_URL": "https://bookmarks.satoh.dev",
    "GOOGLE_CLIENT_ID": "your-google-client-id",
    "GITHUB_CLIENT_ID": "your-github-client-id",
  },
}
```

### 2. Google OAuth設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「認証情報」に移動
4. 「認証情報を作成」→「OAuthクライアントID」を選択
5. アプリケーションの種類:「ウェブアプリケーション」
6. 承認済みのリダイレクトURIを追加:
   - 開発: `http://localhost:5173/api/auth/callback/google`
   - 本番: `https://bookmarks.satoh.dev/api/auth/callback/google`
7. クライアントIDとクライアントシークレットをコピー

### 3. GitHub OAuth設定

1. [GitHub Settings](https://github.com/settings/developers) にアクセス
2. 「OAuth Apps」→「New OAuth App」をクリック
3. アプリケーション情報を入力:
   - Application name: `AI Bookmarks`
   - Homepage URL: `https://bookmarks.satoh.dev`
   - Authorization callback URL: `https://bookmarks.satoh.dev/api/auth/callback/github`
4. 「Register application」をクリック
5. クライアントIDとクライアントシークレットをコピー

開発環境用に別のOAuth Appを作成することを推奨:

- Authorization callback URL: `http://localhost:5173/api/auth/callback/github`

### 4. データベースマイグレーション

#### ローカル環境

```bash
# マイグレーション適用
pnpm run db:migrate

# Drizzle Studioで確認（オプション）
pnpm run db:studio
```

#### 本番環境

```bash
# 本番D1にマイグレーション適用
pnpm run db:migrate:prod
```

### 5. 開発サーバーの起動

```bash
pnpm run dev
```

ブラウザで`http://localhost:5173/login`にアクセスし、ログインをテスト。

## ファイル構成

```
app/
├── services/
│   └── auth.server.ts          # Better Auth設定とヘルパー関数
├── routes/
│   ├── api.auth.$.tsx          # Better Auth APIエンドポイント
│   ├── login.tsx               # ログインページ
│   └── home.tsx                # 認証が必要なホームページ
├── components/
│   └── Header.tsx              # ユーザー情報表示ヘッダー
└── db/
    └── schema.ts               # データベーススキーマ（users, sessions等）

migrations/
└── 0003_clumsy_the_executioner.sql  # 認証テーブル追加マイグレーション

worker-configuration.d.ts       # 環境変数の型定義（wrangler typesで自動生成）

.env.example                    # 環境変数テンプレート（一般用）
.dev.vars.example               # 環境変数テンプレート（Cloudflare Workers用）
```

## セキュリティチェックリスト

- [ ] BETTER_AUTH_SECRETは32文字以上のランダム文字列
- [ ] 本番環境でBETTER_AUTH_URLはhttpsを使用
- [ ] OAuthリダイレクトURIが正しく設定されている
- [ ] シークレット変数は`wrangler secret`で設定（wrangler.jsoncには含めない）
- [ ] CSPヘッダーが適切に設定されている（entry.server.tsx）
- [ ] セッションクッキーがhttpOnly、secureに設定されている
- [ ] レート制限が有効（rate-limit.server.ts）

## トラブルシューティング

### ログインエラー

1. **「Invalid redirect URI」**
   - OAuthプロバイダーの設定でリダイレクトURIが正しいか確認
   - 開発環境: `http://localhost:5173/api/auth/callback/{provider}`
   - 本番環境: `https://yourdomain.com/api/auth/callback/{provider}`

2. **「Session not found」**
   - クッキーが正しく設定されているか確認
   - ブラウザのDevToolsでクッキーを確認
   - SameSite、httpOnly、secure属性を確認

3. **「CSRF check failed」**
   - Originヘッダーが正しいか確認
   - trustedOriginsにドメインが含まれているか確認

### ビルドエラー

1. **「Cannot find module 'node:async_hooks'」**
   - wrangler.jsoncで`compatibility_flags: ["nodejs_compat"]`が有効か確認

2. **型エラー**
   - `pnpm wrangler types`を実行して型定義を再生成
   - `worker-configuration.d.ts`に環境変数の型が正しく生成されているか確認

## 参考リンク

- [Better Auth公式ドキュメント](https://www.better-auth.com/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [OAuth 2.0 (RFC 6749)](https://tools.ietf.org/html/rfc6749)
- [PKCE (RFC 7636)](https://tools.ietf.org/html/rfc7636)
- [OWASP認証チートシート](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## 今後の拡張

- パスキー認証の実装
- 2要素認証（TOTP）の追加
- メール認証の追加
- ユーザープロフィール管理
- セッション管理UI（アクティブなセッション一覧と無効化）
