# AI Bookmarks

Cloudflare Workers AI、D1データベース、Drizzle ORMを使った自動カテゴリ分類ブックマーク管理アプリケーション。

## 特徴

- AI自動分類: Workers AIがURLから大カテゴリ・小カテゴリ・説明文を自動生成
- スマートカテゴリ: 既存カテゴリとの類似性を考慮してカテゴリを選択・統合
- ファイル管理（Beta）: テキストファイルやPDFのアップロードとAI分析に対応
- ソーシャル認証: GoogleとGitHubによるOAuth 2.0認証（Better Auth）
- ユーザー分離: ユーザーごとに完全に分離されたブックマーク管理
- モダンUI: Tailwind CSS v4によるレスポンシブでダークモード対応のデザイン
- セキュア: Drizzle ORMによるSQLインジェクション対策、CSPヘッダー設定、CSRF保護
- 高速: Cloudflare Workers上で動作する超高速SPA
- スケーラブル: D1データベースで大量のブックマークを管理

## 技術スタック

- フロントエンド: React 19 + React Router 7 + Tailwind CSS v4
- バックエンド: Cloudflare Workers
- データベース: Cloudflare D1 (SQLite)
- ORM: Drizzle ORM
- AI: Cloudflare Workers AI (Llama 3.1)
- 認証: Better Auth (OAuth 2.0)

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

Better Auth認証に必要な環境変数を設定します。

#### 2.1 Google OAuth設定

1. Google Cloud Consoleで新しいプロジェクトを作成
2. OAuth 2.0 クライアントIDを作成
   - アプリケーションの種類: ウェブアプリケーション
   - 承認済みのリダイレクトURI: `https://your-domain.com/api/auth/callback/google`
3. クライアントIDとクライアントシークレットを取得

#### 2.2 GitHub OAuth設定

1. GitHubのSettings > Developer settings > OAuth Appsで新しいアプリを作成
2. Authorization callback URL: `https://your-domain.com/api/auth/callback/github`
3. クライアントIDとクライアントシークレットを取得

#### 2.3 環境変数の設定

3つの方法から選択できます：

方法A: 1Password Environments（推奨・最も安全）

1Password Environmentsを使用すると、シークレットが安全に管理され、ディスクに保存されません。

前提条件:

- 1Password for Mac/Linuxがインストール済み
- 1Password Developerが有効化済み

セットアップ手順:

1. 1Password Desktop アプリを開く
2. Developer > View Environments を選択
3. New environment をクリックし、`ai-bookmarks-dev`という名前で作成
4. 環境変数を追加:
   - `BETTER_AUTH_URL`: `http://localhost:5173`
   - `BETTER_AUTH_SECRET`: ランダムな文字列（32文字以上推奨）
   - `GOOGLE_CLIENT_ID`: Google OAuthのクライアントID
   - `GOOGLE_CLIENT_SECRET`: Google OAuthのクライアントシークレット
   - `GITHUB_CLIENT_ID`: GitHub OAuthのクライアントID
   - `GITHUB_CLIENT_SECRET`: GitHub OAuthのクライアントシークレット
5. Destinations タブで「Local .env file」を選択
6. ファイルパスにプロジェクトルートの`.dev.vars`を指定
7. Mount .env file をクリック

これで、1Passwordがアクセス時に自動的に`.dev.vars`ファイルにシークレットを注入します。

方法B: 従来の方法（.dev.varsファイル）

```bash
# テンプレートをコピー
cp .dev.vars.example .dev.vars

# .dev.varsを編集して実際の値を入力
# または
pnpm run setup:env
```

本番環境用:

```bash
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put GOOGLE_CLIENT_SECRET
pnpm wrangler secret put GITHUB_CLIENT_SECRET
```

`wrangler.jsonc`にも設定を追加:

```jsonc
{
  "vars": {
    "BETTER_AUTH_URL": "https://your-domain.com",
    "GOOGLE_CLIENT_ID": "your-google-client-id",
    "GITHUB_CLIENT_ID": "your-github-client-id",
  },
}
```

### 3. D1データベースの作成

