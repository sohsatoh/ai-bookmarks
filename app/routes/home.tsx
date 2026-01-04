import {
  Form,
  useNavigation,
  useRevalidator,
  useSubmit,
  redirect,
} from "react-router";
import { useEffect, useState, useRef } from "react";
import type { Route } from "./+types/home";
import { getDb, getAllBookmarks, getAllCategories } from "~/services/db.server";
import {
  initBroadcastChannel,
  broadcast,
  closeBroadcastChannel,
  type BroadcastMessage,
} from "~/utils/broadcast";
import { ToastContainer, type ToastMessage } from "~/components/Toast";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { BookmarkCardFull } from "~/components/BookmarkCardFull";
import { CategoryHeader } from "~/components/CategoryHeader";
import { UI_CONFIG } from "~/constants";
import type { BookmarkWithCategories } from "~/types/bookmark";
import { getSession, hasAdminRole } from "~/services/auth.server";
import {
  getClientIp,
  checkMutationRateLimit,
} from "~/services/rate-limit.server";
import { useDragAndDrop } from "~/hooks/useDragAndDrop";
import {
  handleToggleStar,
  handleToggleReadStatus,
  handleToggleArchive,
} from "~/actions/toggle-actions.server";
import {
  handleDelete,
  handleEdit,
  handleRefresh,
} from "~/actions/bookmark-crud-actions.server";
import {
  handleRefreshAll,
  handleReorderBookmarks,
  handleReorderCategories,
} from "~/actions/batch-actions.server";
import { handleAddBookmark } from "~/actions/add-bookmark-action.server";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "AI Bookmarks - 自動カテゴリ分類ブックマーク" },
    {
      name: "description",
      content: "AIによる自動カテゴリ分類ブックマーク管理",
    },
  ];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  // 認証チェック
  const session = await getSession(request, context);
  if (!session?.user) {
    return redirect("/");
  }

  const db = getDb(context.cloudflare.env.DB);

  const [bookmarksByCategory, allCategories] = await Promise.all([
    getAllBookmarks(db, session.user.id),
    getAllCategories(db),
  ]);

  // スター付きブックマークを収集
  const starredBookmarks = bookmarksByCategory.flatMap((major) =>
    major.minorCategories.flatMap((minor) =>
      minor.bookmarks.filter((b) => b.isStarred && !b.isArchived)
    )
  );

  return {
    bookmarksByCategory,
    starredBookmarks,
    allCategories,
    user: session.user,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  // 認証チェック（必須）
  const session = await getSession(request, context);
  if (!session?.user) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

  // CSRF対策: POSTリクエストのみ許可
  if (request.method !== "POST") {
    return { error: "無効なリクエストメソッドです" };
  }

  // CSRF対策: Originヘッダーチェック（開発環境では緩和）
  const origin = request.headers.get("Origin");
  const host = request.headers.get("Host");
  const isDevelopment =
    context.cloudflare.env.BETTER_AUTH_URL?.includes("localhost") ||
    context.cloudflare.env.BETTER_AUTH_URL?.includes("127.0.0.1");

  if (origin && host && new URL(origin).host !== host) {
    // 開発環境ではlocalhost/127.0.0.1の違いを許容
    if (!isDevelopment) {
      return { error: "不正なリクエスト元です" };
    }
    // 開発環境でも明らかに異なるオリジンは拒否
    const originUrl = new URL(origin);
    const isLocalOrigin =
      originUrl.hostname === "localhost" ||
      originUrl.hostname === "127.0.0.1" ||
      originUrl.hostname === host;
    if (!isLocalOrigin) {
      return { error: "不正なリクエスト元です" };
    }
  }

  // DoS対策: レート制限チェック（一般的な変更操作）
  const clientIp = getClientIp(request);
  const rateLimit = checkMutationRateLimit(clientIp, session.user.id);

  if (!rateLimit.allowed) {
    const resetInSeconds = Math.ceil(rateLimit.resetIn / 1000);
    const reason =
      rateLimit.reason === "ip"
        ? `このIPアドレス（残り${rateLimit.remaining}回）`
        : `このアカウント（残り${rateLimit.remaining}回）`;
    return {
      error: `${reason}からのリクエストが多すぎます。${resetInSeconds}秒後に再試行してください。`,
    };
  }

  const formData = await request.formData();
  const intent = formData.get("intent");
  const db = getDb(context.cloudflare.env.DB);

  // トグル系アクション
  if (intent === "toggleStar") {
    return handleToggleStar(formData, db, session.user.id);
  }
  if (intent === "toggleReadStatus") {
    return handleToggleReadStatus(formData, db, session.user.id);
  }
  if (intent === "toggleArchive") {
    return handleToggleArchive(formData, db, session.user.id);
  }

  // CRUD系アクション
  if (intent === "delete") {
    return handleDelete(formData, db, session.user.id);
  }
  if (intent === "edit") {
    return handleEdit(formData, db, session.user.id);
  }
  if (intent === "refresh") {
    return handleRefresh(
      formData,
      db,
      session.user.id,
      context.cloudflare.env.AI
    );
  }

  // バッチ系アクション（admin権限必須）
  if (intent === "refreshAll") {
    if (!hasAdminRole(session)) {
      return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
    }
    return handleRefreshAll(
      db,
      context.cloudflare.env.AI,
      context.cloudflare.ctx
    );
  }
  if (intent === "reorderBookmarks") {
    if (!hasAdminRole(session)) {
      return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
    }
    return handleReorderBookmarks(formData, db, session.user.id);
  }
  if (intent === "reorderCategories") {
    if (!hasAdminRole(session)) {
      return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
    }
    return handleReorderCategories(formData, db, session.user.id);
  }

  // ブックマーク追加処理（intentなし）
  return handleAddBookmark(
    formData,
    request,
    db,
    context.cloudflare.env.AI,
    session.user.id,
    context.cloudflare.ctx
  );
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const revalidator = useRevalidator();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [editingBookmark, setEditingBookmark] = useState<{
    id: number;
    title: string;
    description: string;
    majorCategory: string;
    minorCategory: string;
  } | null>(null);

  const [processingCount, setProcessingCount] = useState(0);
  const lastActionDataRef = useRef<typeof actionData | null>(null);
  const previousBookmarkCountRef = useRef(0);

  // 楽観的UI更新用（ローカルで即座に順序を変更）
  const [optimisticBookmarks, setOptimisticBookmarks] = useState(
    loaderData.bookmarksByCategory
  );

  // loaderDataが変更されたら楽観的stateも更新
  useEffect(() => {
    setOptimisticBookmarks(loaderData.bookmarksByCategory);
  }, [loaderData.bookmarksByCategory]);

  // 表示用データ（楽観的更新がある場合はそちらを優先）
  const displayBookmarks = optimisticBookmarks;

  // ドラッグ&ドロップ用のカスタムフック
  const {
    draggedItem,
    dragOverItem,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleMoveCategoryUp,
    handleMoveCategoryDown,
  } = useDragAndDrop({
    displayBookmarks,
    setOptimisticBookmarks,
    loaderDataBookmarks: loaderData.bookmarksByCategory,
    setToasts,
  });

  // 現在のブックマーク総数を計算
  const currentBookmarkCount = loaderData.bookmarksByCategory.reduce(
    (total, major) =>
      total +
      major.minorCategories.reduce(
        (sum, minor) => sum + minor.bookmarks.length,
        0
      ),
    0
  );

  // 処理中のブックマークがある場合、定期的にリフレッシュ
  useEffect(() => {
    if (processingCount > 0) {
      const interval = setInterval(() => {
        revalidator.revalidate();
      }, UI_CONFIG.POLLING_INTERVAL_MS);

      return () => clearInterval(interval);
    }
  }, [processingCount, revalidator]);

  // Broadcast Channelの初期化（タブ間同期）
  useEffect(() => {
    initBroadcastChannel((message: BroadcastMessage) => {
      // eslint-disable-next-line no-console
      console.log("他のタブからの更新を検知:", message);

      // 他のタブで変更があったらデータを再読み込み
      revalidator.revalidate();

      // 通知トーストを表示
      const toastId = Date.now().toString();
      let toastMessage = "他のタブでデータが更新されました";

      if (message.type === "bookmark-added") {
        toastMessage = "ブックマークが追加されました";
      } else if (message.type === "bookmark-deleted") {
        toastMessage = "ブックマークが削除されました";
      } else if (
        message.type === "bookmark-reordered" ||
        message.type === "category-reordered"
      ) {
        toastMessage = "順番が変更されました";
      }

      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: "info",
          title: "同期",
          message: toastMessage,
        },
      ]);
    });

    return () => {
      closeBroadcastChannel();
    };
  }, [revalidator]);

  // ブックマーク数の変化を検出して完了トーストを表示
  useEffect(() => {
    if (
      processingCount > 0 &&
      currentBookmarkCount > previousBookmarkCountRef.current
    ) {
      // 新しいブックマークが追加された
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: "success" as const,
          title: "完了",
          message: "ブックマークの追加が完了しました",
        },
      ]);
      setProcessingCount((prev) => Math.max(0, prev - 1));
    }
    previousBookmarkCountRef.current = currentBookmarkCount;
  }, [currentBookmarkCount, processingCount]);

  // 新しく追加されたブックマークのアニメーションとトースト
  useEffect(() => {
    if (
      actionData &&
      !isSubmitting &&
      actionData !== lastActionDataRef.current
    ) {
      lastActionDataRef.current = actionData;

      // エラー時や競合時は楽観的stateをリセット
      const hasError = "error" in actionData;
      const hasToast =
        "toast" in actionData &&
        actionData.toast !== null &&
        typeof actionData.toast === "object";
      const hasWarningToast =
        hasToast &&
        actionData.toast !== null &&
        typeof actionData.toast === "object" &&
        "type" in actionData.toast &&
        actionData.toast.type === "warning";
      if (hasError || hasWarningToast) {
        setOptimisticBookmarks(loaderData.bookmarksByCategory);
      }

      // フォームをクリア（すぐに次の入力が可能）
      if (formRef.current) {
        formRef.current.reset();
      }

      // 結果トーストを表示
      if (hasToast && actionData.toast) {
        const toastId = Date.now().toString();
        const toast = actionData.toast as ToastMessage;
        setToasts((prev) => [
          ...prev,
          {
            ...toast,
            id: toastId,
          },
        ]);
      }

      if (actionData.success) {
        // Broadcast: 他のタブに変更を通知
        const intent = "intent" in actionData ? actionData.intent : undefined;
        if (intent === "add" && "bookmarkId" in actionData) {
          broadcast({
            type: "bookmark-added",
            bookmarkId: actionData.bookmarkId as number,
          });
        } else if (intent === "delete" && "bookmarkId" in actionData) {
          broadcast({
            type: "bookmark-deleted",
            bookmarkId: actionData.bookmarkId as number,
          });
        } else if (
          intent === "reorderBookmarks" &&
          "bookmarkId" in actionData
        ) {
          broadcast({
            type: "bookmark-reordered",
            bookmarkId: actionData.bookmarkId as number,
            newOrder: 0,
          });
        } else if (
          intent === "reorderCategories" &&
          "categoryId" in actionData
        ) {
          broadcast({
            type: "category-reordered",
            categoryId: actionData.categoryId as number,
            newOrder: 0,
          });
        } else if (
          intent &&
          typeof intent === "string" &&
          [
            "toggleStar",
            "toggleReadStatus",
            "toggleArchive",
            "refresh",
            "edit",
          ].includes(intent)
        ) {
          const bookmarkId = (
            "bookmarkId" in actionData ? actionData.bookmarkId : 0
          ) as number;
          broadcast({ type: "bookmark-updated", bookmarkId });
        }

        // 処理中の場合、カウントを増やして定期リフレッシュを開始
        const processing =
          "processing" in actionData ? actionData.processing : false;
        if (processing) {
          setProcessingCount((prev) => prev + 1);

          // 30秒後にタイムアウトと見なして定期リフレッシュを停止
          const timeoutId = setTimeout(() => {
            setProcessingCount((prev) => Math.max(0, prev - 1));
            revalidator.revalidate();
          }, 30000);

          return () => clearTimeout(timeoutId);
        } else {
          // 即座に完了した場合
          revalidator.revalidate();
        }
      }
    }
  }, [actionData, isSubmitting, revalidator, loaderData.bookmarksByCategory]);

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black transition-colors duration-500">
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* ヘッダー */}
      <Header user={loaderData.user} />

      {/* ナビゲーションバー風ヘッダー */}
      <div className="sticky top-0 z-30 bg-[#F5F5F7]/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Bookmarks
          </h1>

          {/* 一括更新ボタン */}
          <Form method="post">
            <input type="hidden" name="intent" value="refreshAll" />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              title="すべてのブックマーク情報を更新"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isSubmitting ? "更新中..." : "すべて更新"}
            </button>
          </Form>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 py-12">
        <div className="flex gap-8">
          {/* 左サイドバー - カテゴリTOC */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-2">
              <h3 className="text-xs lg:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 px-3">
                Categories
              </h3>
              <nav className="space-y-1">
                {displayBookmarks.map((major) => (
                  <div key={major.majorCategory}>
                    <a
                      href={`#${major.majorCategory}`}
                      className="block px-3 py-2 text-sm lg:text-base font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      {major.majorCategory}
                      <span className="ml-2 text-xs lg:text-sm text-gray-400">
                        (
                        {major.minorCategories.reduce(
                          (sum, minor) => sum + minor.bookmarks.length,
                          0
                        )}
                        )
                      </span>
                    </a>
                    {/* 小カテゴリ */}
                    <div className="ml-4 mt-1 space-y-0.5">
                      {major.minorCategories.map((minor) => (
                        <a
                          key={minor.minorCategory}
                          href={`#${major.majorCategory}-${minor.minorCategory}`}
                          className="block px-3 py-1.5 text-xs lg:text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-md transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                            {minor.minorCategory}
                            <span className="text-[10px] lg:text-xs text-gray-400">
                              ({minor.bookmarks.length})
                            </span>
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          {/* メインコンテンツ */}
          <main className="flex-1 min-w-0">
            {/* ヒーローセクション */}
            <header className="mb-12 text-center sm:text-left">
              <h2 className="text-4xl sm:text-5xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-4 tracking-tight leading-tight">
                Organize your web, <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
                  intelligently.
                </span>
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed">
                AIがあなたのブックマークを自動で整理。
              </p>
            </header>

            {/* URL入力フォーム - iOS検索バー風 */}
            <div className="mb-16 relative z-20">
              <Form method="post" className="relative group" ref={formRef}>
                <input type="hidden" name="intent" value="add" />
                <div className="relative transition-transform duration-300 ease-out group-focus-within:scale-[1.02]">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <input
                    type="url"
                    id="url"
                    name="url"
                    placeholder="https://example.com"
                    required
                    disabled={isSubmitting}
                    className="block w-full pl-11 pr-32 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 shadow-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none text-lg transition-all"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-[#0071e3] hover:bg-[#0077ED] text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {isSubmitting ? (
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
                      ) : (
                        "Add"
                      )}
                    </button>
                  </div>
                </div>

                {/* エラー・成功メッセージ */}
                <div className="absolute top-full left-0 right-0 mt-2 px-2">
                  {actionData?.error && (
                    <p className="text-red-500 text-sm animate-fade-in pl-2">
                      {actionData.error}
                    </p>
                  )}
                  {actionData?.success && (
                    <p className="text-green-500 text-sm animate-fade-in pl-2">
                      Added successfully
                    </p>
                  )}
                </div>
              </Form>
            </div>

            {/* ブックマーク一覧 */}
            {loaderData.bookmarksByCategory.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No bookmarks yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Add a URL above to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-16">
                {/* Pinnedセクション */}
                {loaderData.starredBookmarks.length > 0 && (
                  <div id="pinned" className="space-y-8 scroll-mt-24">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-yellow-500 dark:text-yellow-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <h2 className="text-xl sm:text-2xl md:text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                        Pinned
                      </h2>
                      <span className="text-sm text-gray-400">
                        ({loaderData.starredBookmarks.length})
                      </span>
                    </div>

                    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {loaderData.starredBookmarks.map((bookmark, index) => (
                        <BookmarkCardFull
                          key={bookmark.id}
                          bookmark={bookmark}
                          index={index}
                          isDragging={
                            draggedItem?.type === "bookmark" &&
                            draggedItem.id === bookmark.id
                          }
                          isDragOver={
                            dragOverItem?.type === "bookmark" &&
                            dragOverItem.id === bookmark.id
                          }
                          dragOverPosition={dragOverItem?.position}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          onDragEnd={handleDragEnd}
                          onEdit={setEditingBookmark}
                          isPinned={true}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {displayBookmarks.map((major, majorIndex) => {
                  return (
                    <div
                      key={major.majorCategory}
                      id={major.majorCategory}
                      className="space-y-8 scroll-mt-24 relative"
                    >
                      <CategoryHeader
                        majorCategory={major.majorCategory}
                        majorIndex={majorIndex}
                        totalCategories={displayBookmarks.length}
                        onMoveUp={() =>
                          handleMoveCategoryUp(
                            major.majorCategoryId,
                            majorIndex
                          )
                        }
                        onMoveDown={() =>
                          handleMoveCategoryDown(
                            major.majorCategoryId,
                            majorIndex
                          )
                        }
                      />

                      {major.minorCategories.map((minor) => (
                        <div
                          key={minor.minorCategory}
                          id={`${major.majorCategory}-${minor.minorCategory}`}
                          className="space-y-4 scroll-mt-24"
                        >
                          <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-2">
                            {minor.minorCategory}
                          </h3>

                          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {minor.bookmarks.map((bookmark, index) => (
                              <BookmarkCardFull
                                key={bookmark.id}
                                bookmark={bookmark}
                                index={index}
                                isDragging={
                                  draggedItem?.type === "bookmark" &&
                                  draggedItem.id === bookmark.id
                                }
                                isDragOver={
                                  dragOverItem?.type === "bookmark" &&
                                  dragOverItem.id === bookmark.id
                                }
                                dragOverPosition={dragOverItem?.position}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onDragEnd={handleDragEnd}
                                categoryId={minor.minorCategoryId}
                                isPinned={false}
                                onEdit={setEditingBookmark}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* 編集モーダル */}
      {editingBookmark && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setEditingBookmark(null)}
        >
          <div
            className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
                  Edit Bookmark
                </h2>
                <button
                  onClick={() => setEditingBookmark(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <Form method="post" onSubmit={() => setEditingBookmark(null)}>
                <input type="hidden" name="intent" value="edit" />
                <input
                  type="hidden"
                  name="bookmarkId"
                  value={editingBookmark.id}
                />

                <div className="space-y-6">
                  <div>
                    <label
                      htmlFor="edit-title"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1"
                    >
                      Title
                    </label>
                    <input
                      id="edit-title"
                      name="title"
                      type="text"
                      defaultValue={editingBookmark.title}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-description"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1"
                    >
                      Description
                    </label>
                    <textarea
                      id="edit-description"
                      name="description"
                      rows={4}
                      defaultValue={editingBookmark.description}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="edit-major-category"
                        className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1"
                      >
                        Category
                      </label>
                      <select
                        id="edit-major-category"
                        name="majorCategory"
                        value={editingBookmark.majorCategory}
                        onChange={(e) =>
                          setEditingBookmark({
                            ...editingBookmark,
                            majorCategory: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                      >
                        <option value="">選択してください</option>
                        {loaderData.allCategories
                          ?.filter((c) => c.type === "major")
                          .map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="edit-minor-category"
                        className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1"
                      >
                        Subcategory
                      </label>
                      <select
                        id="edit-minor-category"
                        name="minorCategory"
                        value={editingBookmark.minorCategory}
                        onChange={(e) =>
                          setEditingBookmark({
                            ...editingBookmark,
                            minorCategory: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                      >
                        <option value="">選択してください</option>
                        {loaderData.allCategories
                          ?.filter((c) => c.type === "minor")
                          .map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-6">
                    <button
                      type="button"
                      onClick={() => setEditingBookmark(null)}
                      className="px-6 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl text-white bg-[#0071e3] hover:bg-[#0077ED] font-medium transition-colors shadow-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </Form>
            </div>
          </div>
        </div>
      )}

      {/* フッター */}
      <Footer />
    </div>
  );
}
