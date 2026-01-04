# AGENTS.md - AI Agents開発ガイドライン

このドキュメントは、AI Bookmarksプロジェクトに取り組むAI Agentsのための包括的なガイドラインです。

## 📋 基本方針

### 言語について
- **指示がない限り、すべてのドキュメント、コメント、コミットメッセージは日本語で作成すること**
- コード内の変数名、関数名、型名は英語を使用
- ユーザー向けのメッセージやUI文言は日本語

### ドキュメント作成について
- 絵文字や強調記法は原則使用しない（見出しの視覚的マーカーとしての使用は例外）
- 読みやすい記載を心がける
- 簡潔で明確な表現を使用する
- 箇条書きを活用して情報を整理する
- 専門用語には必要に応じて説明を付ける

### 変更のスコープ
- **最小限の変更を心がける**：タスクに必要な最小限のファイルと行のみを変更
- 既存の動作するコードを不用意に削除・修正しない
- 関連しないバグや壊れたテストは修正しない（タスクに関連する場合のみ修正）

### 必須タスク
コードを変更する際は、以下を必ず実行すること：

1. **コードフォーマット**
   ```bash
   pnpm run format
   ```
   Prettierでコードを自動フォーマット（保存時に自動実行も可能）

2. **Lintチェック**
   ```bash
   pnpm run lint
   ```
   ESLintでコード品質をチェック（自動修正は`pnpm run lint:fix`）

3. **ビルドの確認**
   ```bash
   pnpm build
   ```
   ビルドが成功することを確認してから変更をコミット

4. **型チェック**
   ```bash
   pnpm run typecheck
   ```
   TypeScriptの型エラーがないことを確認

5. **ドキュメントの更新**
   - 機能追加や重要な変更がある場合、README.mdを更新
   - セキュリティに関わる変更がある場合、SECURITY.mdを更新
   - このAGENTS.mdに新しいベストプラクティスがあれば追記

## 🏗️ プロジェクト構成

### 技術スタック
- **フロントエンド**: React 19 + React Router 7 + Tailwind CSS v4
- **バックエンド**: Cloudflare Workers
- **データベース**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **AI**: Cloudflare Workers AI (@cf/openai/gpt-oss-120b)
- **パッケージマネージャー**: pnpm

### ディレクトリ構造
```
ai-bookmarks/
├── app/
│   ├── components/      # Reactコンポーネント
│   ├── db/             # データベーススキーマ
│   │   └── schema.ts   # Drizzle ORMスキーマ定義
│   ├── routes/         # React Routerルート
│   ├── services/       # ビジネスロジック
│   │   ├── ai.server.ts        # AI処理
│   │   ├── db.server.ts        # DB操作
│   │   ├── scraper.server.ts   # Webスクレイピング
│   │   ├── security.server.ts  # セキュリティ処理
│   │   └── rate-limit.server.ts # レート制限
│   ├── types/          # TypeScript型定義
│   ├── constants.ts    # アプリケーション定数
│   └── entry.server.tsx # サーバーエントリポイント
├── migrations/         # データベースマイグレーション
├── public/            # 静的ファイル
├── workers/           # Cloudflare Workers設定
└── wrangler.jsonc     # Cloudflare Workers設定ファイル
```

### 重要なファイル
- `app/constants.ts`: すべての設定値（AI、セキュリティ、UI等）
- `app/db/schema.ts`: データベーススキーマ定義
- `app/services/security.server.ts`: セキュリティ関連の処理
- `wrangler.jsonc`: Cloudflare Workers設定

### Wranglerコマンドの実行方法
このプロジェクトではwranglerがdevDependencyとしてインストールされているため、wranglerコマンドを直接実行する際は**必ず`pnpm`プレフィックスを付ける**必要があります。

```bash
# ✅ 正しい例
pnpm wrangler types
pnpm wrangler d1 migrations apply ai-bookmarks-db --local
pnpm wrangler deploy

# ❌ 間違った例（wranglerが見つからないエラーになる）
wrangler types
npx wrangler types
```

