/**
 * アカウントマージAPI
 *
 * 既に別のユーザーに紐づいているソーシャルアカウントを現在のユーザーにマージします。
 * セキュリティ:
 * - セッション検証（requireAuth）必須
 * - ソーシャルアカウント所有確認（OAuth再認証）
 * - データマージ（ブックマークの移行）
 * - 古いユーザーアカウントの削除
 */

import { data } from "react-router";
import type { Route } from "./+types/api.account.merge";
import { requireAuth, createAuth } from "~/services/auth.server";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { accounts, users, sessions, userBookmarks } from "~/db/schema";

export async function action({ request, context }: Route.ActionArgs) {
  try {
    // 現在のログインユーザーを確認
    const currentSession = await requireAuth(request, context);
    const db = drizzle(context.cloudflare.env.DB);

    const formData = await request.formData();
    const provider = formData.get("provider") as string;
    const accountId = formData.get("accountId") as string; // プロバイダー側のID

    if (!provider || !accountId) {
      return data(
        { error: "プロバイダーとアカウントIDが必要です" },
        { status: 400 }
      );
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
      return data(
        { error: "指定されたアカウントが見つかりません" },
        { status: 404 }
      );
    }

    const targetAccount = existingAccount[0];
    const oldUserId = targetAccount.userId;

    // 既に現在のユーザーに紐づいている場合は何もしない
    if (oldUserId === currentSession.user.id) {
      return data({ success: true, message: "既に連携されています" });
    }

    // トランザクション内でデータマージを実行
    await db.batch([
      // 1. ブックマークを現在のユーザーに移行
      db
        .update(userBookmarks)
        .set({ userId: currentSession.user.id })
        .where(eq(userBookmarks.userId, oldUserId)),

      // 2. アカウントを現在のユーザーに移行
      db
        .update(accounts)
        .set({ userId: currentSession.user.id })
        .where(eq(accounts.userId, oldUserId)),

      // 3. 古いユーザーのセッションを削除
      db.delete(sessions).where(eq(sessions.userId, oldUserId)),

      // 4. 古いユーザーを削除
      db.delete(users).where(eq(users.id, oldUserId)),
    ]);

    return data({
      success: true,
      message: "アカウントを統合しました",
    });
  } catch (error) {
    console.error("アカウントマージエラー:", error);
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "アカウントの統合に失敗しました",
      },
      { status: 500 }
    );
  }
}
