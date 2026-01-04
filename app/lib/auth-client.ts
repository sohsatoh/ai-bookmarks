/**
 * Better Auth クライアント
 *
 * クライアント側の認証操作（linkSocial等）に使用します。
 * 注意: サーバーサイドレンダリング時にグローバルスコープで初期化されないよう
 * 遅延初期化パターンを使用しています（Cloudflare Workers互換性）
 */

import { createAuthClient } from "better-auth/client";

/**
 * Better Auth クライアントインスタンスを取得
 * 初回アクセス時に初期化され、以降はキャッシュされたインスタンスを返します
 *
 * @returns Better Auth クライアント
 * @throws クライアントサイド以外で呼び出された場合はエラー
 */
export function getAuthClient() {
  // クライアントサイドでのみ初期化
  if (typeof window === "undefined") {
    throw new Error(
      "authClient はクライアントサイドでのみ使用できます。サーバーサイドでは使用しないでください。"
    );
  }

  return createAuthClient({
    baseURL: window.location.origin,
  });
}

/**
 * デフォルトエクスポート: getAuthClient()を呼び出して使用
 * 例: const client = getAuthClient(); await client.linkSocial({ ... });
 */
export const authClient = {
  linkSocial: async (options: { provider: string; callbackURL?: string }) => {
    const client = getAuthClient();
    return await client.linkSocial(options);
  },
};
