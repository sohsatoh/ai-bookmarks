/**
 * トップページ（未ログインユーザー向け）
 *
 * 機能:
 * - サービスの紹介
 * - ログインボタン
 * - 主要機能の説明
 *
 * セキュリティ:
 * - 既にログイン済みの場合はホームにリダイレクト
 */

import { Link, redirect, useLoaderData, data } from "react-router";
import type { Route } from "./+types/index";
import { getSession } from "~/services/auth.server";
import { useState, useEffect } from "react";
import { ToastContainer, type ToastMessage } from "~/components/Toast";

export function meta(_args: Route.MetaArgs) {
  const title = "AI Bookmarks - AIによる自動カテゴリ分類ブックマーク管理";
  const description =
    "AIが自動でURLをカテゴリ分類するブックマーク管理サービス。シンプルで直感的なUIで、効率的にブックマークを整理できます。Cloudflare Workers AIを活用した高速で安全なブックマーク管理ツール。";
  const url = "https://ai-bookmarks.pages.dev";
  const image = `${url}/og-image.png`;

  return [
    { title },
    { name: "description", content: description },
    {
      name: "keywords",
      content:
        "ブックマーク,AI,自動分類,カテゴリ,整理,管理,Cloudflare,Workers AI",
    },

    // Open Graph
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:site_name", content: "AI Bookmarks" },
    { property: "og:locale", content: "ja_JP" },

    // Twitter Card
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },

    // その他のSEO最適化
    { name: "robots", content: "index, follow" },
    { name: "author", content: "AI Bookmarks" },

    // Canonical URL
    { tagName: "link", rel: "canonical", href: url },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  // 既にログイン済みの場合はホームにリダイレクト
  const session = await getSession(request, context);
  if (session?.user) {
    return redirect("/home");
  }

  // URLパラメータからメッセージを取得
  const url = new URL(request.url);
  const message = url.searchParams.get("message");
  const messageType = url.searchParams.get("type") as
    | "success"
    | "error"
    | null;

  return data({
    message: message || null,
    messageType: messageType || null,
  });
}

export default function Index() {
  const { message, messageType } = useLoaderData<typeof loader>();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
      window.history.replaceState({}, "", "/");
    }
  }, [message, messageType]);

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 構造化データ（JSON-LD）
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "AI Bookmarks",
    description:
      "AIが自動でURLをカテゴリ分類するブックマーク管理サービス。シンプルで直感的なUIで、効率的にブックマークを整理できます。",
    url: "https://ai-bookmarks.pages.dev",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "JPY",
    },
    featureList: [
      "AI自動分類",
      "スマートカテゴリ",
      "ファイル管理",
      "ソーシャル認証",
    ],
    softwareVersion: "1.0.0",
    author: {
      "@type": "Organization",
      name: "AI Bookmarks",
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      {/* ヘッダー */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <h1 className="text-2xl font-bold text-gray-900">AI Bookmarks</h1>
          </div>
          <Link
            to="/login"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ログイン
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-16">
        {/* ヒーローセクション */}
        <div className="text-center mb-20">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            AIが自動で分類する
            <br />
            ブックマーク管理
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            URLを追加するだけで、AIが自動的にカテゴリを分類。
            <br />
            シンプルで効率的なブックマーク管理を実現します。
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            無料で始める
          </Link>
        </div>

        {/* 機能紹介 */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="bg-white rounded-lg p-8 shadow-md">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">AI自動分類</h3>
            <p className="text-gray-600">
              Cloudflare Workers
              AIがURLの内容を解析し、適切なカテゴリを自動で割り当てます。手動でのカテゴリ整理は不要です。
            </p>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-md">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">高速・軽量</h3>
            <p className="text-gray-600">
              Cloudflare
              Workersで動作するため、世界中どこからでも高速にアクセス可能。サーバーレスで常に最新の状態を保ちます。
            </p>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-md">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">セキュア</h3>
            <p className="text-gray-600">
              OAuth 2.0による安全な認証。データはCloudflare
              D1に暗号化して保存され、プライバシーを保護します。
            </p>
          </div>
        </div>

        {/* 追加機能 */}
        <div className="bg-white rounded-lg p-8 shadow-md mb-20">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-3xl">📁</div>
            <h3 className="text-2xl font-bold text-gray-900">ファイル管理</h3>
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
              Beta
            </span>
          </div>
          <p className="text-gray-600 mb-4">
            テキストファイルやPDFをアップロードして、AIによる自動分析が可能です。ドキュメント管理もブックマークと同じように簡単に。
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600">テキストファイル・PDF対応</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600">AI自動カテゴリ分析</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600">最大10MBまで対応</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600">R2による安全な保管</span>
            </div>
          </div>
        </div>

        {/* 使い方 */}
        <div className="bg-white rounded-lg p-12 shadow-md mb-20">
          <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            使い方はシンプル
          </h3>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h4 className="font-bold text-gray-900 mb-2">ログイン</h4>
              <p className="text-sm text-gray-600">
                GoogleまたはGitHubアカウントでログイン
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="font-bold text-gray-900 mb-2">URLを追加</h4>
              <p className="text-sm text-gray-600">
                ブックマークしたいURLを入力
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="font-bold text-gray-900 mb-2">AI分類</h4>
              <p className="text-sm text-gray-600">AIが自動でカテゴリを分類</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h4 className="font-bold text-gray-900 mb-2">整理完了</h4>
              <p className="text-sm text-gray-600">
                すぐに使える整理されたブックマーク
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-blue-600 text-white rounded-lg p-12 shadow-lg">
          <h3 className="text-3xl font-bold mb-4">今すぐ始めましょう</h3>
          <p className="text-lg mb-8 opacity-90">
            無料で利用できます。アカウント登録も簡単です。
          </p>
          <Link
            to="/login"
            className="inline-block px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-md"
          >
            ログインして始める
          </Link>
        </div>
      </main>

      {/* フッター */}
      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">📚</span>
              <span className="font-semibold text-gray-900">AI Bookmarks</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-600">
              <Link to="/privacy" className="hover:text-gray-900">
                プライバシーポリシー
              </Link>
              <Link to="/terms" className="hover:text-gray-900">
                利用規約
              </Link>
            </div>
            <div className="text-sm text-gray-500">
              © 2026 AI Bookmarks. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
