import { Form, useNavigation, useSearchParams, useRevalidator } from "react-router";
import { useEffect, useState, useRef } from "react";
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
import { ToastContainer, type ToastMessage } from "~/components/Toast";

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

  // ソート処理（スターアイテムを優先）
  const sortedBookmarksByCategory = bookmarksByCategory.map((major) => ({
    ...major,
    minorCategories: major.minorCategories.map((minor) => ({
      ...minor,
      bookmarks: [...minor.bookmarks].sort((a, b) => {
        // スターアイテムを最優先
        if (a.isStarred !== b.isStarred) {
          return a.isStarred ? -1 : 1;
        }
        
        // スターが同じ場合、ユーザー指定のソートを適用
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

  // スターのトグル処理
  if (intent === "toggleStar") {
    const bookmarkId = formData.get("bookmarkId");
    const currentStarred = formData.get("isStarred");
    
    // 入力検証
    if (!bookmarkId || typeof bookmarkId !== "string") {
      return { error: "無効なリクエストです" };
    }

    const id = Number(bookmarkId);
    if (isNaN(id) || id <= 0) {
      return { error: "無効なIDです" };
    }

    try {
      // スター状態を反転
      await db
        .update(bookmarks)
        .set({
          isStarred: currentStarred === "true" ? false : true,
        })
        .where(eq(bookmarks.id, id));
      return { success: true };
    } catch (error) {
      console.error("Toggle star failed:", error);
      return { error: "スターの更新に失敗しました" };
    }
  }

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
    // 1. ページメタデータ取得（高速）
    const { title, description, content } = await fetchPageMetadata(url);

    // 2. バックグラウンドでAI処理とDB保存を実行
    context.cloudflare.ctx.waitUntil(
      (async () => {
        try {
          console.log("[Background] Starting AI processing for:", url);
          
          // 既存カテゴリ取得
          const existingCategories = await getExistingCategories(db);

          // AIでメタデータ生成
          const metadata = await generateBookmarkMetadata(
            context.cloudflare.env.AI,
            url,
            title,
            description,
            content,
            existingCategories
          );

          console.log("[Background] AI processing completed, saving to DB");

          // カテゴリを取得または作成
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

          // ブックマーク作成
          await createBookmark(db, {
            url: url,
            title,
            description: metadata.description,
            majorCategoryId,
            minorCategoryId,
          });

          console.log("[Background] Bookmark saved successfully");
        } catch (error) {
          console.error("[Background] Failed to process bookmark:", error);
        }
      })()
    );

    // 3. すぐにレスポンスを返す（処理中状態）
    return {
      success: true,
      processing: true,
      toast: {
        type: "info" as const,
        title: "処理中",
        message: `${title} を追加しています...`,
      },
    };
  } catch (error) {
    console.error("Failed to fetch page metadata:", error);
    return {
      error: error instanceof Error ? error.message : "ページ情報の取得に失敗しました",
      toast: {
        type: "error" as const,
        title: "エラー",
        message: error instanceof Error ? error.message : "ページ情報の取得に失敗しました",
      },
    };
  }
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [justAdded, setJustAdded] = useState<number[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const currentSortBy = loaderData.sortBy;
  const currentSortOrder = loaderData.sortOrder;
  const [processingCount, setProcessingCount] = useState(0);
  
  // 処理中のブックマークがある場合、定期的にリフレッシュ
  useEffect(() => {
    if (processingCount > 0) {
      const interval = setInterval(() => {
        revalidator.revalidate();
      }, 5000); // 5秒ごとにリフレッシュ
      
      return () => clearInterval(interval);
    }
  }, [processingCount, revalidator]);
  
  // 新しく追加されたブックマークのアニメーションとトースト
  useEffect(() => {
    if (actionData && !isSubmitting) {
      // フォームをクリア（すぐに次の入力が可能）
      if (formRef.current) {
        formRef.current.reset();
      }
      
      // 結果トーストを表示
      if (actionData.toast) {
        const toastId = Date.now().toString();
        setToasts(prev => [...prev, {
          id: toastId,
          ...actionData.toast,
        }]);
      }
      
      if (actionData.success) {
        // 処理中の場合、カウントを増やして定期リフレッシュを開始
        if (actionData.processing) {
          setProcessingCount(prev => prev + 1);
          
          // 30秒後に処理完了と見なして定期リフレッシュを停止
          setTimeout(() => {
            setProcessingCount(prev => Math.max(0, prev - 1));
            revalidator.revalidate();
          }, 30000);
        } else {
          // 即座に完了した場合
          revalidator.revalidate();
        }
      }
    }
  }, [actionData, isSubmitting, revalidator]);
  
  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-12">
        {/* ヘッダー */}
        <header className="mb-12">
          <h1 className="text-4xl font-semibold text-gray-900 dark:text-white mb-3 tracking-tight">
            Bookmarks
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            自動カテゴリ分類ブックマーク管理システム
          </p>
        </header>

        {/* ソート機能 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              並び替え
            </span>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleSortChange("date")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  currentSortBy === "date"
                    ? "bg-blue-500 text-white shadow-md"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                日付
                {currentSortBy === "date" && (
                  <span className="ml-1">{currentSortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
              <button
                onClick={() => handleSortChange("title")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  currentSortBy === "title"
                    ? "bg-blue-500 text-white shadow-md"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                タイトル
                {currentSortBy === "title" && (
                  <span className="ml-1">{currentSortOrder === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
              <button
                onClick={() => handleSortChange("url")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  currentSortBy === "url"
                    ? "bg-blue-500 text-white shadow-md"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 mb-10">
          <Form method="post" className="space-y-5" ref={formRef}>
            <input type="hidden" name="intent" value="add" />
            <div>
              <label
                htmlFor="url"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"
              >
                新規ブックマーク
              </label>
              <div className="flex gap-3 flex-col sm:flex-row">
                <input
                  type="url"
                  id="url"
                  name="url"
                  placeholder="https://example.com"
                  required
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-base text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white text-base font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap shadow-sm hover:shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
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
                      処理中
                    </>
                  ) : (
                    "追加"
                  )}
                </button>
              </div>
            </div>

            {/* エラー・成功メッセージ */}
            {actionData?.error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <p className="text-red-700 dark:text-red-200 text-sm">
                  {actionData.error}
                </p>
              </div>
            )}
            {actionData?.success && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-green-700 dark:text-green-200 text-sm">
                  ブックマークを追加しました
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
          <div className="space-y-12">
            {loaderData.bookmarksByCategory.map((major) => (
              <div key={major.majorCategory} className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                  {major.majorCategory}
                </h2>

                {major.minorCategories.map((minor) => (
                  <div key={minor.minorCategory} className="space-y-4">
                    <h3 className="text-base font-medium text-gray-600 dark:text-gray-400 pl-4 border-l-4 border-blue-500">
                      {minor.minorCategory}
                    </h3>

                    <div className="grid gap-3 sm:grid-cols-1">
                      {minor.bookmarks.map((bookmark) => {
                        return (
                        <div
                          key={bookmark.id}
                          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-6 group"
                        >
                          <div className="flex items-start justify-between gap-6">
                            <div className="flex-1 min-w-0 flex gap-4">
                              {/* Favicon */}
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`}
                                alt=""
                                className="w-8 h-8 rounded-lg flex-shrink-0 mt-0.5"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              
                              <a
                                href={bookmark.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-w-0 block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                              >
                                <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-3 line-clamp-2 leading-snug">
                                  {bookmark.title}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4 leading-relaxed">
                                  {bookmark.description}
                                </p>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                                  <span className="truncate break-all font-mono">
                                    {bookmark.url}
                                  </span>
                                  <span className="shrink-0 flex items-center gap-1.5">
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

                            <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                              {/* スターボタン */}
                              <Form method="post">
                                <input type="hidden" name="intent" value="toggleStar" />
                                <input type="hidden" name="bookmarkId" value={bookmark.id} />
                                <input type="hidden" name="isStarred" value={bookmark.isStarred.toString()} />
                                <button
                                  type="submit"
                                  className="p-2 text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                  title={bookmark.isStarred ? "スターを外す" : "スターを付ける"}
                                >
                                  {bookmark.isStarred ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 dark:text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                  )}
                                </button>
                              </Form>
                              
                              {/* 削除ボタン */}
                              <Form method="post">
                                <input type="hidden" name="intent" value="delete" />
                                <input
                                  type="hidden"
                                  name="bookmarkId"
                                  value={bookmark.id}
                                />
                                <button
                                  type="submit"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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
