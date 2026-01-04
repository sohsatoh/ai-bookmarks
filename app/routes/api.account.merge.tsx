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
import { requireAuth } from "~/services/auth.server";
import { getAccountDb, mergeAccount } from "~/services/account.server";

export async function action({ request, context }: Route.ActionArgs) {
  try {
    // 現在のログインユーザーを確認
    const currentSession = await requireAuth(request, context);
    const db = getAccountDb(context);

    const formData = await request.formData();
    const provider = formData.get("provider") as string;
    const accountId = formData.get("accountId") as string;

    const result = await mergeAccount(
      db,
      currentSession.user.id,
      provider,
      accountId
    );

    if (!result.success) {
      return data({ error: result.error }, { status: result.error?.includes("見つかりません") ? 404 : 400 });
    }

    return data({
      success: true,
      message: result.message,
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
