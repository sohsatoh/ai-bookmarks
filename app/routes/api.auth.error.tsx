/**
 * アカウント連携エラーページ
 *
 * OAuth認証エラー時にユーザーに適切な選択肢を提示します。
 * - account_already_linked_to_different_user: アカウントマージを提案
 */

import { useSearchParams, data, redirect } from "react-router";
import type { Route } from "./+types/api.auth.error";
import { getSession } from "~/services/auth.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await getSession(request, context);
  if (!session) {
    // ログインしていない場合はログインページへ
    return redirect("/login");
  }
  return data({ user: session.user });
}

export default function AuthError() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  // アカウント連携エラーの場合
  if (error === "account_already_linked_to_different_user") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 px-4">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-2xl">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              アカウント連携エラー
            </h1>
            <p className="text-gray-600">
              このソーシャルアカウントは既に別のユーザーに紐づいています
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h2 className="font-semibold text-yellow-900 mb-2">
                考えられる原因：
              </h2>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>
                  過去に別のメールアドレスで同じソーシャルアカウントを使用した
                </li>
                <li>複数のアカウントを作成してしまった</li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="font-semibold text-blue-900 mb-2">解決方法：</h2>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li>
                  古いアカウントにログインし、設定ページからソーシャルアカウントの連携を解除
                </li>
                <li>このアカウントに戻って再度連携を試す</li>
              </ol>
            </div>

            <div className="space-y-2">
              <a
                href="/settings"
                className="block w-full px-4 py-3 text-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                設定ページに戻る
              </a>
              <a
                href="/login"
                className="block w-full px-4 py-3 text-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ログアウトして別アカウントでログイン
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // その他のエラー
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">認証エラー</h1>
          <p className="text-gray-600">認証中にエラーが発生しました</p>
          {error && (
            <p className="text-sm text-red-600 mt-2">エラーコード: {error}</p>
          )}
        </div>

        <div className="space-y-2">
          <a
            href="/login"
            className="block w-full px-4 py-3 text-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            ログインページに戻る
          </a>
        </div>
      </div>
    </div>
  );
}
