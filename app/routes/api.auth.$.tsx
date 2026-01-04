/**
 * Better Auth APIルート
 *
 * すべての認証エンドポイントを処理します:
 * - OAuth認証（Google、GitHub）
 * - セッション管理
 * - ログアウト
 *
 * パス: /api/auth/*
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { createAuth } from "~/services/auth.server";

/**
 * Better AuthのすべてのHTTPメソッドを処理
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const auth = createAuth(context);
  return auth.handler(request);
}

export async function action({ request, context }: ActionFunctionArgs) {
  const auth = createAuth(context);
  return auth.handler(request);
}
