import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/home";
import {
  getDb,
  getAllBookmarks,
  createBookmark,
  getOrCreateCategory,
  getExistingCategories,
  checkDuplicateUrl,
  deleteBookmark,
} from "~/services/db.server";
import { generateBookmarkMetadata } from "~/services/ai.server";
import { fetchPageMetadata, validateUrl } from "~/services/scraper.server";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "AI Bookmarks - 自動カテゴリ分類ブックマーク" },
    {
      name: "description",
      content: "Cloudflare Workers AIによる自動カテゴリ分類ブックマーク管理",
    },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const bookmarksByCategory = await getAllBookmarks(db);

  return {
    bookmarksByCategory,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  const db = getDb(context.cloudflare.env.DB);

  // 削除処理
  if (intent === "delete") {
    const bookmarkId = formData.get("bookmarkId");
    
    // 入力検証
    if (!bookmarkId || typeof bookmarkId !== "string") {
      return { error: "無効なリクエストです" };
    }

    const id = Number(bookmarkId);
    if (isNaN(id) || id <= 0) {
      return { error: "無効なIDです" };
    }

    try {
      await deleteBookmark(db, id);
      return { success: true };
    } catch (error) {
      console.error("Delete failed:", error);
      return { error: "削除に失敗しました" };
    }
  }

  // ブックマーク追加処理
  const url = formData.get("url") as string;

  // 基本的な入力チェック
  if (!url || typeof url !== "string") {
    return {
      error: "URLを入力してください",
    };
  }

  // URL検証
  const validation = validateUrl(url);
  if (!validation.valid) {
    return {
      error: validation.error || "URLが無効です",
    };
  }

  // 重複チェック
  const isDuplicate = await checkDuplicateUrl(db, url);
  if (isDuplicate) {
    return {
      error: "このURLは既に登録されています",
    };
  }

  try {
    // 1. ページメタデータ取得
    const { title, content } = await fetchPageMetadata(url);

    // 2. 既存カテゴリ取得
    const existingCategories = await getExistingCategories(db);

    // 3. AI でメタデータ生成
    const metadata = await generateBookmarkMetadata(
      context.cloudflare.env.AI,
      url,
      title,
      content,
      existingCategories
    );

    // 4. カテゴリを取得または作成
    const majorCategoryId = await getOrCreateCategory(
      db,
      metadata.majorCategory,
      "major"
    );
    const minorCategoryId = await getOrCreateCategory(
      db,
      metadata.minorCategory,
      "minor",
      majorCategoryId
    );

    // 5. ブックマーク作成
    await createBookmark(db, {
      url: url,
      title,
      description: metadata.description,
      majorCategoryId,
      minorCategoryId,
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Failed to create bookmark:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "ブックマークの作成に失敗しました",
    };
  }
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🔖 AI Bookmarks
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Cloudflare Workers AIによる自動カテゴリ分類ブックマーク管理
          </p>
        </header>

        {/* URL入力フォーム */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="add" />
            <div>
              <label
                htmlFor="url"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                ブックマークを追加
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  id="url"
                  name="url"
                  placeholder="https://example.com"
                  required
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      処理中...
                    </>
                  ) : (
                    "追加"
                  )}
                </button>
              </div>
            </div>

            {/* エラー・成功メッセージ */}
            {actionData?.error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-200 text-sm">
                  ❌ {actionData.error}
                </p>
              </div>
            )}
            {actionData?.success && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-800 dark:text-green-200 text-sm">
                  ✅ ブックマークを追加しました
                </p>
              </div>
            )}
          </Form>
        </div>

        {/* ブックマーク一覧 */}
        {loaderData.bookmarksByCategory.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              まだブックマークがありません。URLを追加してください。
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {loaderData.bookmarksByCategory.map((major) => (
              <div key={major.majorCategory} className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 border-b-2 border-blue-500 pb-2">
                  {major.majorCategory}
                </h2>

                {major.minorCategories.map((minor) => (
                  <div key={minor.minorCategory} className="ml-4 space-y-3">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      {minor.minorCategory}
                    </h3>

                    <div className="ml-6 grid gap-3">
                      {minor.bookmarks.map((bookmark) => (
                        <div
                          key={bookmark.id}
                          className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow p-4 border border-gray-200 dark:border-gray-700 group"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <a
                                href={bookmark.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              >
                                <h4 className="font-medium text-gray-900 dark:text-white truncate mb-1">
                                  {bookmark.title}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                                  {bookmark.description}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                                  {bookmark.url}
                                </p>
                              </a>
                            </div>

                            <Form method="post" className="shrink-0">
                              <input type="hidden" name="intent" value="delete" />
                              <input
                                type="hidden"
                                name="bookmarkId"
                                value={bookmark.id}
                              />
                              <button
                                type="submit"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                title="削除"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </Form>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
