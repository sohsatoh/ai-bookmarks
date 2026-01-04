import { Link } from "react-router";
import type { Route } from "./+types/privacy";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "プライバシーポリシー - AI Bookmarks" },
    {
      name: "description",
      content: "AI Bookmarksのプライバシーポリシー",
    },
  ];
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black transition-colors duration-500">
      {/* ナビゲーションバー */}
      <div className="sticky top-0 z-30 bg-[#F5F5F7]/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Bookmarks
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-12">
        <article className="bg-white dark:bg-gray-900 rounded-2xl p-8 sm:p-12 shadow-sm">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-8 tracking-tight">
            プライバシーポリシー
          </h1>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                1. はじめに
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                AI Bookmarks（以下「本サービス」）は、ユーザーの皆様のプライバシーを尊重し、個人情報の保護に努めています。本プライバシーポリシーは、本サービスにおける個人情報の取り扱いについて説明するものです。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                2. 収集する情報
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                本サービスでは、以下の情報を収集する場合があります：
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>ブックマークされたURL情報</li>
                <li>ブックマークのタイトル、説明文</li>
                <li>カテゴリ情報</li>
                <li>IPアドレス（レート制限のため）</li>
                <li>アクセス日時</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                3. 情報の利用目的
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                収集した情報は、以下の目的で利用します：
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>本サービスの提供および運営</li>
                <li>AIによる自動カテゴリ分類機能の提供</li>
                <li>サービスの改善および品質向上</li>
                <li>不正利用の防止およびセキュリティ対策</li>
                <li>問い合わせ対応</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                4. 情報の管理
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本サービスは、Cloudflare Workers上で動作しており、収集した情報はCloudflare D1データベースに安全に保管されます。適切なセキュリティ対策を実施し、不正アクセス、紛失、破壊、改ざん、漏洩などから情報を保護します。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                5. 第三者への提供
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本サービスは、以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません：
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4 mt-3">
                <li>ユーザーの同意がある場合</li>
                <li>法令に基づく場合</li>
                <li>人の生命、身体または財産の保護のために必要がある場合</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                6. AI処理について
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本サービスでは、Cloudflare Workers AIを使用してブックマークの自動カテゴリ分類を行っています。この処理では、ブックマークのURL、タイトル、説明文がCloudflareのAIモデルに送信されます。Cloudflareは、これらの情報をモデルのトレーニングには使用しません。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                7. Cookie等の利用
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本サービスでは、サービスの利便性向上のため、ブラウザのローカルストレージを使用する場合があります。ローカルストレージに保存された情報は、お使いのブラウザから削除することができます。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                8. プライバシーポリシーの変更
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本プライバシーポリシーは、法令の変更や本サービスの機能追加等に伴い、予告なく変更されることがあります。変更後のプライバシーポリシーは、本ページに掲載された時点で効力を生じるものとします。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                9. お問い合わせ
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本プライバシーポリシーに関するお問い合わせは、GitHubのIssueまたはリポジトリ管理者までご連絡ください。
              </p>
            </section>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-12">
              最終更新日: 2026年1月4日
            </p>
          </div>
        </article>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
