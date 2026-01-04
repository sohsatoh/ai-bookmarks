/**
 * Better Auth クライアント
 *
 * クライアント側の認証操作（linkSocial、passkey等）に使用します。
 * 公式Remix統合ガイドに従い、better-auth/reactを使用
 * https://www.better-auth.com/docs/integrations/remix
 */

import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";

/**
 * Better Auth クライアントインスタンス
 * グローバルスコープで初期化（Reactクライアントは安全に初期化可能）
 */
export const authClient = createAuthClient({
  // baseURLは自動的に推論されるため、指定不要
  // React Router環境で適切に動作します
  plugins: [passkeyClient()],
});
