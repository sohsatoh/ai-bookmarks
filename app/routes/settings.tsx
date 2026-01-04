/**
 * アカウント設定ページ
 *
 * 機能:
 * - 連携済みアカウント一覧表示
 * - 新規アカウント連携(OAuth)
 * - アカウント連携解除
 * - パスキー登録・管理
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
import { useState, useEffect } from "react";
import { authClient } from "~/lib/auth-client";
import { ToastContainer, type ToastMessage } from "~/components/Toast";
import type { Passkey } from "~/types/better-auth";
import { generatePasskeyDisplayName } from "~/utils/passkey-utils";
import {
  validatePasskeyName,
  sanitizePasskeyName,
} from "~/utils/passkey-security";
/**
 * base64url変換関数（WebAuthn Signal API用）
 * base64url形式: +と/を-と_に変換し、末尾の=を削除
 */
const toBase64Url = (str: string): string => {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "設定 - AI Bookmarks" },
    { name: "description", content: "アカウント設定を管理します。" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await requireAuth(request, context);
  const db = getAccountDb(context);

  // 現在のユーザーに紐づくアカウント一覧を取得（認可制御）
  const userAccounts = await getUserAccounts(db, session.user.id);

  // URLパラメータからメッセージを取得
  const url = new URL(request.url);
  const messageParam = url.searchParams.get("message");
  const errorParam = url.searchParams.get("error");

  // マージ結果やエラーメッセージを処理
  let message: string | null = null;
  let messageType: "success" | "error" | null = null;

  if (messageParam) {
    messageType = "success";
    switch (messageParam) {
      case "merge_success":
        message = "アカウントを統合しました。再ログインしてください。";
        break;
      case "already_linked":
        message = "既に連携されているアカウントです。";
        break;
      default:
        message = messageParam;
    }
  } else if (errorParam) {
    messageType = "error";
    switch (errorParam) {
      case "merge_token_invalid":
        message =
          "マージトークンが無効または期限切れです。もう一度お試しください。";
        break;
      case "merge_session_invalid":
        message = "セッションが無効です。再度ログインしてください。";
        break;
      case "merge_failed":
        message = "アカウントの統合に失敗しました。";
        break;
      default:
        message = errorParam;
    }
  } else {
    const typeParam = url.searchParams.get("type") as
      | "success"
      | "error"
      | null;
    message = url.searchParams.get("message");
    messageType = typeParam;
  }

  return data({
    user: {
      email: session.user.email,
    },
    accounts: userAccounts.map((acc) => ({
      id: acc.id,
      providerId: acc.providerId,
      createdAt: acc.createdAt,
    })),
    message: message || null,
    messageType: messageType || null,
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
  const {
    user,
    accounts: userAccounts,
    message,
    messageType,
  } = useLoaderData<typeof loader>();
  const unlinkFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(true);
  const [newPasskeyName, setNewPasskeyName] = useState("");
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
  const [editingPasskeyName, setEditingPasskeyName] = useState("");

  // パスキー一覧を取得
  useEffect(() => {
    const loadPasskeys = async () => {
      try {
        setIsLoadingPasskeys(true);
        const { data, error } = await authClient.passkey.listUserPasskeys();

        if (error) {
          console.error("パスキー取得エラー:", error);
          return;
        }

        if (data) {
          // パスキー名が未設定の場合、AAGUIDから自動生成
          const passkeyList = data as unknown as Passkey[];
          const existingNames = passkeyList
            .map((pk) => pk.name)
            .filter((name): name is string => !!name);

          const passkeyWithNames = passkeyList.map((pk) => ({
            ...pk,
            name:
              pk.name ||
              generatePasskeyDisplayName(
                {
                  aaguid: pk.aaguid,
                  deviceType: pk.deviceType,
                  name: pk.name,
                },
                existingNames
              ),
          }));

          setPasskeys(passkeyWithNames);

          // 名前が自動生成されたパスキーをデータベースに保存
          for (const pk of passkeyWithNames) {
            const originalPasskey = passkeyList.find(
              (orig) => orig.id === pk.id
            );
            if (!originalPasskey?.name && pk.name) {
              try {
                await authClient.passkey.updatePasskey({
                  id: pk.id,
                  name: pk.name,
                });
              } catch (updateError) {
                console.error("パスキー名の自動更新エラー:", updateError);
              }
            }
          }

          // Signal API: 有効なパスキーのリストをプロバイダーに通知
          if (
            typeof window !== "undefined" &&
            window.PublicKeyCredential &&
            "signalAllAcceptedCredentials" in window.PublicKeyCredential
          ) {
            try {
              const credentialIds = (data as unknown as Passkey[]).map(
                (pk) => pk.credentialID
              );
              await (
                window.PublicKeyCredential as any
              ).signalAllAcceptedCredentials({
                rpId: window.location.hostname,
                userId: toBase64Url(user.email),
                allAcceptedCredentialIds: credentialIds,
              });
            } catch (signalError) {
              console.error("Signal API エラー:", signalError);
            }
          }
        }
      } catch (error) {
        console.error("パスキー取得エラー:", error);
      } finally {
        setIsLoadingPasskeys(false);
      }
    };

    void loadPasskeys();
  }, [user.email]);

  // パスキーを追加
  const handleAddPasskey = async () => {
    try {
      setIsAddingPasskey(true);

      // 入力検証
      if (newPasskeyName) {
        const validation = validatePasskeyName(newPasskeyName);
        if (!validation.isValid) {
          setToasts((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              type: "error",
              title: "入力エラー",
              message: validation.error || "無効な入力です",
            },
          ]);
          setIsAddingPasskey(false);
          return;
        }
      }

      // パスキーを追加（名前はサニタイズして設定）
      const sanitizedName = newPasskeyName
        ? sanitizePasskeyName(newPasskeyName)
        : undefined;
      const { data, error } = await authClient.passkey.addPasskey({
        name: sanitizedName,
      });

      if (error) {
        console.error("パスキー登録エラー:", error);
        setToasts((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "error",
            title: "エラー",
            message: "パスキーの登録に失敗しました",
          },
        ]);
        return;
      }

      if (data) {
        // 登録成功
        setToasts((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "success",
            title: "成功",
            message: "パスキーを登録しました",
          },
        ]);
        setNewPasskeyName("");

        // リストを再取得
        const { data: updatedData } =
          await authClient.passkey.listUserPasskeys();
        if (updatedData) {
          // パスキー名が未設定の場合、AAGUIDから自動生成
          const passkeyList = updatedData as unknown as Passkey[];
          const existingNames = passkeyList
            .map((pk) => pk.name)
            .filter((name): name is string => !!name);

          const passkeyWithNames = passkeyList.map((pk) => ({
            ...pk,
            name:
              pk.name ||
              generatePasskeyDisplayName(
                {
                  aaguid: pk.aaguid,
                  deviceType: pk.deviceType,
                  name: pk.name,
                },
                existingNames
              ),
          }));

          setPasskeys(passkeyWithNames);

          // 名前が自動生成されたパスキーをデータベースに保存
          for (const pk of passkeyWithNames) {
            const originalPasskey = passkeyList.find(
              (orig) => orig.id === pk.id
            );
            if (!originalPasskey?.name && pk.name) {
              try {
                await authClient.passkey.updatePasskey({
                  id: pk.id,
                  name: pk.name,
                });
              } catch (updateError) {
                console.error("パスキー名の自動更新エラー:", updateError);
              }
            }
          }

          // Signal API: パスキー追加後にプロバイダーに通知
          if (
            typeof window !== "undefined" &&
            window.PublicKeyCredential &&
            "signalAllAcceptedCredentials" in window.PublicKeyCredential
          ) {
            try {
              const credentialIds = (updatedData as unknown as Passkey[]).map(
                (pk) => pk.credentialID
              );
              await (
                window.PublicKeyCredential as any
              ).signalAllAcceptedCredentials({
                rpId: window.location.hostname,
                userId: toBase64Url(user.email),
                allAcceptedCredentialIds: credentialIds,
              });

              // Signal API: ユーザー情報もプロバイダーに通知
              if ("signalCurrentUserDetails" in window.PublicKeyCredential) {
                await (
                  window.PublicKeyCredential as any
                ).signalCurrentUserDetails({
                  rpId: window.location.hostname,
                  userId: toBase64Url(user.email),
                  name: user.email,
                  displayName: user.email,
                });
              }
            } catch (signalError) {
              console.error("Signal API エラー:", signalError);
            }
          }
        }
      }
    } catch (error) {
      console.error("パスキー登録エラー:", error);
      setToasts((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "error",
          title: "エラー",
          message: "パスキーの登録に失敗しました",
        },
      ]);
    } finally {
      setIsAddingPasskey(false);
    }
  };

  // パスキーを削除
  const handleDeletePasskey = async (id: string) => {
    // 最後の認証方法チェック（セキュリティ: ログイン不能防止）
    const remainingPasskeys = passkeys.filter((pk) => pk.id !== id);
    if (remainingPasskeys.length === 0 && userAccounts.length === 0) {
      setToasts((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "error",
          title: "エラー",
          message:
            "最後のパスキーは削除できません。他の認証方法（GoogleまたはGitHub）を追加してから削除してください。",
        },
      ]);
      return;
    }

    if (!confirm("このパスキーを削除しますか？")) {
      return;
    }

    try {
      const { error } = await authClient.passkey.deletePasskey({ id });

      if (error) {
        console.error("パスキー削除エラー:", error);
        setToasts((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "error",
            title: "エラー",
            message: "パスキーの削除に失敗しました",
          },
        ]);
        return;
      }

      // 削除成功
      setToasts((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "success",
          title: "成功",
          message: "パスキーを削除しました",
        },
      ]);

      // リストから削除
      const updatedPasskeys = passkeys.filter((pk) => pk.id !== id);
      setPasskeys(updatedPasskeys);

      // Signal API: 更新された有効なパスキーのリストをプロバイダーに通知
      if (
        typeof window !== "undefined" &&
        window.PublicKeyCredential &&
        "signalAllAcceptedCredentials" in window.PublicKeyCredential
      ) {
        try {
          const credentialIds = updatedPasskeys.map((pk) => pk.credentialID);
          await (
            window.PublicKeyCredential as any
          ).signalAllAcceptedCredentials({
            rpId: window.location.hostname,
            userId: toBase64Url(user.email),
            allAcceptedCredentialIds: credentialIds,
          });
        } catch (signalError) {
          console.error("Signal API エラー:", signalError);
        }
      }
    } catch (error) {
      console.error("パスキー削除エラー:", error);
      setToasts((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "error",
          title: "エラー",
          message: "パスキーの削除に失敗しました",
        },
      ]);
    }
  };

  // パスキー名を更新
  const handleUpdatePasskeyName = async (id: string) => {
    try {
      // 入力検証
      const validation = validatePasskeyName(editingPasskeyName);
      if (!validation.isValid) {
        setToasts((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "error",
            title: "入力エラー",
            message: validation.error || "無効な入力です",
          },
        ]);
        return;
      }

      // サニタイズして更新
      const sanitizedName = sanitizePasskeyName(editingPasskeyName);
      const { error } = await authClient.passkey.updatePasskey({
        id,
        name: sanitizedName,
      });

      if (error) {
        console.error("パスキー名更新エラー:", error);
        setToasts((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "error",
            title: "エラー",
            message: "パスキー名の更新に失敗しました",
          },
        ]);
        return;
      }

      // 更新成功
      setToasts((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "success",
          title: "成功",
          message: "パスキー名を更新しました",
        },
      ]);

      // リストを更新
      setPasskeys((prev) =>
        prev.map((pk) =>
          pk.id === id ? { ...pk, name: editingPasskeyName } : pk
        )
      );
      setEditingPasskeyId(null);
      setEditingPasskeyName("");
    } catch (error) {
      console.error("パスキー名更新エラー:", error);
      setToasts((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "error",
          title: "エラー",
          message: "パスキー名の更新に失敗しました",
        },
      ]);
    }
  };

  // loaderからのメッセージを表示
  useEffect(() => {
    if (message && messageType) {
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: messageType,
          title: messageType === "success" ? "成功" : "エラー",
          message,
        },
      ]);
      // URLからパラメータを削除
      window.history.replaceState({}, "", "/settings");
    }
  }, [message, messageType]);

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      <div className="flex items-center gap-4 mb-8">
        <a
          href="/home"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
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
        <h1 className="text-3xl font-bold flex-1 text-gray-900 dark:text-white">
          アカウント設定
        </h1>
      </div>

      {/* ユーザー情報 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          ユーザー情報
        </h2>
        <div className="space-y-2">
          <div>
            <span className="text-gray-600 dark:text-gray-400">メール:</span>{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {user.email}
            </span>
          </div>
        </div>
      </div>

      {/* 連携済みアカウント */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          連携済みアカウント
        </h2>
        {userAccounts.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            連携済みアカウントがありません。
          </p>
        ) : (
          <div className="space-y-3">
            {userAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {PROVIDER_ICONS[account.providerId] || "🔗"}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {PROVIDER_LABELS[account.providerId] ||
                        account.providerId}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {account.createdAt
                        ? `連携日: ${new Date(account.createdAt).toLocaleDateString("ja-JP")}`
                        : "連携済み"}
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
                    className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* パスキー管理 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          パスキー管理
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          パスキーを使用すると、パスワードなしで安全にログインできます。指紋認証やFace
          IDなどの生体認証を使用できます。
        </p>

        {/* パスキー一覧 */}
        {isLoadingPasskeys ? (
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        ) : passkeys.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            登録済みのパスキーがありません。
          </p>
        ) : (
          <div className="space-y-3 mb-4">
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">🔑</span>
                  <div className="flex-1">
                    {editingPasskeyId === passkey.id ? (
                      <input
                        type="text"
                        value={editingPasskeyName}
                        onChange={(e) => setEditingPasskeyName(e.target.value)}
                        maxLength={255}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void handleUpdatePasskeyName(passkey.id);
                          } else if (e.key === "Escape") {
                            setEditingPasskeyId(null);
                            setEditingPasskeyName("");
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left w-full"
                        onClick={() => {
                          setEditingPasskeyId(passkey.id);
                          setEditingPasskeyName(passkey.name || "");
                        }}
                      >
                        {passkey.name || "名前なし"}
                      </button>
                    )}
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      登録日:{" "}
                      {new Date(passkey.createdAt).toLocaleDateString("ja-JP")}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingPasskeyId === passkey.id ? (
                    <>
                      <button
                        onClick={() => handleUpdatePasskeyName(passkey.id)}
                        className="px-3 py-1 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setEditingPasskeyId(null);
                          setEditingPasskeyName("");
                        }}
                        className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        キャンセル
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleDeletePasskey(passkey.id)}
                      className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* パスキー追加フォーム */}
        <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-400 mb-3">
            新しいパスキーを追加
          </h3>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="passkey-name-input"
                className="block text-sm font-medium text-indigo-900 dark:text-indigo-400 mb-1"
              >
                パスキー名（任意）
              </label>
              <input
                id="passkey-name-input"
                type="text"
                value={newPasskeyName}
                onChange={(e) => setNewPasskeyName(e.target.value)}
                maxLength={255}
                placeholder="空欄の場合は自動で命名されます（例: Touch ID、YubiKey 5 Series）"
                className="w-full px-3 py-2 border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600"
              />
              <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                認証器の種類が自動的に検出され、適切な名前が設定されます
              </p>
            </div>
            <button
              onClick={handleAddPasskey}
              disabled={isAddingPasskey}
              className="w-full px-4 py-2 bg-indigo-600 dark:bg-indigo-700 text-white rounded hover:bg-indigo-700 dark:hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAddingPasskey ? "登録中..." : "パスキーを登録"}
            </button>
          </div>
        </div>
      </div>

      {/* 新規アカウント連携 */}
      {availableProviders.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            新規アカウント連携
          </h2>
          <div className="space-y-3">
            {availableProviders.map((provider) => (
              <button
                key={provider}
                onClick={() =>
                  handleAccountLink(provider as "google" | "github")
                }
                type="button"
                className="w-full flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left bg-white dark:bg-gray-900"
              >
                <span className="text-2xl">
                  {PROVIDER_ICONS[provider] || "🔗"}
                </span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {PROVIDER_LABELS[provider] || provider}で連携
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {PROVIDER_LABELS[provider] || provider}
                    アカウントと連携します
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* アカウントマージ - セキュリティ上の理由により一時的に無効化 */}
      {/* <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-yellow-900 mb-4">
          別のアカウントを統合
        </h2>
        <p className="text-yellow-800 mb-4">
          別のアカウントでログインしてブックマークを現在のアカウントに統合できます。
          統合元のアカウントは削除されます。
        </p>
        <div className="space-y-3">
          {["google", "github"].map((provider) => (
            <form
              key={provider}
              method="post"
              action="/api/account/merge/start"
            >
              <input type="hidden" name="provider" value={provider} />
              <button
                type="submit"
                className="w-full flex items-center gap-3 p-4 border border-yellow-300 rounded-lg hover:bg-yellow-100 transition-colors text-left"
              >
                <span className="text-2xl">
                  {PROVIDER_ICONS[provider] || "🔗"}
                </span>
                <div>
                  <div className="font-medium text-yellow-900">
                    {PROVIDER_LABELS[provider] || provider}でログインして統合
                  </div>
                  <div className="text-sm text-yellow-700">
                    別の{PROVIDER_LABELS[provider] || provider}
                    アカウントのデータを統合します
                  </div>
                </div>
              </button>
            </form>
          ))}
        </div>
      </div> */}

      {/* アカウント削除 */}
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-900 dark:text-red-400 mb-4">
          危険な操作
        </h2>
        <p className="text-red-800 dark:text-red-300 mb-4">
          アカウントを削除すると、すべてのブックマーク、カテゴリ、設定が完全に削除されます。この操作は取り消せません。
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-800"
          >
            アカウントを削除
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="delete-confirm-input"
                className="block text-sm font-medium text-red-900 dark:text-red-400 mb-2"
              >
                確認のため「削除する」と入力してください
              </label>
              <input
                id="delete-confirm-input"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                maxLength={10}
                className="w-full px-3 py-2 border border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600"
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
                  className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-600"
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
