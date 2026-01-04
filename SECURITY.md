# セキュリティ対策チェックリスト

このドキュメントは、AI Bookmarksアプリケーションに実装されているセキュリティ対策の詳細なチェックリストです。

## ✅ 実装済みのセキュリティ対策

### 1. SQLインジェクション対策

- [x] **Drizzle ORMのプリペアドステートメント**
  - ファイル: `app/services/db.server.ts`
  - すべてのクエリでパラメータ化されたクエリを使用
  - 例: `db.select().from(bookmarks).where(eq(bookmarks.id, id))`

- [x] **入力値検証**
  - ファイル: `app/services/security.server.ts` - `validateTextInput()`
  - SQL特殊文字パターンの検出と拒否（`--`, `UNION SELECT`, `DROP`, etc.）
  - 不正なパターンが検出された場合は処理を拒否

- [x] **型安全性**
  - TypeScriptによる静的型チェック
  - すべてのデータベース操作で型定義を使用

### 2. XSS（クロスサイトスクリプティング）対策

- [x] **Reactの自動エスケープ**
  - すべてのユーザー入力が自動的にエスケープされる
  - `dangerouslySetInnerHTML`は使用していない

- [x] **DOMPurifyによるHTMLサニタイズ**
  - ファイル: `app/services/security.server.ts` - `sanitizeHtml()`, `decodeHtmlEntities()`
  - 業界標準のHTMLサニタイザーを使用（isomorphic-dompurify）
  - 設定可能なサニタイズオプション
  - デフォルト: すべてのHTMLタグを除去してプレーンテキストのみ抽出
  - XSS攻撃ベクターを自動的に検出・除去
  - セキュリティパッチが定期的に提供される

- [x] **Content Security Policy (CSP)**
  - ファイル: `app/entry.server.tsx`
  - 設定内容:
    ```
    default-src 'self'
    script-src 'self' 'unsafe-inline'
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
    font-src 'self' https://fonts.gstatic.com
    img-src 'self' data: https:
    connect-src 'self'
    frame-ancestors 'none'
    base-uri 'self'
    form-action 'self'
    upgrade-insecure-requests
    block-all-mixed-content
    ```

- [x] **セキュリティヘッダー**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### 3. Prompt Injection対策

