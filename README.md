# AI Bookmarks

Cloudflare Workers AI、D1データベース、Drizzle ORMを使った自動カテゴリ分類ブックマーク管理アプリケーション。

## 特徴

- 🤖 **AI自動分類**: Workers AIがURLから大カテゴリ・小カテゴリ・説明文を自動生成
- 📚 **スマートカテゴリ**: 既存カテゴリとの類似性を考慮してカテゴリを選択・統合
- 🎨 **モダンUI**: Tailwind CSS v4によるレスポンシブでダークモード対応のデザイン
- 🔒 **セキュア**: Drizzle ORMによるSQLインジェクション対策、CSPヘッダー設定
- ⚡ **高速**: Cloudflare Workers上で動作する超高速SPA
- 🌐 **スケーラブル**: D1データベースで大量のブックマークを管理

## 技術スタック

- **フロントエンド**: React 19 + React Router 7 + Tailwind CSS v4
- **バックエンド**: Cloudflare Workers
- **データベース**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **AI**: Cloudflare Workers AI (Llama 3.1)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. D1データベースの作成

```bash
# ローカル開発用データベース
npx wrangler d1 create ai-bookmarks-db

# 本番環境用データベース
npx wrangler d1 create ai-bookmarks-db --env production
```

作成されたデータベースIDを`wrangler.jsonc`の`d1_databases[0].database_id`に設定してください。

### 3. マイグレーションの実行

```bash
# スキーマからマイグレーションファイルを生成
npm run db:generate

# ローカルD1にマイグレーションを適用
npm run db:migrate

# 本番環境にマイグレーションを適用
npm run db:migrate:prod
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで <http://localhost:5173> を開きます。

## デプロイ

### 1. Cloudflare Workers へのデプロイ

```bash
npm run deploy
```

### 2. Cloudflare Zero Trustによるアクセス制御

アプリケーションへのアクセスを制御するため、Cloudflare Zero Trustを設定します。

#### 2.1 Cloudflare Zero Trust の有効化

1. Cloudflare Dashboardにログイン
2. 左サイドバーから **Zero Trust** を選択
3. チームを作成（初回のみ）

#### 2.2 Access アプリケーションの作成

1. Zero Trust ダッシュボードで **Access** → **Applications** を選択
2. **Add an application** をクリック
3. **Self-hosted** を選択

**Application Configuration**:

- **Application name**: AI Bookmarks
- **Session Duration**: 24 hours（お好みで調整）
- **Application domain**:
  - Subdomain: `ai-bookmarks`（Workers のカスタムドメインまたは workers.dev ドメイン）
  - Domain: `your-domain.workers.dev` または カスタムドメイン

**Identity providers**:

- **Add a Rule** をクリック
- Rule name: Email Authentication
- Action: Allow
- Configure rules:
  - Include: **Emails** → 許可するメールアドレスを追加
  - または **Emails ending in** → `@example.com`（ドメイン全体を許可）

1. **Save application** をクリック

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
2. **追加**ボタンをクリック
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

- ✅ **SQLインジェクション対策**: Drizzle ORMのプリペアドステートメント使用
- ✅ **XSS対策**: Reactの自動エスケープ + CSP設定
- ✅ **URL検証**: HTTP/HTTPSのみ許可、URL形式チェック
- ✅ **入力値制限**: 説明文200文字、コンテンツ2000文字に制限
- ✅ **セキュリティヘッダー**: CSP, X-Frame-Options, X-Content-Type-Options 等
- ✅ **アクセス制御**: Cloudflare Zero Trust統合

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
npm run dev

# ビルド
npm run build

# 型チェック
npm run typecheck

# D1マイグレーション生成
npm run db:generate

# ローカルD1マイグレーション適用
npm run db:migrate

# 本番D1マイグレーション適用
npm run db:migrate:prod

# Drizzle Studio起動（GUIでDBを確認）
npm run db:studio

# デプロイ
npm run deploy
```

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します！

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