```bash
# ローカル開発用データベース
pnpm wrangler d1 create ai-bookmarks-db

# 本番環境用データベース
pnpm wrangler d1 create ai-bookmarks-db --env production
```

作成されたデータベースIDを`wrangler.jsonc`の`d1_databases[0].database_id`に設定してください。

### 4. マイグレーションの実行

```bash
# スキーマからマイグレーションファイルを生成
pnpm run db:generate

# ローカルD1にマイグレーションを適用
pnpm run db:migrate

# 本番環境にマイグレーションを適用
pnpm run db:migrate:prod
```

### 5. 開発サーバーの起動

```bash
pnpm run dev
```

ブラウザで <http://localhost:5173> を開きます。

## デプロイ

### 1. 環境変数の設定（本番環境）

本番環境のシークレットを設定:

```bash
pnpm wrangler secret put BETTER_AUTH_SECRET
pnpm wrangler secret put GOOGLE_CLIENT_SECRET
pnpm wrangler secret put GITHUB_CLIENT_SECRET
```

`wrangler.jsonc`の`vars`を本番環境のURLに更新:

```jsonc
{
  "vars": {
    "BETTER_AUTH_URL": "https://your-domain.com",
    "GOOGLE_CLIENT_ID": "your-google-client-id",
    "GITHUB_CLIENT_ID": "your-github-client-id",
  },
}
```

### 2. Cloudflare Workers へのデプロイ

```bash
pnpm run deploy
```

### 3. カスタムドメインの設定（オプション）

カスタムドメインを使用する場合は、`wrangler.jsonc`に`routes`を追加:

```jsonc
{
  "routes": [
    {
      "pattern": "your-domain.com",
      "custom_domain": true,
    },
  ],
}
```

## 使い方

### 初回ログイン

1. アプリケーションにアクセス
2. GoogleまたはGitHubでログイン
3. 初回ログインでユーザーアカウントが自動作成されます

### ブックマークの追加

1. トップページのURL入力フォームにURLを入力
2. 追加ボタンをクリック
3. Workers AIが自動的にページタイトル、カテゴリ、説明文を生成
4. ブックマークが一覧に追加されます

### ブックマークの管理

- スター: お気に入りブックマークにマーク
- 既読/未読: 読んだブックマークを管理
- アーカイブ: 使わなくなったブックマークを保管
- 削除: ブックマークを完全に削除

### ファイル管理（Beta）

テキストファイルやPDFをアップロードして、AIによる自動分析が可能です。

対応ファイル:

- テキストファイル: .txt, .md, .json, .html, .css, .js, .ts等
- PDFファイル: .pdf（簡易的なテキスト抽出）

制限:

- 最大ファイルサイズ: 10MB
- AI分析テキスト長: 最大10,000文字
- 画像・動画・音声ファイルは未対応（AI分析は実行されません）

注意: この機能はベータ版です。PDFからのテキスト抽出は簡易的な実装であり、本番環境では専用ライブラリの使用を推奨します。マルチモーダルファイル（画像・音声等）の処理には別のAIモデルが必要です。

### アカウント管理

ヘッダーの「設定」リンクから以下の操作が可能です:

- 連携アカウントの表示: GoogleとGitHubアカウントの連携状態を確認
- アカウントの連携: 新しいアカウントを追加で連携（複数アカウント対応）
- アカウントの連携解除: 不要なアカウントの連携を解除（最後のアカウントは解除不可）
- アカウントの削除: 全データを完全削除（確認のため「削除する」と入力が必要）

### その他のページ

- プライバシーポリシー: `/privacy` - データの取り扱いについて
- 利用規約: `/terms` - サービスの利用条件について

## データベーススキーマ

### user テーブル（Better Auth）

| カラム名       | 型      | 説明                           |
| -------------- | ------- | ------------------------------ |
| id             | TEXT    | 主キー（UUID）                 |
| name           | TEXT    | ユーザー名                     |
| email          | TEXT    | メールアドレス（ユニーク）     |
| email_verified | BOOLEAN | メール検証済みフラグ           |
| role           | TEXT    | ロール（admin/user）           |
| created_at     | INTEGER | 作成日時（UNIXタイムスタンプ） |
| updated_at     | INTEGER | 更新日時                       |

