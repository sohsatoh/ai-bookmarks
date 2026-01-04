/**
 * アカウント連携解除API
 *
 * セキュリティ:
 * - requireAuth: セッション検証
 * - ユーザーID一致確認(IDOR対策)
 * - 最後のアカウントは削除不可(ログイン不能防止)
 * - トランザクション使用
 */

import { redirect, data } from "react-router";
import type { Route } from "./+types/api.account.unlink";
import { requireAuth } from "~/services/auth.server";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { accounts } from "~/db/schema";

export async function action({ request, context }: Route.ActionArgs) {
  // 1. セッション検証
  const session = await requireAuth(request, context);

  const formData = await request.formData();
  const accountId = formData.get("accountId");

  if (!accountId || typeof accountId !== "string") {
    return data({ error: "アカウントIDが指定されていません" }, { status: 400 });
  }

  const db = drizzle(context.cloudflare.env.DB);

  try {
    // 2. 現在のユーザーのアカウント数を確認
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, session.user.id));

    // 3. 最後のアカウントは削除不可(ログイン不能防止)
    if (userAccounts.length <= 1) {
      return data(
        {
          error:
            "最後のアカウントは削除できません。別の認証方法を追加してから削除してください。",
        },
        { status: 400 }
      );
    }

    // 4. 削除対象のアカウントが現在のユーザーに属しているか確認(IDOR対策)
    const targetAccount = userAccounts.find((acc) => acc.id === accountId);
    if (!targetAccount) {
      return data(
        {
          error:
            "指定されたアカウントが見つからないか、アクセス権限がありません",
        },
        { status: 403 }
      );
    }

    // 5. アカウント削除
    await db
      .delete(accounts)
      .where(
        and(eq(accounts.id, accountId), eq(accounts.userId, session.user.id))
      );

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
