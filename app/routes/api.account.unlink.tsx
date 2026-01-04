/**
 * アカウント連携解除API
 *
 * セキュリティ:
 * - requireAuth: セッション検証
 * - ユーザーID一致確認(IDOR対策)
 * - 最後のアカウントは削除不可(ログイン不能防止)
 */

import { redirect } from "react-router";
import type { Route } from "./+types/api.account.unlink";
import { requireAuth } from "~/services/auth.server";
import { getAccountDb, unlinkAccount } from "~/services/account.server";

export async function action({ request, context }: Route.ActionArgs) {
  // セッション検証
  const session = await requireAuth(request, context);

  const formData = await request.formData();
  const accountId = formData.get("accountId") as string;

  const db = getAccountDb(context);

  try {
    const result = await unlinkAccount(db, session.user.id, accountId);

    if (!result.success) {
      return redirect(
        `/settings?message=${encodeURIComponent(result.error || "エラーが発生しました")}&type=error`
      );
    }

    return redirect(
      "/settings?message=" +
        encodeURIComponent("アカウント連携を解除しました") +
        "&type=success"
    );
  } catch (error) {
    console.error("アカウント連携解除エラー:", error);
    return redirect(
      "/settings?message=" +
        encodeURIComponent("アカウント連携の解除に失敗しました") +
        "&type=error"
    );
  }
}

export function loader() {
  return redirect("/settings");
}
