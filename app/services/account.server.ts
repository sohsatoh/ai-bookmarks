/**
 * アカウント管理サービス
 *
 * セキュリティ機能:
 * - ユーザー認証（requireAuth）
 * - IDOR対策（ユーザーID一致確認）
 * - 入力検証
 * - トランザクション管理
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { users, accounts, sessions, userBookmarks } from "~/db/schema";
import type { AppLoadContext } from "react-router";

/**
 * データベースインスタンスを取得
 */
export function getAccountDb(context: AppLoadContext) {
  return drizzle(context.cloudflare.env.DB);
}

/**
 * ユーザーの連携アカウント一覧を取得
 */
export async function getUserAccounts(
  db: ReturnType<typeof getAccountDb>,
  userId: string
) {
  return await db.select().from(accounts).where(eq(accounts.userId, userId));
}

/**
 * アカウント連携解除
 *
 * @throws {Error} バリデーションエラーまたは権限エラー
 */
export async function unlinkAccount(
  db: ReturnType<typeof getAccountDb>,
  userId: string,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  // バリデーション: accountIdの型チェック
  if (!accountId || typeof accountId !== "string") {
    return { success: false, error: "アカウントIDが指定されていません" };
  }

  // ユーザーのアカウント一覧を取得
  const userAccounts = await getUserAccounts(db, userId);

  // 最後のアカウントは削除不可（ログイン不能防止）
  if (userAccounts.length <= 1) {
    return {
      success: false,
      error:
        "最後のアカウントは削除できません。別の認証方法を追加してから削除してください。",
    };
  }

  // IDOR対策: 削除対象のアカウントが現在のユーザーに属しているか確認
  const targetAccount = userAccounts.find((acc) => acc.id === accountId);
  if (!targetAccount) {
    return {
      success: false,
      error: "指定されたアカウントが見つからないか、アクセス権限がありません",
    };
  }

  // アカウント削除（WHERE句でユーザーID一致も確認）
  await db
    .delete(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  return { success: true };
}

/**
 * アカウント完全削除（カスケード削除）
 *
 * すべてのユーザーデータを削除します：
 * - ブックマーク
 * - アカウント連携
 * - セッション
 * - ユーザー情報
 */
export async function deleteAccount(
  db: ReturnType<typeof getAccountDb>,
  userId: string
): Promise<void> {
  // カスケード削除を明示的に実行
  // schema.tsでonDelete: "cascade"が設定されているが、確実性のため明示的に削除

  // 1. ユーザーブックマーク削除（ユーザーID一致確認）
  await db.delete(userBookmarks).where(eq(userBookmarks.userId, userId));

  // 2. アカウント削除（ユーザーID一致確認）
  await db.delete(accounts).where(eq(accounts.userId, userId));

  // 3. セッション削除（ユーザーID一致確認）
  await db.delete(sessions).where(eq(sessions.userId, userId));

  // 4. ユーザー削除（本人確認）
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * アカウントマージ
 *
 * 既存のソーシャルアカウントを現在のユーザーに統合します
 */
export async function mergeAccount(
  db: ReturnType<typeof getAccountDb>,
  currentUserId: string,
  provider: string,
  accountId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  // バリデーション
  if (!provider || !accountId) {
    return { success: false, error: "プロバイダーとアカウントIDが必要です" };
  }

  // 該当のソーシャルアカウントを検索
  const existingAccount = await db
    .select()
    .from(accounts)
    .where(
      and(eq(accounts.providerId, provider), eq(accounts.accountId, accountId))
    )
    .limit(1);

  if (existingAccount.length === 0) {
    return { success: false, error: "指定されたアカウントが見つかりません" };
  }

  const targetAccount = existingAccount[0];
  const oldUserId = targetAccount.userId;

  // 既に現在のユーザーに紐づいている場合
  if (oldUserId === currentUserId) {
    return { success: true, message: "既に連携されています" };
  }

  // トランザクション内でデータマージを実行
  await db.batch([
    // 1. ブックマークを現在のユーザーに移行
    db
      .update(userBookmarks)
      .set({ userId: currentUserId })
      .where(eq(userBookmarks.userId, oldUserId)),

    // 2. アカウントを現在のユーザーに移行
    db
      .update(accounts)
      .set({ userId: currentUserId })
      .where(eq(accounts.userId, oldUserId)),

    // 3. 古いユーザーのセッションを削除
    db.delete(sessions).where(eq(sessions.userId, oldUserId)),

    // 4. 古いユーザーを削除
    db.delete(users).where(eq(users.id, oldUserId)),
  ]);

  return { success: true, message: "アカウントを統合しました" };
}