**注意**: `package.json`のscriptsに定義されているコマンド（`pnpm run dev`、`pnpm run build`等）を使用する場合は、内部で自動的にwranglerが実行されるため、このプレフィックスは不要です。

## 🔒 セキュリティガイドライン

### 絶対に守るべきこと

#### 1. SQLインジェクション対策
- **必須**: Drizzle ORMのプリペアドステートメントを使用
- **禁止**: 文字列連結によるSQL構築、動的クエリ生成

```typescript
// ✅ 正しい例
const result = await db
  .select()
  .from(bookmarks)
  .where(eq(bookmarks.id, id));

// ❌ 間違った例
const query = `SELECT * FROM bookmarks WHERE id = ${id}`;
```

#### 2. XSS（クロスサイトスクリプティング）対策
- Reactの自動エスケープを活用（`dangerouslySetInnerHTML`は使用禁止）
- スクレイピングしたコンテンツは`stripHtmlTags()`で必ずサニタイズ
- すべてのユーザー入力を信頼しない

```typescript
// ✅ 正しい例
import { stripHtmlTags, decodeHtmlEntities } from "~/services/security.server";

const cleanText = stripHtmlTags(htmlContent);
const decodedText = decodeHtmlEntities(cleanText);
```

#### 3. Prompt Injection対策
- AIプロンプトにユーザー入力を直接埋め込まない
- `sanitizeForPrompt()`を使用して入力をサニタイズ
- システムプロンプトとユーザー入力を明確に分離

```typescript
// ✅ 正しい例
import { sanitizeForPrompt } from "~/services/security.server";

const sanitizedTitle = sanitizeForPrompt(title, 200);
const prompt = `
システム: 以下のURLを分類してください。

--- ユーザー入力開始 ---
タイトル: ${sanitizedTitle}
--- ユーザー入力終了 ---
`;
```

#### 4. SSRF（Server-Side Request Forgery）対策
- すべての外部URLは`validateUrlStrict()`で検証
- プライベートIPやローカルホストへのアクセスを禁止
- HTTP/HTTPS以外のプロトコルを拒否

```typescript
// ✅ 正しい例
import { validateUrlStrict } from "~/services/security.server";

const validation = validateUrlStrict(url);
if (!validation.isValid) {
  throw new Error(validation.error);
}
```

#### 5. 入力値検証
- すべてのユーザー入力に長さ制限を設定
- `constants.ts`で定義された制限値を使用
- 型チェックだけでなく実行時検証も実施

```typescript
// ✅ 正しい例
import { AI_CONFIG } from "~/constants";

if (title.length > AI_CONFIG.TITLE_MAX_LENGTH) {
  throw new Error("タイトルが長すぎます");
}
```

### セキュリティヘッダー
`app/entry.server.tsx`でセキュリティヘッダーが設定されています。変更する場合は以下を維持：

- Content-Security-Policy（CSP）
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Permissions-Policy
- Referrer-Policy

## 💻 コーディング規約

### コードフォーマットとLint
- **Prettier**: コードフォーマッターとして使用
  - 保存時に自動フォーマット（VS Codeで設定済み）
  - 手動実行: `pnpm run format`
  - チェックのみ: `pnpm run format:check`
- **ESLint**: コード品質チェックツールとして使用
  - 保存時に自動修正（VS Codeで設定済み）
  - 手動実行: `pnpm run lint`
  - 自動修正: `pnpm run lint:fix`
- **VS Code拡張機能**: 
  - `esbenp.prettier-vscode`（Prettier）
  - `dbaeumer.vscode-eslint`（ESLint）
  - プロジェクトを開くと自動的にインストールが推奨される

### TypeScript
- **strictモード**: 常に有効
- **型定義**: すべての関数、変数に適切な型を付ける
- **anyの使用**: 禁止（やむを得ない場合はunknownを使用）
- **nullableな値**: オプショナルチェーン（`?.`）とNullish Coalescing（`??`）を活用

