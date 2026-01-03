# AI Bookmarks

Cloudflare Workers AI、D1データベース、Drizzle ORMを使った自動カテゴリ分類ブックマーク管理アプリケーション。

## 特徴

- AI自動分類: Workers AIがURLから大カテゴリ・小カテゴリ・説明文を自動生成
- スマートカテゴリ: 既存カテゴリとの類似性を考慮してカテゴリを選択・統合
- モダンUI: Tailwind CSS v4によるレスポンシブでダークモード対応のデザイン
- セキュア: Drizzle ORMによるSQLインジェクション対策、CSPヘッダー設定
- 高速: Cloudflare Workers上で動作する超高速SPA
- スケーラブル: D1データベースで大量のブックマークを管理

## 技術スタック

- フロントエンド: React 19 + React Router 7 + Tailwind CSS v4
- バックエンド: Cloudflare Workers
- データベース: Cloudflare D1 (SQLite)
- ORM: Drizzle ORM
- AI: Cloudflare Workers AI (Llama 3.1)

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. D1データベースの作成

```bash
# ローカル開発用データベース
pnpm wrangler d1 create ai-bookmarks-db

# 本番環境用データベース
pnpm wrangler d1 create ai-bookmarks-db --env production
```

作成されたデータベースIDを`wrangler.jsonc`の`d1_databases[0].database_id`に設定してください。

### 3. マイグレーションの実行

```bash
# スキーマからマイグレーションファイルを生成
pnpm run db:generate

# ローカルD1にマイグレーションを適用
pnpm run db:migrate

# 本番環境にマイグレーションを適用
pnpm run db:migrate:prod
```

### 4. 開発サーバーの起動

```bash
pnpm run dev
```

ブラウザで <http://localhost:5173> を開きます。

## デプロイ

### 1. Cloudflare Workers へのデプロイ

```bash
pnpm run deploy
```

### 2. Cloudflare Zero Trustによるアクセス制御

アプリケーションへのアクセスを制御するため、Cloudflare Zero Trustを設定します。

#### 2.1 Cloudflare Zero Trust の有効化

1. Cloudflare Dashboardにログイン
2. 左サイドバーから Zero Trust を選択
3. チームを作成（初回のみ）

#### 2.2 Access アプリケーションの作成

1. Zero Trust ダッシュボードで Access → Applications を選択
2. Add an application をクリック
3. Self-hosted を選択

Application Configuration:

- Application name: AI Bookmarks
- Session Duration: 24 hours（お好みで調整）
- Application domain:
  - Subdomain: `ai-bookmarks`（Workers のカスタムドメインまたは workers.dev ドメイン）
  - Domain: `your-domain.workers.dev` または カスタムドメイン

Identity providers:

- Add a Rule をクリック
- Rule name: Email Authentication
- Action: Allow
- Configure rules:
  - Include: Emails → 許可するメールアドレスを追加
  - または Emails ending in → `@example.com`（ドメイン全体を許可）

1. Save application をクリック

#### 2.3 wrangler.jsonc の更新（オプション）

カスタムドメインを使用する場合は、`wrangler.jsonc`に`routes`を追加:

```jsonc
{
  // ... 既存の設定
  "routes": [
    {
      "pattern": "ai-bookmarks.example.com",
      "custom_domain": true
    }
  ]
}
```

#### 2.4 動作確認

1. アプリケーションのURLにアクセス
2. Cloudflare Access のログイン画面が表示されることを確認
3. 許可されたメールアドレスでログイン
4. アプリケーションが表示されることを確認

## 使い方

### ブックマークの追加

1. トップページのURL入力フォームにURLを入力
2. 追加ボタンをクリック
3. Workers AIが自動的にページタイトル、カテゴリ、説明文を生成
4. ブックマークが一覧に追加されます

### ブックマークの削除

- 各ブックマークカードにマウスホバーすると削除ボタンが表示されます
- 削除ボタンをクリックして削除

## データベーススキーマ

### categories テーブル

| カラム名   | 型      | 説明                                           |
| ---------- | ------- | ---------------------------------------------- |
| id         | INTEGER | 主キー（自動採番）                             |
| name       | TEXT    | カテゴリ名                                     |
| type       | TEXT    | タイプ（major: 大カテゴリ、minor: 小カテゴリ） |
| parent_id  | INTEGER | 親カテゴリID（小カテゴリの場合のみ）           |
| created_at | INTEGER | 作成日時（UNIXタイムスタンプ）                 |

### bookmarks テーブル

| カラム名          | 型      | 説明                                       |
| ----------------- | ------- | ------------------------------------------ |
| id                | INTEGER | 主キー（自動採番）                         |
| url               | TEXT    | ブックマークURL                            |
| title             | TEXT    | ページタイトル                             |
| description       | TEXT    | 説明文                                     |
| major_category_id | INTEGER | 大カテゴリID                               |
| minor_category_id | INTEGER | 小カテゴリID                               |
| user_id           | TEXT    | ユーザーID（将来の認証対応用、現在はNULL） |
| created_at        | INTEGER | 作成日時                                   |
| updated_at        | INTEGER | 更新日時                                   |

## セキュリティ

### 実装済みの対策

#### 1. SQLインジェクション対策

- Drizzle ORMのプリペアドステートメント: すべてのクエリでパラメータ化されたクエリを使用
- 入力値検証: SQL特殊文字パターンの検出と拒否
- 型安全性: TypeScriptによる型チェックで不正な値の混入を防止

#### 2. XSS（クロスサイトスクリプティング）対策

- Reactの自動エスケープ: すべてのユーザー入力が自動的にエスケープされる
- DOMPurify: 業界標準のHTMLサニタイザーを使用
- すべてのHTMLタグとスクリプトを安全に処理
- スクレイピングしたコンテンツからHTMLタグを完全除去
- XSS攻撃ベクターを自動的に検出・除去
- CSPヘッダー: Content Security Policyで不正なスクリプト実行を防止
- `default-src 'self'`: 同一オリジンのみ許可
- `script-src 'self' 'unsafe-inline'`: インラインスクリプトを最小限に
- `frame-ancestors 'none'`: クリックジャッキング防止
- `upgrade-insecure-requests`: HTTPSへの自動アップグレード
- `block-all-mixed-content`: 混在コンテンツのブロック
- HTMLタグの除去: スクレイピングしたコンテンツからHTMLタグを完全除去
- 危険な文字の検出: `<script>`、`onerror`、`onclick`などの検出
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

### セキュリティベストプラクティス

#### 本番環境での推奨設定

1. Cloudflare Zero Trustを有効化してアクセス制御を実装
2. Rate Limitingを設定（Cloudflare Workers設定で）:

   ```jsonc
   // wrangler.jsonc
   {
     "limits": {
       "cpu_ms": 10000
     }
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

### ユーザー認証の追加

現在は全体でCloudflare Zero Trustによるアクセス制御のみですが、将来的にユーザーごとのブックマーク管理を実装する場合:

1. 認証プロバイダー（Cloudflare Access、Auth0等）を統合
2. `bookmarks.user_id`に実際のユーザーIDを設定
3. クエリに`WHERE user_id = ?`フィルタを追加
4. マイグレーションで`user_id`を`NOT NULL`制約に変更

```sql
-- 将来のマイグレーション例
ALTER TABLE bookmarks ALTER COLUMN user_id SET NOT NULL;
```

## 開発コマンド

```bash
# 開発サーバー起動
pnpm run dev

# ビルド
pnpm run build

# 型チェック
pnpm run typecheck

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

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します！

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
