/**
 * アカウントマージ開始API
 *
 * OAuth再認証フローを開始し、認証後にアカウントをマージします。
 * セキュリティ:
 * - セッション検証（requireAuth）
 * - 署名付きマージトークン（HMAC-SHA256）
 * - 有効期限付きクッキー（5分）
 * - httpOnly、secure、SameSite=Lax
 */

import type { Route } from "./+types/api.account.merge.start";

export async function action({ request: _request, context: _context }: Route.ActionArgs) {
  // セキュリティ上の理由により一時的に無効化
  throw new Response("この機能は現在利用できません", { status: 403 });
}
