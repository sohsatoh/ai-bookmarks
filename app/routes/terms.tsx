import { Link } from "react-router";
import type { Route } from "./+types/terms";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "利用規約 - AI Bookmarks" },
    {
      name: "description",
      content: "AI Bookmarksの利用規約",
    },
  ];
}

export default function Terms() {
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
            利用規約
          </h1>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                1. 総則
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本利用規約（以下「本規約」）は、AI Bookmarks（以下「本サービス」）の利用条件を定めるものです。本サービスを利用することにより、本規約の全ての内容に同意したものとみなされます。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                2. サービスの内容
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本サービスは、AIを活用したブックマーク管理ツールです。ユーザーが登録したURLを自動的にカテゴリ分類し、効率的なブックマーク管理を支援します。本サービスは無料で提供されます。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                3. 利用資格
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本サービスは、以下の条件を満たす方のみ利用できます：
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4 mt-3">
                <li>本規約に同意すること</li>
                <li>本サービスを適切に利用する意思があること</li>
                <li>反社会的勢力に該当しないこと</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                4. 禁止事項
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません：
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>法令または公序良俗に違反する行為</li>
                <li>犯罪行為に関連する行為</li>
                <li>本サービスの運営を妨害する行為</li>
                <li>他のユーザーまたは第三者の権利を侵害する行為</li>
                <li>不正アクセスや過度なアクセスを試みる行為</li>
                <li>本サービスのセキュリティを脅かす行為</li>
                <li>違法なコンテンツを含むURLを登録する行為</li>
                <li>本サービスの信用を毀損する行為</li>
                <li>その他、運営者が不適切と判断する行為</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                5. サービスの提供
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                運営者は、本サービスの内容を変更、一時停止、または終了する場合があります。これらの措置により生じた損害について、運営者は一切の責任を負いません。ただし、サービスの終了については、可能な限り事前に通知するよう努めます。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                6. データの取り扱い
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                ユーザーが本サービスに登録したブックマークデータは、サービスの提供およびAI処理のために利用されます。詳細については、プライバシーポリシーをご確認ください。運営者は、ユーザーデータの保護に努めますが、データの完全性や可用性を保証するものではありません。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                7. 知的財産権
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本サービスに関する知的財産権は、運営者または正当な権利者に帰属します。ユーザーは、本サービスの利用により、これらの知的財産権を使用する非独占的な権利を得ますが、これらを複製、改変、譲渡、販売等することはできません。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                8. 免責事項
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                運営者は、以下の事項について一切の責任を負いません：
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>本サービスの利用により生じた損害</li>
                <li>本サービスの中断、停止、終了により生じた損害</li>
                <li>AIによる分類結果の正確性</li>
                <li>ユーザーが登録したURLの内容</li>
                <li>第三者との間で生じたトラブル</li>
                <li>データの消失や破損</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
                本サービスは「現状有姿」で提供されます。運営者は、本サービスの完全性、正確性、有用性、安全性等について、明示的または黙示的を問わず、いかなる保証も行いません。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                9. レート制限
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本サービスでは、サーバーの負荷軽減およびサービスの安定性確保のため、レート制限を設けています。過度なリクエストを検知した場合、一時的にサービスの利用を制限する場合があります。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                10. 規約の変更
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                運営者は、必要に応じて本規約を変更することができます。変更後の規約は、本ページに掲載された時点で効力を生じるものとします。変更後も本サービスを継続して利用する場合、変更後の規約に同意したものとみなされます。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                11. 準拠法および管轄裁判所
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本規約の解釈および適用は、日本法に準拠します。本サービスに関して紛争が生じた場合、運営者の所在地を管轄する裁判所を専属的合意管轄裁判所とします。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                12. お問い合わせ
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本規約に関するお問い合わせは、GitHubのIssueまたはリポジトリ管理者までご連絡ください。
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
