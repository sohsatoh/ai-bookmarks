/**
 * アカウント連携解除API
 *
 * セキュリティ:
 * - requireAuth: セッション検証
 * - ユーザーID一致確認(IDOR対策)
 * - 最後のアカウントは削除不可(ログイン不能防止)
 */

import { redirect, data } from "react-router";
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
      return data({ error: result.error }, { status: result.error?.includes("アクセス権限") ? 403 : 400 });
    }

    return redirect("/settings");
  } catch (error) {
    console.error("アカウント連携解除エラー:", error);
    return data(
      { error: "アカウント連携の解除に失敗しました" },
      { status: 500 }
    );
  }
}

export function loader() {
  return redirect("/settings");
}
