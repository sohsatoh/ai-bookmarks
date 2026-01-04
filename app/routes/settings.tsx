/**
 * アカウント設定ページ
 *
 * 機能:
 * - 連携済みアカウント一覧表示
 * - 新規アカウント連携(OAuth)
 * - アカウント連携解除
 * - アカウント完全削除
 *
 * セキュリティ:
 * - セッション検証(requireAuth)
 * - ユーザーID一致確認(IDOR対策)
 * - 最後の認証方法は削除不可(ログイン不能防止)
 * - アカウント削除時の確認ダイアログ
 */

import { useLoaderData, useFetcher, data } from "react-router";
import type { Route } from "./+types/settings";
import { requireAuth } from "~/services/auth.server";
import { getAccountDb, getUserAccounts } from "~/services/account.server";
import { useState } from "react";
import { authClient } from "~/lib/auth-client";

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await requireAuth(request, context);
  const db = getAccountDb(context);

  // 現在のユーザーに紐づくアカウント一覧を取得（認可制御）
  const userAccounts = await getUserAccounts(db, session.user.id);

  return data({
    user: {
      email: session.user.email,
    },
    accounts: userAccounts.map((acc) => ({
      id: acc.id,
      providerId: acc.providerId,
      accountId: acc.accountId,
      createdAt: acc.createdAt,
    })),
  });
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
};

const PROVIDER_ICONS: Record<string, string> = {
  google: "🔵",
  github: "🐙",
};

export default function Settings() {
  const { user, accounts: userAccounts } = useLoaderData<typeof loader>();
  const unlinkFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const linkedProviders = new Set(userAccounts.map((acc) => acc.providerId));
  const availableProviders = ["google", "github"].filter(
    (p) => !linkedProviders.has(p)
  );

  // 最後のアカウントかどうかを確認
  const isLastAccount = userAccounts.length === 1;

  // アカウント連携処理（linkSocial使用）
  const handleAccountLink = async (provider: "google" | "github") => {
    try {
      // Better Authの linkSocial を使用して既存ユーザーに新しいアカウントを紐づける
      await authClient.linkSocial({
        provider,
        callbackURL: "/settings",
      });
    } catch (error) {
      console.error("連携エラー:", error);
      alert("アカウント連携に失敗しました。もう一度お試しください。");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <a
          href="/home"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span>ホームに戻る</span>
        </a>
        <h1 className="text-3xl font-bold flex-1">アカウント設定</h1>
      </div>

      {/* ユーザー情報 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">ユーザー情報</h2>
        <div className="space-y-2">
          <div>
            <span className="text-gray-600">メール:</span>{" "}
            <span className="font-medium">{user.email}</span>
          </div>
        </div>
      </div>

      {/* 連携済みアカウント */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">連携済みアカウント</h2>
        {userAccounts.length === 0 ? (
          <p className="text-gray-600">連携済みアカウントがありません。</p>
        ) : (
          <div className="space-y-3">
            {userAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {PROVIDER_ICONS[account.providerId] || "🔗"}
                  </span>
                  <div>
                    <div className="font-medium">
                      {PROVIDER_LABELS[account.providerId] ||
                        account.providerId}
                    </div>
                    <div className="text-sm text-gray-600">
                      ID: {account.accountId}
                    </div>
                  </div>
                </div>
                <unlinkFetcher.Form method="post" action="/api/account/unlink">
                  <input type="hidden" name="accountId" value={account.id} />
                  <button
                    type="submit"
                    disabled={
                      isLastAccount || unlinkFetcher.state === "submitting"
                    }
                    className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      isLastAccount
                        ? "最後のアカウントは削除できません"
                        : "連携を解除"
                    }
                  >
                    {unlinkFetcher.state === "submitting"
                      ? "解除中..."
                      : "連携解除"}
                  </button>
                </unlinkFetcher.Form>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新規アカウント連携 */}
      {availableProviders.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">新規アカウント連携</h2>
          <div className="space-y-3">
            {availableProviders.map((provider) => (
              <button
                key={provider}
                onClick={() =>
                  handleAccountLink(provider as "google" | "github")
                }
                type="button"
                className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-2xl">
                  {PROVIDER_ICONS[provider] || "🔗"}
                </span>
                <div>
                  <div className="font-medium">
                    {PROVIDER_LABELS[provider] || provider}で連携
                  </div>
                  <div className="text-sm text-gray-600">
                    {PROVIDER_LABELS[provider] || provider}
                    アカウントと連携します
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* アカウント削除 */}
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-900 mb-4">危険な操作</h2>
        <p className="text-red-800 mb-4">
          アカウントを削除すると、すべてのブックマーク、カテゴリ、設定が完全に削除されます。この操作は取り消せません。
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            アカウントを削除
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-red-900 mb-2">
                確認のため「削除する」と入力してください
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-red-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="削除する"
              />
            </div>
            <div className="flex gap-3">
              <deleteFetcher.Form method="post" action="/api/account/delete">
                <button
                  type="submit"
                  disabled={
                    deleteConfirmText !== "削除する" ||
                    deleteFetcher.state === "submitting"
                  }
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteFetcher.state === "submitting"
                    ? "削除中..."
                    : "完全に削除"}
                </button>
              </deleteFetcher.Form>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