- [x] **入力サニタイゼーション**
  - ファイル: `app/services/security.server.ts` - `sanitizeForPrompt()`
  - 制御文字の除去（改行とタブ以外）
  - プロンプトインジェクション用キーワードのエスケープ:
    - ` ``` ` → `'''`
    - `{` → `\{`
    - `}` → `\}`
    - `system:`, `assistant:`, `user:` → 末尾に`_`を追加
    - `ignore previous`, `disregard`, `forget` → `[removed]`
  - 長さ制限:
    - URL: 500文字
    - タイトル: 200文字
    - コンテンツ: 1000文字

- [x] **プロンプト構造の分離**
  - ファイル: `app/services/ai.server.ts`
  - システムプロンプトとユーザー入力を明確に分離
  - `--- ユーザー入力開始 ---` / `--- ユーザー入力終了 ---` マーカーで境界を明示

- [x] **AI応答の検証**
  - ファイル: `app/services/security.server.ts` - `validateAiResponse()`
  - 応答サイズの制限（最大10,000文字、DoS対策）
  - JSON形式の厳格な検証
  - 危険な文字列パターンの検出

### 4. SSRF（Server-Side Request Forgery）対策

- [x] **プロトコル制限**
  - ファイル: `app/services/security.server.ts` - `validateUrlStrict()`
  - HTTP/HTTPSのみ許可
  - 危険なプロトコルを拒否:
    - `javascript:`
    - `data:`
    - `file:`
    - `vbscript:`

- [x] **プライベートIPブロック**
  - ローカルホスト: `localhost`, `127.0.0.1`, `::1`
  - プライベートIP範囲:
    - `10.0.0.0/8`
    - `172.16.0.0/12` (172.16-31.x.x)
    - `192.168.0.0/16`
  - リンクローカル:
    - `169.254.0.0/16`
    - `fe80::/10`

- [x] **URL長制限**
  - 最大2048文字

### 5. その他のセキュリティ対策

- [x] **厳格なURL検証**
  - ファイル: `app/services/security.server.ts`
  - 形式チェック
  - プロトコル検証
  - ホスト名検証

- [x] **入力値の長さ制限**
  - すべての入力に対する長さ制限と形式検証
  - カテゴリ名: 100文字
  - 説明文: 200文字
  - タイトル: 200文字
  - URL: 2048文字

- [x] **重複チェック**
  - ファイル: `app/services/db.server.ts` - `checkDuplicateUrl()`
  - 同一URLの重複登録防止

- [x] **エラーハンドリング**
  - 詳細なエラー情報の漏洩防止
  - ユーザーには一般的なエラーメッセージのみ表示
  - 詳細はサーバーログに記録

- [x] **タイムアウト設定**
  - ファイル: `app/services/scraper.server.ts`
  - 外部URLへのリクエストに10秒のタイムアウト
  - DoS攻撃からの保護

## 📋 本番環境での追加推奨設定

### Cloudflare設定

- [ ] **Cloudflare Zero Trust**を有効化
- [ ] **Rate Limiting**を設定
  ```jsonc
  // wrangler.jsonc
  {
    "limits": {
      "cpu_ms": 10000,
    },
  }
  ```
- [ ] **WAF（Web Application Firewall）**ルールを設定
- [ ] **DDoS Protection**を有効化

### 監視とロギング

- [ ] **Cloudflare Workers Analytics**で異常なアクセスパターンを監視
- [ ] **エラーログ**の定期的な確認
- [ ] **セキュリティインシデント**の対応手順を確立

### 依存関係管理

- [ ] 定期的な依存関係の脆弱性チェック: `pnpm audit`
- [ ] 依存関係の自動更新設定（Dependabot等）
- [ ] セキュリティアップデートの迅速な適用

### HTTPS/TLS

- [ ] **HSTS（Strict-Transport-Security）**ヘッダーの有効化
  ```typescript
  responseHeaders.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  ```
- [ ] HTTPSリダイレクトの強制
- [ ] TLS 1.3の使用

## 🔍 コードレビューチェックリスト

新しいコードを追加する際は、以下の項目を確認してください:

### 入力検証

- [ ] すべてのユーザー入力は検証されているか
- [ ] 入力値の長さ制限が設定されているか
- [ ] 想定外の入力に対するエラーハンドリングがあるか

### データベース

- [ ] SQLクエリはプリペアドステートメントを使用しているか
- [ ] 動的なクエリ生成を避けているか
- [ ] ユーザー入力をクエリに直接埋め込んでいないか

### AI/LLM

- [ ] AIプロンプトにユーザー入力を直接埋め込んでいないか
- [ ] プロンプトインジェクション対策が実装されているか
- [ ] AI応答の検証とサニタイズが行われているか

### 外部通信

- [ ] 外部URLへのリクエストは検証されているか
- [ ] SSRF対策が実装されているか
- [ ] タイムアウトが設定されているか

### 出力

- [ ] ユーザーに表示される前にエスケープされているか
- [ ] エラーメッセージに機密情報が含まれていないか
- [ ] ログに個人情報が記録されていないか

### ヘッダー

- [ ] セキュリティヘッダーは適切に設定されているか
- [ ] CSPは最小権限の原則に従っているか

## 📚 参考リソース

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Cloudflare Workers Security Best Practices](https://developers.cloudflare.com/workers/platform/best-practices/security/)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Prompt Injection Defense](https://learnprompting.org/docs/prompt_hacking/defensive_measures/introduction)

## 🚨 インシデント対応

セキュリティインシデントが発生した場合:

1. **即座にアプリケーションを停止** (`wrangler delete`)
2. **影響範囲を特定**（ログの確認）
3. **脆弱性を修正**
4. **セキュリティパッチをデプロイ**
5. **ユーザーに通知**（必要に応じて）
6. **事後レビュー**を実施し、再発防止策を策定

## 更新履歴

- 2026-01-03: 初版作成 - 包括的なセキュリティ対策を実装
