/**
 * アカウントマージコールバックAPI
 *
 * OAuth認証後に呼び出され、認証されたアカウントをマージします。
 * セキュリティ:
 * - マージトークンの署名検証（HMAC-SHA256）
 * - 有効期限検証（5分以内）
 * - プロバイダー一致検証
 * - セッション検証
 * - トークンの無効化（クッキー削除）
 */

import { redirect } from "react-router";
import type { Route } from "./+types/api.account.merge.callback";
import { getSession, createAuth } from "~/services/auth.server";
import {
  verifyMergeToken,
  getAccountDb,
  mergeAccountSecure,
} from "~/services/account.server";

/**
 * クッキーからマージトークンを取得
 */
function getMergeTokenFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === "merge_token") {
      return value;
    }
  }
  return null;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const baseUrl = context.cloudflare.env.BETTER_AUTH_URL;
  const secret = context.cloudflare.env.BETTER_AUTH_SECRET;

  // マージトークンをクッキーから取得
  const token = getMergeTokenFromCookie(request);
  if (!token) {
    // トークンがない場合は通常のログインとして扱う
    return redirect("/settings");
  }

  // トークンを検証
  const tokenPayload = await verifyMergeToken(token, secret);
  if (!tokenPayload) {
    // トークンが無効な場合、クッキーを削除して設定ページにリダイレクト
    return redirect("/settings?error=merge_token_invalid", {
      headers: {
        "Set-Cookie": `merge_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
          baseUrl.startsWith("https://") ? "; Secure" : ""
        }`,
      },
    });
  }

  // 現在のセッション（OAuth認証後のセッション）を取得
  const currentSession = await getSession(request, context);
  if (!currentSession) {
    // セッションがない場合、クッキーを削除して設定ページにリダイレクト
    return redirect("/settings?error=merge_session_invalid", {
      headers: {
        "Set-Cookie": `merge_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
          baseUrl.startsWith("https://") ? "; Secure" : ""
        }`,
      },
    });
  }

  const currentUserId = currentSession.user.id;
  const targetUserId = tokenPayload.userId;

  // 同じユーザーの場合（既に連携済みのアカウントでログインした場合）
  if (currentUserId === targetUserId) {
    return redirect("/settings?message=already_linked", {
      headers: {
        "Set-Cookie": `merge_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
          baseUrl.startsWith("https://") ? "; Secure" : ""
        }`,
      },
    });
  }

  // マージを実行（現在のユーザーをターゲットユーザーに統合）
  const db = getAccountDb(context);
  const result = await mergeAccountSecure(db, targetUserId, currentUserId);

  if (!result.success) {
    return redirect(`/settings?error=${encodeURIComponent(result.error || "merge_failed")}`, {
      headers: {
        "Set-Cookie": `merge_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
          baseUrl.startsWith("https://") ? "; Secure" : ""
        }`,
      },
    });
  }

  // マージ成功後、ターゲットユーザーとしてセッションを再作成
  // 現在のセッションを無効化
  const auth = createAuth(context);
  await auth.api.signOut({ headers: request.headers });

  // 設定ページにリダイレクト（再ログインが必要）
  return redirect("/settings?message=merge_success", {
    headers: {
      "Set-Cookie": `merge_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
        baseUrl.startsWith("https://") ? "; Secure" : ""
      }`,
    },
  });
}
