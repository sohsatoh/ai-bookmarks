/**
 * ログインページ
 *
 * GoogleとGitHubのソーシャルログイン、およびパスキー認証を提供します。
 * セキュリティ機能:
 * - CSRF保護（Better Authが自動処理）
 * - セキュアなOAuthフロー（PKCE使用）
 * - レート制限（Better Auth内蔵）
 * - Passkey Autofill（Conditional UI）対応
 */

import type { LoaderFunctionArgs } from "react-router";
import { getSession } from "~/services/auth.server";
import { redirect } from "react-router";
import type { Route } from "./+types/login";
import { useEffect, useRef, useState } from "react";
import { authClient } from "~/lib/auth-client";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "ログイン - AI Bookmarks" },
    {
      name: "description",
      content:
        "AI Bookmarksにログインして、AIによる自動カテゴリ分類でブックマークを管理しましょう。",
    },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  // すでにログインしている場合はホームにリダイレクト
  const session = await getSession(request, context);
  if (session) {
    return redirect("/");
  }

  return null;
}

export default function Login() {
  const [isPasskeySupported, setIsPasskeySupported] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Passkey Autofillのプリロード（Conditional UI）
  useEffect(() => {
    // Conditional UI対応チェック
    const checkPasskeySupport = async () => {
      if (
        typeof window !== "undefined" &&
        window.PublicKeyCredential &&
        PublicKeyCredential.isConditionalMediationAvailable
      ) {
        try {
          const available =
            await PublicKeyCredential.isConditionalMediationAvailable();
          setIsPasskeySupported(available);

          // Conditional UI利用可能な場合、Autofillを有効化
          if (available) {
            void authClient.signIn.passkey({
              autoFill: true,
              fetchOptions: {
                onSuccess() {
                  // 認証成功時にホームにリダイレクト
                  window.location.href = "/";
                },
                onError(context) {
                  console.error("Passkey認証エラー:", context.error);
                },
              },
            });
          }
        } catch (error) {
          console.error("Passkey対応チェックエラー:", error);
          setIsPasskeySupported(false);
        }
      }
    };

    void checkPasskeySupport();
  }, []);

  const handleSocialLogin = async (provider: "google" | "github") => {
    try {
      const response = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider,
          callbackURL: globalThis.location.origin,
        }),
      });

      if (!response.ok) {
        // レスポンスがJSONかどうかを確認
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          console.error("ログインエラー:", errorData);
        } else {
          const errorText = await response.text();
          console.error("ログインエラー:", errorText);
        }
        throw new Error("ログインに失敗しました");
      }

      // レスポンスがJSONかどうかを確認
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const responseText = await response.text();
        console.error("予期しないレスポンス:", responseText);
        throw new Error("予期しないレスポンスが返されました");
      }

      const data = (await response.json()) as { url?: string };
      // OAuthプロバイダーのURLにリダイレクト
      if (data.url) {
        globalThis.location.href = data.url;
      }
    } catch (error) {
      console.error("ログインエラー:", error);
      alert("ログインに失敗しました。もう一度お試しください。");
    }
  };

  const handlePasskeyLogin = async () => {
    try {
      setPasskeyError(null);
      const { error } = (await authClient.signIn.passkey({
        fetchOptions: {
          onSuccess() {
            // 認証成功時にホームにリダイレクト
            window.location.href = "/";
          },
        },
      })) as any;

      if (error) {
        console.error("Passkey認証エラー:", error);
        setPasskeyError("パスキー認証に失敗しました");
      }
    } catch (error) {
      console.error("Passkey認証エラー:", error);
      setPasskeyError("パスキー認証に失敗しました");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Bookmarks
          </h1>
          <p className="text-gray-600">
            ログインしてブックマークを管理しましょう
          </p>
        </div>

        {/* Passkey Autofill用の非表示入力フィールド */}
        {isPasskeySupported && (
          <div className="hidden">
            <input
              ref={emailInputRef}
              type="text"
              name="email"
              autoComplete="username webauthn"
              tabIndex={-1}
              aria-label="Passkey autofill field"
            />
          </div>
        )}

        {passkeyError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {passkeyError}
          </div>
        )}

        <div className="space-y-4">
          {/* パスキーログインボタン */}
          {isPasskeySupported && (
            <div className="space-y-3">
              <button
                onClick={handlePasskeyLogin}
                type="button"
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-indigo-500 rounded-lg shadow-sm bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span className="text-sm font-medium text-white">
                  パスキーでログイン
                </span>
              </button>
              <p className="text-xs text-gray-500 text-center">
                パスキーが未登録の場合は、まずGoogleまたはGitHubでログインし、設定ページからパスキーを追加してください
              </p>
            </div>
          )}

          {/* 区切り線 */}
          {isPasskeySupported && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  または他の方法でログイン
                </span>
              </div>
            </div>
          )}

          {/* Googleログインボタン */}
          <button
            onClick={() => handleSocialLogin("google")}
            type="button"
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              Googleでログイン
            </span>
          </button>

          {/* GitHubログインボタン */}
          <button
            onClick={() => handleSocialLogin("github")}
            type="button"
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              GitHubでログイン
            </span>
          </button>
        </div>

        <div className="text-center text-sm text-gray-600 mt-8">
          <p>
            ログインすることで、
            <a href="/terms" className="text-indigo-600 hover:text-indigo-500">
              利用規約
            </a>
            と
            <a
              href="/privacy"
              className="text-indigo-600 hover:text-indigo-500"
            >
              プライバシーポリシー
            </a>
            に同意したものとみなされます。
          </p>
        </div>
      </div>
    </div>
  );
}
