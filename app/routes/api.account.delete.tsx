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
import { getAccountDb, deleteAccount } from "~/services/account.server";

export async function action({ request, context }: Route.ActionArgs) {
  // セッション検証
  const session = await requireAuth(request, context);

  const db = getAccountDb(context);

  try {
    // すべてのユーザーデータを削除（カスケード削除）
    await deleteAccount(db, session.user.id);

    // セッション破棄（クッキー削除）
    await signOut(request, context);

    // トップページにリダイレクト（削除成功メッセージ付き）
    return redirect(
      "/?message=" +
        encodeURIComponent("アカウントを削除しました") +
        "&type=success"
    );
  } catch (error) {
    console.error("アカウント削除エラー:", error);
    return redirect(
      "/settings?message=" +
        encodeURIComponent("アカウント削除に失敗しました") +
        "&type=error"
    );
  }
}

export function loader() {
  return redirect("/settings");
}