```typescript
// ✅ 正しい例
function processBookmark(bookmark: Bookmark | null): string {
  return bookmark?.title ?? "タイトルなし";
}

// ❌ 間違った例
function processBookmark(bookmark: any): string {
  return bookmark.title || "タイトルなし";
}
```

### React
- **関数コンポーネント**: アロー関数で定義
- **Hooks**: 条件分岐の外で使用
- **Props**: TypeScript interfaceで型定義
- **State管理**: useStateを適切に使用

```typescript
// ✅ 正しい例
interface BookmarkCardProps {
  bookmark: Bookmark;
  onDelete: (id: number) => void;
}

const BookmarkCard: React.FC<BookmarkCardProps> = ({ bookmark, onDelete }) => {
  return <div>{bookmark.title}</div>;
};
```

### データベース操作
- **ORM使用**: Drizzle ORMを必ず使用
- **トランザクション**: 複数の変更は必ずトランザクション内で実行
- **エラーハンドリング**: すべてのDB操作をtry-catchで囲む

```typescript
// ✅ 正しい例
try {
  const bookmark = await db
    .insert(bookmarks)
    .values(newBookmark)
    .returning();
  return bookmark[0];
} catch (error) {
  console.error("ブックマーク追加エラー:", error);
  throw new Error("ブックマークの追加に失敗しました");
}
```

### エラーハンドリング
- **一般的なエラーメッセージ**: ユーザーには詳細を見せない
- **ログ出力**: サーバー側で詳細をログに記録
- **適切な例外**: カスタムエラークラスを活用

```typescript
// ✅ 正しい例
try {
  // 処理
} catch (error) {
  console.error("詳細なエラー情報:", error);
  return json(
    { error: "処理に失敗しました" },
    { status: 500 }
  );
}
```

### コメント
- **JSDoc形式**: 関数やクラスにはJSDocコメントを付ける
- **日本語**: コメントは日本語で記述
- **説明的**: 「何をするか」だけでなく「なぜそうするか」も記述

```typescript
/**
 * ブックマークを追加する
 * 
 * @param url - ブックマークするURL
 * @param context - 実行コンテキスト（D1、AI等）
 * @returns 作成されたブックマーク
 * @throws {Error} URL検証に失敗した場合
 * 
 * 注意: この関数は以下の処理を行います
 * 1. URLの検証（SSRF対策）
 * 2. Webページのスクレイピング
 * 3. AIによるカテゴリ分類
 * 4. データベースへの保存
 */
async function addBookmark(url: string, context: AppLoadContext): Promise<Bookmark> {
  // 実装
}
```

## 🧪 テストとビルド

### ビルドコマンド
```bash
# 開発サーバー起動
pnpm run dev

# コードフォーマット
pnpm run format

# フォーマットチェック
pnpm run format:check

# Lintチェック
pnpm run lint

# Lint自動修正
pnpm run lint:fix

# 本番ビルド（必須）
pnpm run build

# 型チェック（必須）
pnpm run typecheck

# デプロイ
pnpm run deploy
```

### データベース操作
```bash
# マイグレーション生成
pnpm run db:generate

# ローカルD1にマイグレーション適用
pnpm run db:migrate

# 本番D1にマイグレーション適用
pnpm run db:migrate:prod

# Drizzle Studio起動（GUI）
pnpm run db:studio
```

### ビルド前の確認事項
- [ ] `pnpm run format:check`でフォーマットが整っている
- [ ] `pnpm run lint`でESLintエラーがない
- [ ] `pnpm run typecheck`が成功する
- [ ] `pnpm run build`が成功する
- [ ] 追加したコードにセキュリティ上の問題がない
- [ ] README.mdまたはSECURITY.mdの更新が必要な場合は更新済み

## 📝 コミットガイドライン

### コミットメッセージ
- **日本語**: コミットメッセージは日本語で記述
- **簡潔**: 1行目は50文字以内
- **説明的**: 何を変更したかを明確に