### session テーブル（Better Auth）

| カラム名   | 型      | 説明                       |
| ---------- | ------- | -------------------------- |
| id         | TEXT    | 主キー                     |
| user_id    | TEXT    | ユーザーID（外部キー）     |
| expires_at | INTEGER | 有効期限                   |
| ip_address | TEXT    | IPアドレス（セキュリティ） |
| user_agent | TEXT    | ユーザーエージェント       |
| created_at | INTEGER | 作成日時                   |
| updated_at | INTEGER | 更新日時                   |

### account テーブル（Better Auth - OAuth）

| カラム名                 | 型      | 説明                          |
| ------------------------ | ------- | ----------------------------- |
| id                       | TEXT    | 主キー                        |
| user_id                  | TEXT    | ユーザーID（外部キー）        |
| account_id               | TEXT    | プロバイダー側のユーザーID    |
| provider_id              | TEXT    | プロバイダー（google/github） |
| access_token             | TEXT    | OAuthアクセストークン         |
| access_token_expires_at  | INTEGER | アクセストークン有効期限      |
| refresh_token            | TEXT    | OAuthリフレッシュトークン     |
| refresh_token_expires_at | INTEGER | リフレッシュトークン有効期限  |
| id_token                 | TEXT    | OpenID Connect IDトークン     |
| scope                    | TEXT    | OAuthスコープ                 |
| expires_at               | INTEGER | トークン有効期限              |
| created_at               | INTEGER | 作成日時                      |
| updated_at               | INTEGER | 更新日時                      |

注意: このアプリケーションはOAuth認証のみを使用しており、パスワード認証は実装していません。

### categories テーブル（全ユーザー共有カテゴリマスター）

| カラム名   | 型      | 説明                                           |
| ---------- | ------- | ---------------------------------------------- |
| id         | INTEGER | 主キー（自動採番）                             |
| name       | TEXT    | カテゴリ名（ユニーク制約）                     |
| type       | TEXT    | タイプ（major: 大カテゴリ、minor: 小カテゴリ） |
| parent_id  | INTEGER | 親カテゴリID（小カテゴリの場合のみ）           |
| icon       | TEXT    | SVGアイコン（AI生成）                          |
| created_at | INTEGER | 作成日時（UNIXタイムスタンプ）                 |

注意: カテゴリは全ユーザー間で共有され、同じURLには同じカテゴリが適用されます。これによりAI生成コストを削減し、カテゴリの一貫性を保ちます。

### urls テーブル（全ユーザー共有URLマスター）

| カラム名          | 型      | 説明                           |
| ----------------- | ------- | ------------------------------ |
| id                | INTEGER | 主キー（自動採番）             |
| url               | TEXT    | URL（ユニーク制約）            |
| title             | TEXT    | ページタイトル（AI生成）       |
| description       | TEXT    | 説明文（AI生成）               |
| major_category_id | INTEGER | 大カテゴリID（外部キー）       |
| minor_category_id | INTEGER | 小カテゴリID（外部キー）       |
| created_at        | INTEGER | 作成日時（UNIXタイムスタンプ） |
| updated_at        | INTEGER | 更新日時                       |

注意: URLとAI生成メタデータ（タイトル、説明、カテゴリ）は全ユーザー間で共有されます。同じURLを複数のユーザーが追加しても、AI処理は初回のみ実行され、以降は既存データを再利用します。

### user_bookmarks テーブル（ユーザー固有のブックマーク設定）

| カラム名      | 型      | 説明                     |
| ------------- | ------- | ------------------------ |
| id            | INTEGER | 主キー（自動採番）       |
| user_id       | TEXT    | ユーザーID（外部キー）   |
| url_id        | INTEGER | URL ID（外部キー）       |
| is_starred    | BOOLEAN | スターフラグ             |
| read_status   | TEXT    | 既読状態（unread/read）  |
| is_archived   | BOOLEAN | アーカイブフラグ         |
| display_order | INTEGER | 表示順序                 |
| version       | INTEGER | 楽観的ロック用バージョン |
| created_at    | INTEGER | 作成日時                 |
| updated_at    | INTEGER | 更新日時                 |

