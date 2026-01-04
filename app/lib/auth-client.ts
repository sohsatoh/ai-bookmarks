/**
 * Better Auth クライアント
 *
 * クライアント側の認証操作（linkSocial等）に使用します。
 * 注意: サーバーサイドレンダリング時にグローバルスコープで初期化されないよう
 * 遅延初期化パターンを使用しています（Cloudflare Workers互換性）
 */

import { createAuthClient } from "better-auth/client";

let _authClient: ReturnType<typeof createAuthClient> | null = null;

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

  // 既に初期化済みの場合はキャッシュを返す
  if (_authClient) {
    return _authClient;
  }

  // 初回初期化
  _authClient = createAuthClient({
    baseURL: window.location.origin,
  });

  return _authClient;
}

/**
 * 後方互換性のため、従来の authClient エクスポートを維持
 * ただし、アクセス時に遅延初期化される Proxy を返す
 */
export const authClient = new Proxy({} as ReturnType<typeof createAuthClient>, {
  get(_target, prop) {
    const client = getAuthClient();
    const value = client[prop as keyof typeof client];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
