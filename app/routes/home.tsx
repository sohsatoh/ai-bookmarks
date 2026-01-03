import { Form, useNavigation, useSearchParams, useRevalidator } from "react-router";
import { useEffect, useState } from "react";
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
import { bookmarks } from "~/db/schema";
import { eq } from "drizzle-orm";
import { generateBookmarkMetadata } from "~/services/ai.server";
import { fetchPageMetadata, validateUrl } from "~/services/scraper.server";
import { checkRateLimit, getClientIp } from "~/services/rate-limit.server";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "AI Bookmarks - 自動カテゴリ分類ブックマーク" },
    {
      name: "description",
      content: "Cloudflare Workers AIによる自動カテゴリ分類ブックマーク管理",
    },
  ];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare.env.DB);
  const url = new URL(request.url);
  const sortBy = url.searchParams.get("sortBy") || "date";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";
  
  const bookmarksByCategory = await getAllBookmarks(db);

  // ソート処理
  const sortedBookmarksByCategory = bookmarksByCategory.map((major) => ({
    ...major,
    minorCategories: major.minorCategories.map((minor) => ({
      ...minor,
      bookmarks: [...minor.bookmarks].sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === "title") {
          comparison = a.title.localeCompare(b.title, "ja");
        } else if (sortBy === "url") {
          comparison = a.url.localeCompare(b.url);
        } else {
          // date
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        
        return sortOrder === "asc" ? comparison : -comparison;
      }),
    })),
  }));

  return {
    bookmarksByCategory: sortedBookmarksByCategory,
    sortBy,
    sortOrder,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  // DoS対策: レート制限チェック
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(clientIp, 10, 60 * 1000); // 1分間に10リクエスト
  
  if (!rateLimit.allowed) {
    const resetInSeconds = Math.ceil(rateLimit.resetIn / 1000);
    return {
      error: `リクエスト制限を超えました。${resetInSeconds}秒後に再試行してください。`,
    };
  }

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

  // DoS対策: URL長の制限
  if (url.length > 2048) {
    return {
      error: "URLが長すぎます（最大2048文字）",
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
    const { title, description, content } = await fetchPageMetadata(url);

    // 2. 暫定カテゴリで先にブックマークを保存（高速レスポンス）
    const domain = new URL(url).hostname;
    const tempMajorCategoryId = await getOrCreateCategory(
      db,
      "未分類",
      "major"
    );
    const tempMinorCategoryId = await getOrCreateCategory(
      db,
      domain,
      "minor",
      tempMajorCategoryId
    );

    const bookmarkResult = await createBookmark(db, {
      url: url,
      title,
      description: title.slice(0, 60),
      majorCategoryId: tempMajorCategoryId,
      minorCategoryId: tempMinorCategoryId,
    });

    // 3. AI処理をバックグラウンドで実行（waitUntilで非同期処理）
    context.cloudflare.ctx.waitUntil(
      (async () => {
        try {
          const existingCategories = await getExistingCategories(db);
          const metadata = await generateBookmarkMetadata(
            context.cloudflare.env.AI,
            url,
            title,
            description,
            content,
            existingCategories
          );

          // カテゴリを更新
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

          // ブックマークのカテゴリと説明を更新
          await db
            .update(bookmarks)
            .set({
              description: metadata.description,
              majorCategoryId,
              minorCategoryId,
            })
            .where(eq(bookmarks.id, bookmarkResult.id));
        } catch (error) {
          console.error("Background AI processing failed:", error);
          // エラーでも暫定カテゴリで保存済みなので影響なし
        }
      })()
    );

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
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [justAdded, setJustAdded] = useState<number[]>([]);
  
  const currentSortBy = loaderData.sortBy;
  const currentSortOrder = loaderData.sortOrder;
  
  // AI処理中のブックマークを検出（未分類カテゴリで直近5分以内）
  const processingBookmarks = loaderData.bookmarksByCategory
    .flatMap(major => major.minorCategories.flatMap(minor => minor.bookmarks))
    .filter(bookmark => {
      const isRecent = Date.now() - new Date(bookmark.createdAt).getTime() < 5 * 60 * 1000; // 5分以内
      const isUncategorized = bookmark.majorCategory.name === "未分類";
      return isRecent && isUncategorized;
    });
  
  // 処理中のブックマークがある場合、定期的にリフレッシュ
  useEffect(() => {
    if (processingBookmarks.length > 0) {
      const interval = setInterval(() => {
        revalidator.revalidate();
      }, 3000); // 3秒ごとにリフレッシュ
      
      return () => clearInterval(interval);
    }
  }, [processingBookmarks.length, revalidator]);
  
  // 新しく追加されたブックマークのアニメーション
  useEffect(() => {
    if (actionData?.success && !isSubmitting) {
      // 成功後にリフレッシュして最新のブックマークを取得
      revalidator.revalidate();
      
      // 最新のブックマークをjustAddedに追加（最初の1件）
      const allBookmarks = loaderData.bookmarksByCategory
        .flatMap(major => major.minorCategories.flatMap(minor => minor.bookmarks));
      if (allBookmarks.length > 0) {
        const newestBookmark = allBookmarks.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        setJustAdded(prev => [...prev, newestBookmark.id]);
        
        // 3秒後にアニメーションを解除
        setTimeout(() => {
          setJustAdded(prev => prev.filter(id => id !== newestBookmark.id));
        }, 3000);
      }
    }
  }, [actionData?.success, isSubmitting, revalidator]);
  
  const handleSortChange = (newSortBy: string) => {
    const newParams = new URLSearchParams(searchParams);
    
    // 同じソート項目をクリックした場合は順序を反転
    if (newSortBy === currentSortBy) {
      newParams.set("sortOrder", currentSortOrder === "asc" ? "desc" : "asc");
    } else {
      newParams.set("sortBy", newSortBy);
      newParams.set("sortOrder", "desc");
    }
    
    setSearchParams(newParams);
  };

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

        {/* ソート機能 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              並び替え:
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleSortChange("date")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentSortBy === "date"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                日付
                {currentSortBy === "date" && (
                  <span className="ml-1">{currentSortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
              <button
                onClick={() => handleSortChange("title")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentSortBy === "title"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                タイトル
                {currentSortBy === "title" && (
                  <span className="ml-1">{currentSortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
              <button
                onClick={() => handleSortChange("url")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentSortBy === "url"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                URL
                {currentSortBy === "url" && (
                  <span className="ml-1">{currentSortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
            </div>
          </div>
        </div>

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
                      {minor.bookmarks.map((bookmark) => {
                        const isProcessing = processingBookmarks.some(b => b.id === bookmark.id);
                        const isNewlyAdded = justAdded.includes(bookmark.id);
                        
                        return (
                        <div
                          key={bookmark.id}
                          className={`bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-all duration-500 p-4 border border-gray-200 dark:border-gray-700 group ${
                            isNewlyAdded ? 'animate-fade-in scale-100' : ''
                          } ${
                            isProcessing ? 'border-blue-400 dark:border-blue-500 border-2' : ''
                          }`}
                        >
                          {isProcessing && (
                            <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400 text-sm">
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span className="font-medium">AIがカテゴリを分析中...</span>
                            </div>
                          )}
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
                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
                                  <span className="truncate flex-1">
                                    {bookmark.url}
                                  </span>
                                  <span className="shrink-0 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                    {new Date(bookmark.createdAt).toLocaleDateString("ja-JP", {
                                      year: "numeric",
                                      month: "2-digit",
                                      day: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
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
                        );
                      })}
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