注意: ユーザー固有のプロパティ（スター、既読、アーカイブ、表示順）のみを保存します。各ユーザーは同じURLに対して独自の設定を持つことができます。

## セキュリティ

### 実装済みの対策

#### 1. SQLインジェクション対策

- Drizzle ORMのプリペアドステートメント: すべてのクエリでパラメータ化されたクエリを使用
- 入力値検証: SQL特殊文字パターンの検出と拒否
- 型安全性: TypeScriptによる型チェックで不正な値の混入を防止

#### 2. XSS（クロスサイトスクリプティング）対策

- Reactの自動エスケープ: すべてのユーザー入力が自動的にエスケープされる
- sanitize-html: 業界標準のHTMLサニタイザーを使用
  - バトルテスト済みのライブラリ（週2M+ダウンロード、10年以上のメンテナンス実績）
  - ホワイトリスト方式による安全な実装（allowedTags: [], allowedAttributes: {}）
  - 再帰的エスケープモード（disallowedTagsMode: "recursiveEscape"）でネストされた攻撃も防御
  - 正規表現ではなく適切なHTMLパーサーを使用
- スクレイピングしたコンテンツからHTMLタグを完全除去
- CSPヘッダー: Content Security Policyで不正なスクリプト実行を防止
  - `default-src 'self'`: 同一オリジンのみ許可
  - `script-src 'self' 'unsafe-inline'`: インラインスクリプトを最小限に
  - `frame-ancestors 'none'`: クリックジャッキング防止
  - `upgrade-insecure-requests`: HTTPSへの自動アップグレード
  - `block-all-mixed-content`: 混在コンテンツのブロック
- セキュリティヘッダー:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Permissions-Policy`: 不要な機能の無効化
  - `Strict-Transport-Security`: HTTPS強制（本番環境）

#### 3. Prompt Injection対策

- 入力サニタイゼーション:
- 制御文字の除去
- プロンプトインジェクション用キーワードのエスケープ（` ``` `、`{}`、`system:`、`ignore previous`など）
- 長さ制限（URL: 500文字、タイトル: 200文字、コンテンツ: 1000文字）
- プロンプト構造の分離:
- システムプロンプトとユーザー入力を明確に分離
- `--- ユーザー入力開始 ---` マーカーで境界を明示
- AI応答の検証:
- 応答サイズの制限（DoS対策）
- JSON形式の厳格な検証
- 危険な文字列パターンの検出

#### 4. SSRF（Server-Side Request Forgery）対策

- プロトコル制限: HTTP/HTTPSのみ許可、`javascript:`、`data:`、`file:`などを拒否
- プライベートIPブロック:
- ローカルホスト（127.0.0.1、::1）
- プライベートIP範囲（10.0.0.0/8、172.16.0.0/12、192.168.0.0/16）
- リンクローカル（169.254.0.0/16、fe80::/10）
- URL長制限: 最大2048文字

#### 5. その他のセキュリティ対策

- URL検証: 形式チェック、プロトコル検証、ホスト名検証
- 入力値制限: すべての入力に対する長さ制限と形式検証
- 重複チェック: 同一URLの重複登録防止
- エラーハンドリング: 詳細なエラー情報の漏洩防止
- アクセス制御: Cloudflare Zero Trust統合

### 認証とアクセス制御

- Better Authによる認証システム
- GoogleとGitHubのOAuth 2.0認証（パスワード認証は非対応）
- サーバーサイドセッション管理（7日間有効、1日ごとに更新）
- CSRF保護（Origin検証、state/PKCE検証、SameSite=Lax）
- セキュアクッキー（httpOnly, secure）
- IPトラッキングによる不正アクセス検出
- レート制限（60秒で10リクエスト）

### データの分離

- すべてのクエリで`WHERE user_id = ?`によるユーザー分離を実施
- IDOR（Insecure Direct Object Reference）対策
- アカウント管理API（連携解除・削除）でのユーザーID検証
- 最後のアカウント保護（削除不可）
- アカウント削除時のカスケード削除（bookmarks, categories, accounts, sessions）

