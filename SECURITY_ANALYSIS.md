# セキュリティ分析レポート

## 参照記事

[なぜソーシャルログインの際にemailをキーにして参照するのか](https://zenn.dev/ritou/articles/ca7be3f329e68f)

## 分析結果

### ✅ 良好な点

1. **Better Authの使用**
   - Better Authは内部的に`accountId`（OAuth ProviderのユーザーID）で紐付けを管理
   - データベーススキーマで`accounts.accountId`にプロバイダー側のユーザーIDを保存
   - デフォルトでは記事で推奨されている「ProviderのユーザーIDで紐付け」を実装

2. **適切なデータベース設計**

   ```typescript
   export const accounts = sqliteTable("account", {
     id: text("id").primaryKey(),
     userId: text("user_id")
       .notNull()
       .references(() => users.id),
     accountId: text("account_id").notNull(), // ← Provider側のユーザーID
     providerId: text("provider_id").notNull(), // ← "google" or "github"
   });
   ```

3. **メールアドレスはユニーク制約のみ**
   - `users.email`はユニーク制約があるが、これは単一サービス内での重複防止
   - OAuth認証の紐付けキーとしては使用していない

### ⚠️ 潜在的なリスクと推奨対策

#### 1. Account Linkingの設定が不明確

**問題点**:
現在の実装では`accountLinking`の設定が明示的に行われていません。Better Authのデフォルト動作では：

- **初回OAuth認証時**: 新規ユーザーとして登録
- **Account Linking**: 明示的に有効化しない限り、自動的なアカウント統合は行われない

**リスク**:
もし将来的に`accountLinking.enabled: true`や`trustedProviders`を設定すると、記事で指摘されている問題が発生する可能性があります。

**推奨対策**:

```typescript
export function createAuth(context: AppLoadContext) {
  return betterAuth({
    // ... 既存の設定 ...

    account: {
      accountLinking: {
        // 明示的に無効化（デフォルトは無効だが、明示することで意図を明確化）
        enabled: false,
        // または、慎重に使用する場合：
        // enabled: true,
        // trustedProviders: [], // 空配列 = メールアドレスでの自動統合を行わない
        // allowDifferentEmails: false, // 異なるメールアドレスでの統合を禁止
      },
    },
  });
}
```

#### 2. メールアドレス変更時の対応

**問題点**:

- ユーザーがOAuth Provider側でメールアドレスを変更した場合の挙動が未定義
- `users.email`のユニーク制約により、他のユーザーが同じメールアドレスで新規登録できなくなる

**推奨対策**:

1. OAuth認証時にProviderから取得したメールアドレスを`users.email`に反映
2. メールアドレス変更を検知して更新する仕組みを追加

```typescript
// auth.server.tsに追加
/**
 * OAuth認証後のメールアドレス同期
 * Provider側でメールアドレスが変更された場合に対応
 */
export async function syncEmailFromProvider(
  userId: string,
  newEmail: string,
  context: AppLoadContext
) {
  const db = getDb(context.cloudflare.env.DB);

  try {
    await db
      .update(users)
      .set({
        email: newEmail,
        emailVerified: true, // OAuth Providerで検証済み
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .run();
  } catch (error) {
    console.error("メールアドレス同期エラー:", error);
  }
}
```

#### 3. Pre-hijacking攻撃への対策

**現状**:
記事では「GoogleやGitHubなら問題ない」と述べられていますが、完全に安全とは言えません。

**推奨対策**:

1. **明示的なアカウント連携フロー**

   ```typescript
   // 設定画面からの明示的な連携のみ許可
   // ログイン画面からの新規OAuth認証では既存アカウントと自動統合しない
   ```

2. **メールアドレス検証状態の確認**

   ```typescript
   // OAuth Providerから`email_verified: true`が返ってくることを確認
   // Better Authは自動的に処理するが、ログで確認することを推奨
   ```

3. **セキュリティログの実装**
   ```typescript
   // アカウント連携時のログ記録
   // - 連携日時
   // - IPアドレス
   // - ユーザーエージェント
   // - Provider側のメールアドレス
   ```

#### 4. ユーザーへの通知

**推奨実装**:

```typescript
// アカウント連携時にユーザーに通知
// - メール通知: "新しいOAuthアカウントが連携されました"
// - セキュリティログ画面: 連携履歴の表示
```

### 🔒 セキュリティチェックリスト

- [x] OAuth Provider側のユーザーIDで紐付けを管理（Better Authが実装）
- [x] メールアドレスはユニーク制約のみ（認証キーとして使用しない）
- [ ] Account Linkingの明示的な無効化または慎重な設定
- [ ] メールアドレス変更時の同期処理
- [ ] アカウント連携のセキュリティログ
- [ ] ユーザーへの通知機能

### 📝 結論

**現在の実装は基本的に安全**です。Better Authが推奨される方法（Provider IDでの紐付け）を実装しているためです。

ただし、以下の対策を追加することで、よりセキュアな実装になります：

1. **Account Linkingの明示的な設定**（最優先）
2. メールアドレス同期処理
3. セキュリティログと通知機能

これらの対策により、記事で指摘されているリスクを完全に回避できます。
