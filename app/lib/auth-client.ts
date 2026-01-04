/**
 * Better Auth クライアント
 *
 * クライアント側の認証操作（linkSocial等）に使用します。
 */

import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});
