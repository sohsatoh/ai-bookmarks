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
  // セッション検証
  const session = await requireAuth(request, context);

  // プロバイダーを取得
  const formData = await request.formData();
  const provider = formData.get("provider") as string;

  if (!provider || !isValidProvider(provider)) {
    throw new Response("無効なプロバイダーです", { status: 400 });
  }

  // マージトークンを生成
  const secret = context.cloudflare.env.BETTER_AUTH_SECRET;
  const token = await generateMergeToken(session.user.id, provider, secret);

  // OAuthログインURLを構築
  const baseUrl = context.cloudflare.env.BETTER_AUTH_URL;
  // マージトークンをクエリパラメータに含めたcallbackURL
  const callbackUrl = `${baseUrl}/api/account/merge/callback?token=${encodeURIComponent(token)}`;
  const oauthUrl = `${baseUrl}/api/auth/sign-in/social`;

  // fetchでPOSTリクエストを送信するHTMLを返す
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>アカウント統合中...</title>
</head>
<body>
  <p>認証ページにリダイレクトしています...</p>
  <script>
    (async () => {
      try {
        const response = await fetch("${oauthUrl}", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "${provider}",
            callbackURL: "${callbackUrl}"
          }),
        });

        if (!response.ok) {
          throw new Error("認証リクエストに失敗しました");
        }

        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("リダイレクトURLが取得できませんでした");
        }
      } catch (error) {
        console.error("エラー:", error);
        alert("認証に失敗しました。もう一度お試しください。");
        window.location.href = "/settings";
      }
    })();
  </script>
</body>
</html>
  `;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
    },
  });
}