```bash
# ✅ 良い例
git commit -m "ブックマーク削除機能を追加"
git commit -m "SQLインジェクション対策を強化"
git commit -m "レート制限のバグを修正"

# ❌ 悪い例
git commit -m "update"
git commit -m "fix bug"
git commit -m "Add bookmark deletion feature" # 英語
```

## 🔧 依存関係管理

### パッケージの追加
- **セキュリティチェック**: 追加前に`pnpm audit`で確認
- **最小限**: 本当に必要なパッケージのみ追加
- **バージョン固定**: メジャーバージョンを固定（`^`を使わない場合もある）

```bash
# パッケージ追加
pnpm add package-name

# 開発用パッケージ追加
pnpm add -D package-name

# セキュリティ監査
pnpm audit
```

### 既存パッケージの更新
- **慎重に**: セキュリティアップデート以外は慎重に
- **テスト**: 更新後は必ずビルドとテストを実行
- **BREAKING CHANGES**: 破壊的変更がないか確認

## 🎯 ベストプラクティス

### 定数の使用
- `constants.ts`で定義された定数を使用
- マジックナンバーは避ける
- 設定値は一箇所で管理

```typescript
// ✅ 正しい例
import { SCRAPER_CONFIG } from "~/constants";

const timeout = SCRAPER_CONFIG.FETCH_TIMEOUT_MS;

// ❌ 間違った例
const timeout = 10000; // マジックナンバー
```

### 非同期処理
- `async/await`を使用
- Promise chainは避ける
- エラーハンドリングを忘れない

```typescript
// ✅ 正しい例
async function fetchData() {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("フェッチエラー:", error);
    throw error;
  }
}
```

### パフォーマンス
- 不要な再レンダリングを避ける
- useMemoとuseCallbackを適切に使用
- 大量データの処理は分割

### アクセシビリティ
- セマンティックHTML要素を使用
- 適切なARIA属性を付与
- キーボード操作に対応

## 🚨 よくある落とし穴

### 1. Wranglerコマンドの実行
- wranglerコマンドを直接実行する際は**必ず`pnpm wrangler`を使用**
- `wrangler`や`npx wrangler`では動作しない（wranglerがdevDependencyのため）
- npm scriptsを使う場合（`pnpm run dev`等）はこの制限は適用されない

```bash
# ✅ 正しい
pnpm wrangler types
pnpm wrangler d1 migrations list ai-bookmarks-db

# ❌ 間違い
wrangler types
npx wrangler types
```

### 2. 環境変数の扱い
- Cloudflare Workers環境ではprocess.envは使えない
- 環境変数は`wrangler.jsonc`または`wrangler secret`で設定
- ローカル開発では`.dev.vars`を使用

### 3. ファイルシステムアクセス
- Workers環境にはファイルシステムがない
- D1やKVストレージを使用

### 4. グローバルオブジェクト
- `window`オブジェクトはサーバーサイドで使用不可
- クライアント専用コードは適切に分離

### 5. タイムゾーン
- すべての時刻はUTCで保存
- 表示時にローカルタイムゾーンに変換

## 📚 参考リソース

### 公式ドキュメント
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [React Router v7](https://reactrouter.com/)
- [React 19](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)

### セキュリティ
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Prompt Injection Defense](https://learnprompting.org/docs/prompt_hacking/defensive_measures/introduction)

## 📞 トラブルシューティング

### ビルドが失敗する
1. `node_modules`を削除して再インストール
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```
2. TypeScriptの型エラーを確認
   ```bash
   pnpm run typecheck
   ```

### D1マイグレーションが失敗する
1. ローカルD1データベースをリセット
   ```bash
   rm -rf .wrangler/state
   pnpm run db:migrate
   ```

### デプロイが失敗する
1. `wrangler.jsonc`の設定を確認
2. D1データベースIDが正しいか確認
3. Cloudflareアカウントの権限を確認

## 🔄 更新履歴

- 2026-01-04: PrettierとESLintの設定を追加 - VS Code拡張機能推奨、フォーマット・Lintルールを業界標準に設定
- 2026-01-03: 初版作成 - 包括的な開発ガイドラインを作成
