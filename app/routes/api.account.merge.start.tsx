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
import { requireAuth } from "~/services/auth.server";
import { generateMergeToken } from "~/services/account.server";

const ALLOWED_PROVIDERS = ["google", "github"] as const;
type Provider = (typeof ALLOWED_PROVIDERS)[number];

function isValidProvider(provider: string): provider is Provider {
  return ALLOWED_PROVIDERS.includes(provider as Provider);
}

export async function action({ request, context }: Route.ActionArgs) {
  // セキュリティ上の理由により一時的に無効化
  throw new Response("この機能は現在利用できません", { status: 403 });

}
