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

import { redirect } from "react-router";
import type { Route } from "./+types/api.account.merge.start";
import { requireAuth } from "~/services/auth.server";
import { generateMergeToken } from "~/services/account.server";

const ALLOWED_PROVIDERS = ["google", "github"] as const;
type Provider = (typeof ALLOWED_PROVIDERS)[number];

function isValidProvider(provider: string): provider is Provider {
  return ALLOWED_PROVIDERS.includes(provider as Provider);
}

export async function loader({ request, context }: Route.LoaderArgs) {
  // セッション検証
  const session = await requireAuth(request, context);

  // プロバイダーを取得
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  if (!provider || !isValidProvider(provider)) {
    throw new Response("無効なプロバイダーです", { status: 400 });
  }

  // マージトークンを生成
  const secret = context.cloudflare.env.BETTER_AUTH_SECRET;
  const token = await generateMergeToken(session.user.id, provider, secret);

  // OAuthログインURLを構築
  const baseUrl = context.cloudflare.env.BETTER_AUTH_URL;
  const callbackUrl = `${baseUrl}/api/account/merge/callback`;
  const oauthUrl = `${baseUrl}/api/auth/signin/${provider}?callbackURL=${encodeURIComponent(callbackUrl)}`;

  // マージトークンをクッキーに設定してOAuthにリダイレクト
  return redirect(oauthUrl, {
    headers: {
      "Set-Cookie": `merge_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300${
        baseUrl.startsWith("https://") ? "; Secure" : ""
      }`,
    },
  });
}
