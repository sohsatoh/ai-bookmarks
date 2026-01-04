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

export async function loader({ request, context }: Route.LoaderArgs) {
  const baseUrl = context.cloudflare.env.BETTER_AUTH_URL;
  const secret = context.cloudflare.env.BETTER_AUTH_SECRET;

  // マージトークンをクエリパラメータから取得
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    // トークンがない場合は通常のログインとして扱う
    return redirect("/settings");
  }

  // トークンを検証
  const tokenPayload = await verifyMergeToken(token, secret);
  if (!tokenPayload) {
    // トークンが無効な場合、設定ページにリダイレクト
    return redirect("/settings?error=merge_token_invalid");
  }

  // 現在のセッション（OAuth認証後のセッション）を取得
  const currentSession = await getSession(request, context);
  if (!currentSession) {
    // セッションがない場合、設定ページにリダイレクト
    return redirect("/settings?error=merge_session_invalid");
  }

  const currentUserId = currentSession.user.id;
  const targetUserId = tokenPayload.userId;

  // 同じユーザーの場合（既に連携済みのアカウントでログインした場合）
  if (currentUserId === targetUserId) {
    return redirect("/settings?message=already_linked");
  }

  // マージを実行（現在のユーザーをターゲットユーザーに統合）
  const db = getAccountDb(context);
  const result = await mergeAccountSecure(db, targetUserId, currentUserId);

  if (!result.success) {
    return redirect(`/settings?error=${encodeURIComponent(result.error || "merge_failed")}`);
  }

  // マージ成功後、ターゲットユーザーとしてセッションを再作成
  // 現在のセッションを無効化
  const auth = createAuth(context);
  await auth.api.signOut({ headers: request.headers });

  // 設定ページにリダイレクト（再ログインが必要）
  return redirect("/settings?message=merge_success");
}
