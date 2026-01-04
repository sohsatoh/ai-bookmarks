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
  try {
    const auth = createAuth(context);
    return await auth.handler(request);
  } catch (error) {
    console.error("認証エラー (loader):", error);
    return new Response(
      JSON.stringify({
        error: "認証処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  try {
    const auth = createAuth(context);
    return await auth.handler(request);
  } catch (error) {
    console.error("認証エラー (action):", error);
    return new Response(
      JSON.stringify({
        error: "認証処理中にエラーが発生しました",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