### セキュリティベストプラクティス

#### 本番環境での推奨設定

1. Better Auth認証を有効化
   - OAuth 2.0による安全な認証
   - PKCE（Proof Key for Code Exchange）による保護
   - CSRF保護の有効化
   - セキュアクッキー（httpOnly, secure, sameSite）

2. Rate Limitingを設定:
   - Better Auth組み込みのレート制限（デフォルト: 60秒で10リクエスト）
   - Cloudflare Workers設定でCPU制限:

   ```jsonc
   // wrangler.jsonc
   {
     "limits": {
       "cpu_ms": 10000,
     },
   }
   ```

3. 環境変数の管理: シークレットは`pnpm wrangler secret put`で設定
4. ログ監視: Cloudflare Workers Analyticsで異常なアクセスパターンを監視
5. 定期的なセキュリティ監査: 依存関係の脆弱性チェック（`pnpm audit`）

#### コードレビューのチェックポイント

- [ ] すべてのユーザー入力は検証・サニタイズされているか
- [ ] SQLクエリはプリペアドステートメントを使用しているか
- [ ] AI プロンプトにユーザー入力を直接埋め込んでいないか
- [ ] 外部URLへのリクエストは検証されているか
- [ ] エラーメッセージに機密情報が含まれていないか
- [ ] セキュリティヘッダーは適切に設定されているか

## 将来の拡張

### 追加機能の候補

- ブックマーク共有機能
- タグ機能
- 全文検索
- ブックマークのエクスポート/インポート
- カテゴリのカスタマイズ
- ブックマークのメモ機能
- AIによる関連ブックマークの推薦

## 開発コマンド

```bash
# 環境変数のセットアップ（初回のみ）
# 方法A: 従来の方法
pnpm run setup:env

# 方法B: 1Password CLI
pnpm run setup:env:1p

# 開発サーバー起動
pnpm run dev

# ビルド
pnpm run build

# 型チェック
pnpm run typecheck

# コードフォーマット
pnpm run format

# フォーマットチェック
pnpm run format:check

# Lintチェック
pnpm run lint

# Lint自動修正
pnpm run lint:fix

# テスト実行
pnpm test

# テストをウォッチモードで実行
pnpm run test:watch

# テストUIを起動
pnpm run test:ui

# カバレッジ付きでテスト実行
pnpm run test:coverage

# D1マイグレーション生成
pnpm run db:generate

# ローカルD1マイグレーション適用
pnpm run db:migrate

# 本番D1マイグレーション適用
pnpm run db:migrate:prod

# Drizzle Studio起動（GUIでDBを確認）
pnpm run db:studio

# デプロイ
pnpm run deploy
```

## テスト

このプロジェクトには、セキュリティと機能を検証するための包括的なテストが含まれています。

### テストの実行

```bash
# すべてのテストを実行
pnpm test

# ウォッチモードで実行（開発中に便利）
pnpm run test:watch

# ブラウザでテストUIを表示
pnpm run test:ui

# カバレッジレポートを生成
pnpm run test:coverage
```

### テストの範囲

1. セキュリティテスト（`app/services/__tests__/security.server.test.ts`）
   - XSS対策: HTMLタグのサニタイゼーション
   - Prompt Injection対策: AIプロンプトの安全性
   - SQLインジェクション対策: 入力値の検証
   - SSRF対策: URL検証とプライベートIPブロック
   - ファイルセキュリティ: ファイル名サニタイゼーション、MIMEタイプ検証、magic number検証
   - レート制限: リクエスト制限の動作確認

2. データベース操作テスト（`app/services/__tests__/db.server.test.ts`）
   - ユーザー分離の検証
   - URL重複チェック
   - 楽観的ロックの動作確認
   - IDOR対策
   - トランザクション処理

### CI/CD

GitHub Actionsを使用した自動テストが設定されています（`.github/workflows/test.yml`）：

- プッシュ時とプルリクエスト時に自動実行
- 型チェック、Lint、テスト、ビルドを順次実行
- すべてのチェックが成功した場合のみマージ可能

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します！

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
