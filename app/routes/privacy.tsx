import { Link } from "react-router";
import type { Route } from "./+types/privacy";

export function meta(_args: Route.MetaArgs) {
  const title = "プライバシーポリシー - AI Bookmarks";
  const description =
    "AI Bookmarksのプライバシーポリシー。個人情報の収集、使用、管理について説明します。";
  const url = "https://ai-bookmarks.pages.dev/privacy";

  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index, follow" },

    // Open Graph
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
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
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              AI
              Bookmarks（以下「本サービス」といいます。）は、本ウェブサイト上で提供するサービス（以下「本サービス」といいます。）における、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます。）を定めます。
            </p>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第1条（個人情報）
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号、連絡先その他の記述等により特定の個人を識別できる情報及び容貌、指紋、声紋にかかるデータ、及び健康保険証の保険者番号などの当該情報単体から特定の個人を識別できる情報（個人識別情報）を指します。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第2条（個人情報の収集方法）
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                本サービスは、ユーザーが利用する際に、ブックマークされたURL、タイトル、説明文、カテゴリ情報、IPアドレス、アクセス日時などの情報を収集することがあります。また、ユーザーと提携先などとの間でなされたユーザーの個人情報を含む取引記録や決済に関する情報を、本サービスの提携先（情報提供元、広告主、広告配信先などを含みます。以下「提携先」といいます。）などから収集することがあります。
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第3条（個人情報を収集・利用する目的）
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                本サービスが個人情報を収集・利用する目的は、以下のとおりです。
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>本サービスの提供・運営のため</li>
                <li>
                  ユーザーからのお問い合わせに回答するため（本人確認を行うことを含む）
                </li>
                <li>
                  ユーザーが利用中のサービスの新機能、更新情報、キャンペーン等及び本サービスが提供する他のサービスの案内のメールを送付するため
                </li>
                <li>
                  メンテナンス、重要なお知らせなど必要に応じたご連絡のため
                </li>
                <li>
                  利用規約に違反したユーザーや、不正・不当な目的でサービスを利用しようとするユーザーの特定をし、ご利用をお断りするため
                </li>
                <li>
                  ユーザーにご自身の登録情報の閲覧や変更、削除、ご利用状況の閲覧を行っていただくため
                </li>
                <li>有料サービスにおいて、ユーザーに利用料金を請求するため</li>
                <li>上記の利用目的に付随する目的</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第3条の2（AIによる処理について）
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                本サービスは、ブックマークの自動分類およびメタデータ生成のために、Cloudflare
                Workers AIを利用しています。
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>
                  <span className="font-semibold">使用するAIモデル</span>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 pl-6 mt-1">
                    <li>
                      モデル名: Cloudflare Workers AI (@cf/openai/gpt-oss-120b)
                    </li>
                    <li>
                      用途:
                      ブックマークされたWebページのタイトル、説明文、カテゴリの自動生成
                    </li>
                  </ul>
                </li>
                <li>
                  <span className="font-semibold">AIへのデータ送信</span>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-1 pl-6">
                    ブックマークを追加する際、以下の情報がCloudflare Workers
                    AIに送信されます。
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 pl-6 mt-1">
                    <li>ブックマークされたWebページのURL</li>
                    <li>Webページのタイトル</li>
                    <li>Webページの説明文（metaタグから取得）</li>
                    <li>Webページの本文の一部（最大1500文字）</li>
                  </ul>
                </li>
                <li>
                  <span className="font-semibold">
                    AIモデルの学習利用について
                  </span>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-1 pl-6">
                    Cloudflare Workers
                    AIは、Cloudflareのプライバシーポリシーに従って運用されています。Cloudflareの公式情報によれば、Workers
                    AIに送信されたデータは以下のように取り扱われます。
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 pl-6 mt-1">
                    <li>
                      Cloudflareは、Workers
                      AIへの入力データをAIモデルの学習には使用しません
                    </li>
                    <li>
                      送信されたデータは、リクエストの処理完了後に保持されません
                    </li>
                    <li>
                      詳細については、Cloudflareのプライバシーポリシー（https://www.cloudflare.com/privacypolicy/）をご参照ください
                    </li>
                  </ul>
                </li>
                <li>
                  <span className="font-semibold">データ保持について</span>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 pl-6 mt-1">
                    <li>
                      AIによって生成されたカテゴリ、説明文は、本サービスのデータベース（Cloudflare
                      D1）に保存されます
                    </li>
                    <li>
                      元のWebページの本文データは保存されず、処理完了後に破棄されます
                    </li>
                    <li>
                      保存されたデータは、ユーザー自身がブックマークを削除することで完全に削除されます
                    </li>
                  </ul>
                </li>
                <li>
                  <span className="font-semibold">セキュリティ対策</span>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 pl-6 mt-1">
                    <li>
                      AIへの送信前に、すべての入力データは厳格なサニタイズ処理を実施
                    </li>
                    <li>
                      Prompt
                      Injection（プロンプトインジェクション）攻撃への対策を実装
                    </li>
                    <li>
                      AIからの応答は、XSS（クロスサイトスクリプティング）対策のため、危険な文字列を検出・除去
                    </li>
                    <li>
                      詳細なセキュリティ対策については、本サービスのGitHubリポジトリで公開しています
                    </li>
                  </ul>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第4条（利用目的の変更）
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>
                  本サービスは、利用目的が変更前と関連性を有すると合理的に認められる場合に限り、個人情報の利用目的を変更するものとします。
                </li>
                <li>
                  利用目的の変更を行った場合には、変更後の目的について、本サービス所定の方法により、ユーザーに通知し、または本ウェブサイト上に公表するものとします。
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第5条（個人情報の第三者提供）
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>
                  本サービスは、次に掲げる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。ただし、個人情報保護法その他の法令で認められる場合を除きます。
                  <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 pl-6 mt-2">
                    <li>
                      人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき
                    </li>
                    <li>
                      公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき
                    </li>
                    <li>
                      国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき
                    </li>
                    <li>
                      予め次の事項を告知あるいは公表し、かつ本サービスが個人情報保護委員会に届出をしたとき
                      <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 pl-6 mt-1">
                        <li>利用目的に第三者への提供を含むこと</li>
                        <li>第三者に提供されるデータの項目</li>
                        <li>第三者への提供の手段または方法</li>
                        <li>
                          本人の求めに応じて個人情報の第三者への提供を停止すること
                        </li>
                        <li>本人の求めを受け付ける方法</li>
                      </ul>
                    </li>
                  </ul>
                </li>
                <li>
                  前項の定めにかかわらず、次に掲げる場合には、当該情報の提供先は第三者に該当しないものとします。
                  <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 pl-6 mt-2">
                    <li>
                      本サービスが利用目的の達成に必要な範囲内において個人情報の取扱いの全部または一部を委託する場合
                    </li>
                    <li>
                      合併その他の事由による事業の承継に伴って個人情報が提供される場合
                    </li>
                    <li>
                      個人情報を特定の者との間で共同して利用する場合であって、その旨並びに共同して利用される個人情報の項目、共同して利用する者の範囲、利用する者の利用目的および当該個人情報の管理について責任を有する者の氏名または名称について、あらかじめ本人に通知し、または本人が容易に知り得る状態に置いた場合
                    </li>
                  </ul>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第6条（個人情報の開示）
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>
                  本サービスは、本人から個人情報の開示を求められたときは、本人に対し、遅滞なくこれを開示します。ただし、開示することにより次のいずれかに該当する場合は、その全部または一部を開示しないこともあり、開示しない決定をした場合には、その旨を遅滞なく通知します。なお、個人情報の開示に際しては、1件あたり1,000円の手数料を申し受けます。
                  <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 pl-6 mt-2">
                    <li>
                      本人または第三者の生命、身体、財産その他の権利利益を害するおそれがある場合
                    </li>
                    <li>
                      本サービスの業務の適正な実施に著しい支障を及ぼすおそれがある場合
                    </li>
                    <li>その他法令に違反することとなる場合</li>
                  </ul>
                </li>
                <li>
                  前項の定めにかかわらず、履歴情報および特性情報などの個人情報以外の情報については、原則として開示いたしません。
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第7条（個人情報の訂正および削除）
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>
                  ユーザーは、本サービスの保有する自己の個人情報が誤った情報である場合には、本サービスが定める手続きにより、本サービスに対して個人情報の訂正、追加または削除（以下「訂正等」といいます。）を請求することができます。
                </li>
                <li>
                  本サービスは、ユーザーから前項の請求を受けてその請求に応じる必要があると判断した場合には、遅滞なく、当該個人情報の訂正等を行うものとします。
                </li>
                <li>
                  本サービスは、前項の規定に基づき訂正等を行った場合、または訂正等を行わない旨の決定をしたときは遅滞なく、これをユーザーに通知します。
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第8条（個人情報の利用停止等）
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>
                  本サービスは、本人から、個人情報が、利用目的の範囲を超えて取り扱われているという理由、または不正の手段により取得されたものであるという理由により、その利用の停止または消去（以下「利用停止等」といいます。）を求められた場合には、遅滞なく必要な調査を行います。
                </li>
                <li>
                  前項の調査結果に基づき、その請求に応じる必要があると判断した場合には、遅滞なく、当該個人情報の利用停止等を行います。
                </li>
                <li>
                  本サービスは、前項の規定に基づき利用停止等を行った場合、または利用停止等を行わない旨の決定をしたときは、遅滞なく、これをユーザーに通知します。
                </li>
                <li>
                  前2項にかかわらず、利用停止等に多額の費用を有する場合その他利用停止等を行うことが困難な場合であって、ユーザーの権利利益を保護するために必要なこれに代わるべき措置をとれる場合は、この代替策を講じるものとします。
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第9条（プライバシーポリシーの変更）
              </h2>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300 pl-4">
                <li>
                  本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、ユーザーに通知することなく、変更することができるものとします。
                </li>
                <li>
                  本サービスが別途定める場合を除いて、変更後のプライバシーポリシーは、本ウェブサイトに掲載したときから効力を生じるものとします。
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4">
                第10条（お問い合わせ窓口）
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                本ポリシーに関するお問い合わせは、下記の窓口までお願いいたします。
              </p>
              <div className="text-gray-700 dark:text-gray-300 leading-relaxed pl-4">
                <p>サービス名：AI Bookmarks</p>
                <p>お問い合わせ方法：GitHubのIssueまたはリポジトリ管理者</p>
              </div>
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
