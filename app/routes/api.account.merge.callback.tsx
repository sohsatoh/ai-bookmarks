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

export async function loader({
  request: _request,
  context: _context,
}: Route.LoaderArgs) {
  // セキュリティ上の理由により一時的に無効化
  return redirect("/settings?error=この機能は現在利用できません");
}
