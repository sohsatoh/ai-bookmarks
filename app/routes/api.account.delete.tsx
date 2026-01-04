/**
 * アカウント完全削除API
 *
 * セキュリティ:
 * - requireAuth: セッション検証
 * - ユーザーID一致確認(IDOR対策)
 * - カスケード削除(schema.tsで定義済み)
 * - セッション破棄
 */

import { redirect } from "react-router";
import type { Route } from "./+types/api.account.delete";
import { requireAuth, signOut } from "~/services/auth.server";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users, accounts, sessions, bookmarks, categories } from "~/db/schema";

export async function action({ request, context }: Route.ActionArgs) {
  // 1. セッション検証
  const session = await requireAuth(request, context);

  const db = drizzle(context.cloudflare.env.DB);

  try {
    // 2. ユーザーに紐づくすべてのデータを削除(カスケード削除)
    // schema.tsでonDelete: "cascade"が設定されているため、
    // usersを削除すると自動的に関連データも削除される
    // しかし、明示的に削除することで確実性を高める

    // ブックマーク削除(ユーザーID一致確認)
    await db.delete(bookmarks).where(eq(bookmarks.userId, session.user.id));

    // カテゴリ削除(ユーザーID一致確認)
    await db.delete(categories).where(eq(categories.userId, session.user.id));

    // アカウント削除(ユーザーID一致確認)
    await db.delete(accounts).where(eq(accounts.userId, session.user.id));

    // セッション削除(ユーザーID一致確認)
    await db.delete(sessions).where(eq(sessions.userId, session.user.id));

    // ユーザー削除(本人確認)
    await db.delete(users).where(eq(users.id, session.user.id));

    // 3. セッション破棄(クッキー削除)
    await signOut(request, context);

    // 4. ログインページにリダイレクト
    return redirect("/login");
  } catch (error) {
    console.error("アカウント削除エラー:", error);
    return redirect("/settings?error=delete_failed");
  }
}

export function loader() {
  return redirect("/settings");
}
