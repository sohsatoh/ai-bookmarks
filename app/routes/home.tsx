import {
  Form,
  useNavigation,
  useRevalidator,
  useSubmit,
  redirect,
} from "react-router";
import { useEffect, useState, useRef } from "react";
import type { Route } from "./+types/home";
import {
  getDb,
  getAllBookmarks,
  getOrCreateCategory,
  getExistingCategories,
  getAllCategories,
  checkDuplicateUrl,
  deleteBookmark,
  updateBookmarkOrder,
  updateCategoryOrder,
  getOrCreateUrl,
  getUrlMetadata,
  createUserBookmark,
} from "~/services/db.server";
import { userBookmarks, urls } from "~/db/schema";
import { and, eq } from "drizzle-orm";
import { generateBookmarkMetadata } from "~/services/ai.server";
import { fetchPageMetadata, validateUrl } from "~/services/scraper.server";
import {
  getClientIp,
  checkMutationRateLimit,
  checkBookmarkAddRateLimit,
} from "~/services/rate-limit.server";
import {
  initBroadcastChannel,
  broadcast,
  closeBroadcastChannel,
  type BroadcastMessage,
} from "~/utils/broadcast";
import { ToastContainer, type ToastMessage } from "~/components/Toast";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { UI_CONFIG } from "~/constants";
import type { BookmarkWithCategories } from "~/types/bookmark";
import { getSession, hasAdminRole } from "~/services/auth.server";

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
  // 認証チェック
  const session = await getSession(request, context);
  if (!session?.user) {
    return redirect("/login");
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

  // スターのトグル処理
  if (intent === "toggleStar") {
    const bookmarkId = formData.get("bookmarkId");
    const currentStarred = formData.get("isStarred");

    // 入力検証
    if (!bookmarkId || typeof bookmarkId !== "string") {
      return { error: "無効なリクエストです" };
    }

    const id = Number(bookmarkId);
    if (Number.isNaN(id) || id <= 0) {
      return { error: "無効なリクエストです" };
    }

    try {
      // スター状態を反転（userIdフィルタで認可チェック）
      const result = await db
        .update(userBookmarks)
        .set({
          isStarred: currentStarred !== "true",
        })
        .where(
          and(
            eq(userBookmarks.id, id),
            eq(userBookmarks.userId, session.user.id)
          )
        )
        .returning();

      if (result.length === 0) {
        console.error(
          "Bookmark not found or unauthorized:",
          id,
          session.user.id
        );
        return { error: "処理に失敗しました" };
      }

      return { success: true };
    } catch (error) {
      console.error("Toggle star failed:", error);
      return { error: "処理に失敗しました" };
    }
  }

  // 読了ステータスのトグル処理
  if (intent === "toggleReadStatus") {
    const bookmarkId = formData.get("bookmarkId");
    const currentStatus = formData.get("readStatus");

    if (!bookmarkId || typeof bookmarkId !== "string") {
      return { error: "無効なリクエストです" };
    }

    const id = Number(bookmarkId);
    if (Number.isNaN(id) || id <= 0) {
      return { error: "無効なリクエストです" };
    }

    try {
      const result = await db
        .update(userBookmarks)
        .set({
          readStatus: currentStatus === "read" ? "unread" : "read",
        })
        .where(
          and(
            eq(userBookmarks.id, id),
            eq(userBookmarks.userId, session.user.id)
          )
        )
        .returning();

      if (result.length === 0) {
        console.error(
          "Bookmark not found or unauthorized:",
          id,
          session.user.id
        );
        return { error: "処理に失敗しました" };
      }

      return { success: true };
    } catch (error) {
      console.error("Toggle read status failed:", error);
      return { error: "処理に失敗しました" };
    }
  }

  // アーカイブのトグル処理
  if (intent === "toggleArchive") {
    const bookmarkId = formData.get("bookmarkId");
    const currentArchived = formData.get("isArchived");

    if (!bookmarkId || typeof bookmarkId !== "string") {
      return { error: "無効なリクエストです" };
    }

    const id = Number(bookmarkId);
    if (Number.isNaN(id) || id <= 0) {
      return { error: "無効なリクエストです" };
    }

    try {
      const result = await db
        .update(userBookmarks)
        .set({
          isArchived: currentArchived !== "true",
        })
        .where(
          and(
            eq(userBookmarks.id, id),
            eq(userBookmarks.userId, session.user.id)
          )
        )
        .returning();

      if (result.length === 0) {
        console.error(
          "Bookmark not found or unauthorized:",
          id,
          session.user.id
        );
        return { error: "処理に失敗しました" };
      }

      return { success: true };
    } catch (error) {
      console.error("Toggle archive failed:", error);
      return { error: "処理に失敗しました" };
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
    if (Number.isNaN(id) || id <= 0) {
      return { error: "無効なリクエストです" };
    }

    try {
      await deleteBookmark(db, session.user.id, id);
      return { success: true };
    } catch (error) {
      console.error("Delete failed:", error);
      return { error: "処理に失敗しました" };
    }
  }

  // 編集処理
  if (intent === "edit") {
    const bookmarkId = formData.get("bookmarkId");
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const majorCategory = formData.get("majorCategory") as string;
    const minorCategory = formData.get("minorCategory") as string;

    // 入力検証
    if (!bookmarkId || typeof bookmarkId !== "string") {
      return { error: "無効なリクエストです" };
    }

    const id = Number(bookmarkId);
    if (Number.isNaN(id) || id <= 0) {
      return { error: "無効なリクエストです" };
    }

    if (!title || !description || !majorCategory || !minorCategory) {
      return { error: "すべての項目を入力してください" };
    }

    try {
      // カテゴリを取得または作成（userIdパラメータなし）
      const majorCategoryId = await getOrCreateCategory(
        db,
        majorCategory,
        "major"
      );
      const minorCategoryId = await getOrCreateCategory(
        db,
        minorCategory,
        "minor",
        majorCategoryId
      );

      // ユーザーブックマークから対応するURLを取得
      const userBookmark = await db
        .select()
        .from(userBookmarks)
        .where(
          and(
            eq(userBookmarks.id, id),
            eq(userBookmarks.userId, session.user.id)
          )
        )
        .limit(1);

      if (userBookmark.length === 0) {
        console.error(
          "Bookmark not found or unauthorized:",
          id,
          session.user.id
        );
        return { error: "処理に失敗しました" };
      }

      // URLマスターテーブルを更新（メタデータ部分）
      await db
        .update(urls)
        .set({
          title: title.slice(0, 500),
          description: description.slice(0, 1000),
          majorCategoryId,
          minorCategoryId,
          updatedAt: new Date(),
        })
        .where(eq(urls.id, userBookmark[0].urlId));

      return {
        success: true,
        toast: {
          type: "success" as const,
          title: "更新完了",
          message: "ブックマークを更新しました",
        },
      };
    } catch (error) {
      console.error("Edit failed:", error);
      return { error: "処理に失敗しました" };
    }
  }

  // 情報更新処理（AIで再生成）
  if (intent === "refresh") {
    const bookmarkId = formData.get("bookmarkId");

    if (!bookmarkId || typeof bookmarkId !== "string") {
      return { error: "無効なリクエストです" };
    }

    const id = Number(bookmarkId);
    if (Number.isNaN(id) || id <= 0) {
      return { error: "無効なリクエストです" };
    }

    try {
      // 既存ブックマーク情報を取得（userBookmarksとurlsを結合）
      const existingBookmark = await db
        .select({
          userBookmark: userBookmarks,
          url: urls,
        })
        .from(userBookmarks)
        .innerJoin(urls, eq(userBookmarks.urlId, urls.id))
        .where(
          and(
            eq(userBookmarks.id, id),
            eq(userBookmarks.userId, session.user.id)
          )
        )
        .limit(1);

      if (existingBookmark.length === 0) {
        console.error("Bookmark not found:", id);
        return { error: "処理に失敗しました" };
      }

      const bookmark = existingBookmark[0];

      // ページメタデータを再取得
      const { title, description, content } = await fetchPageMetadata(
        bookmark.url.url
      );

      // 既存カテゴリ取得（userIdパラメータなし）
      const existingCategories = await getExistingCategories(db);

      // AIでメタデータ生成
      const metadata = await generateBookmarkMetadata(
        context.cloudflare.env.AI,
        bookmark.url.url,
        title,
        description,
        content,
        existingCategories
      );

      // カテゴリを取得または作成（userIdパラメータなし）
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

      // URLマスターテーブルを更新
      await db
        .update(urls)
        .set({
          title,
          description: metadata.description,
          majorCategoryId,
          minorCategoryId,
          updatedAt: new Date(),
        })
        .where(eq(urls.id, bookmark.url.id));

      return {
        success: true,
        toast: {
          type: "success" as const,
          title: "更新完了",
          message: "ブックマーク情報を更新しました",
        },
      };
    } catch (error) {
      console.error("Refresh failed:", error);
      return {
        error: "処理に失敗しました",
        toast: {
          type: "error" as const,
          title: "エラー",
          message: "処理に失敗しました",
        },
      };
    }
  }

  // すべてのブックマーク情報を一括更新
  if (intent === "refreshAll") {
    // admin権限チェック
    if (!hasAdminRole(session)) {
      return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    try {
      // すべてのURLマスターを取得
      const allUrls = await db.select().from(urls);

      if (allUrls.length === 0) {
        return {
          error: "更新するブックマークがありません",
          toast: {
            type: "info" as const,
            title: "情報",
            message: "更新するブックマークがありません",
          },
        };
      }

      // バックグラウンドで処理
      context.cloudflare.ctx.waitUntil(
        (async () => {
          // eslint-disable-next-line no-console
          console.log(
            `[Refresh All] Starting batch update for ${allUrls.length} URLs`
          );

          // 既存カテゴリ取得（userIdパラメータなし）
          const existingCategories = await getExistingCategories(db);
          let successCount = 0;
          let errorCount = 0;

          for (const urlData of allUrls) {
            try {
              // eslint-disable-next-line no-console
              console.log(`[Refresh All] Processing: ${urlData.url}`);

              // ページメタデータを再取得
              const { title, description, content } = await fetchPageMetadata(
                urlData.url
              );

              // AIでメタデータ生成
              const metadata = await generateBookmarkMetadata(
                context.cloudflare.env.AI,
                urlData.url,
                title,
                description,
                content,
                existingCategories
              );

              // カテゴリを取得または作成（userIdパラメータなし）
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

              // URLマスターテーブルを更新
              await db
                .update(urls)
                .set({
                  title,
                  description: metadata.description,
                  majorCategoryId,
                  minorCategoryId,
                  updatedAt: new Date(),
                })
                .where(eq(urls.id, urlData.id));

              successCount++;
              // eslint-disable-next-line no-console
              console.log(`[Refresh All] Success: ${urlData.url}`);

              // レート制限を考慮して少し待機
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (error) {
              errorCount++;
              console.error(`[Refresh All] Failed for ${urlData.url}:`, error);
            }
          }

          // eslint-disable-next-line no-console
          console.log(
            `[Refresh All] Completed: ${successCount} succeeded, ${errorCount} failed`
          );
        })()
      );

      return {
        success: true,
        toast: {
          type: "info" as const,
          title: "一括更新を開始",
          message: `${allUrls.length}件のブックマークを更新しています...`,
        },
      };
    } catch (error) {
      console.error("Refresh all failed:", error);
      return {
        error: "処理に失敗しました",
        toast: {
          type: "error" as const,
          title: "エラー",
          message: "処理に失敗しました",
        },
      };
    }
  }

  // ブックマークの並び替え処理
  if (intent === "reorderBookmarks") {
    // admin権限チェック
    if (!hasAdminRole(session)) {
      return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    try {
      const ordersJson = formData.get("orders") as string;
      if (!ordersJson) {
        return {
          error: "並び替え情報が不正です",
          toast: {
            type: "error" as const,
            title: "エラー",
            message: "並び替え情報が不正です",
          },
        };
      }

      // JSON.parseの検証（例外処理、型チェック、配列長制限）
      let parsed: unknown;
      try {
        parsed = JSON.parse(ordersJson);
      } catch {
        return {
          error: "並び替え情報の形式が不正です",
          toast: {
            type: "error" as const,
            title: "エラー",
            message: "データ形式が不正です",
          },
        };
      }

      if (!Array.isArray(parsed)) {
        return { error: "無効なデータ形式です" };
      }

      if (parsed.length > 1000) {
        return { error: "並び替え可能なアイテム数を超えています" };
      }

      // 各要素の検証
      const orders: Array<{ id: number; order: number }> = [];
      for (const item of parsed) {
        if (typeof item !== "object" || item === null) {
          return { error: "無効なアイテム形式です" };
        }

        const id = Number((item as { id?: unknown }).id);
        const order = Number((item as { order?: unknown }).order);

        if (!Number.isInteger(id) || id <= 0) {
          return { error: "無効なIDが含まれています" };
        }

        if (!Number.isInteger(order) || order < 0) {
          return { error: "無効な順序が含まれています" };
        }

        orders.push({ id, order });
      }

      // 各ブックマークの順序を更新（バージョンチェック付き）
      const results = await Promise.all(
        orders.map(({ id, order }) =>
          updateBookmarkOrder(db, session.user.id, id, order)
        )
      );

      // 失敗があれば競合エラーを返す
      const failed = results.find((r) => !r.success);
      if (failed) {
        return {
          error: "並び替え中に競合が発生しました",
          toast: {
            type: "warning" as const,
            title: "競合検知",
            message: "他のタブで変更されました。ページを再読み込みしてください",
          },
        };
      }

      return {
        success: true,
        intent: "reorderBookmarks",
        toast: {
          type: "success" as const,
          title: "成功",
          message: "並び替えが完了しました",
        },
      };
    } catch (error) {
      console.error("Reorder bookmarks failed:", error);
      return {
        error: "処理に失敗しました",
        toast: {
          type: "error" as const,
          title: "エラー",
          message: "処理に失敗しました",
        },
      };
    }
  }

  // カテゴリの並び替え処理
  if (intent === "reorderCategories") {
    // admin権限チェック
    if (!hasAdminRole(session)) {
      return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    try {
      const ordersJson = formData.get("orders") as string;
      if (!ordersJson) {
        return {
          error: "並び替え情報が不正です",
          toast: {
            type: "error" as const,
            title: "エラー",
            message: "並び替え情報が不正です",
          },
        };
      }

      // JSON.parseの検証（例外処理、型チェック、配列長制限）
      let parsed: unknown;
      try {
        parsed = JSON.parse(ordersJson);
      } catch {
        return {
          error: "並び替え情報の形式が不正です",
          toast: {
            type: "error" as const,
            title: "エラー",
            message: "データ形式が不正です",
          },
        };
      }

      if (!Array.isArray(parsed)) {
        return { error: "無効なデータ形式です" };
      }

      if (parsed.length > 1000) {
        return { error: "並び替え可能なアイテム数を超えています" };
      }

      // 各要素の検証
      const orders: Array<{ id: number; order: number }> = [];
      for (const item of parsed) {
        if (typeof item !== "object" || item === null) {
          return { error: "無効なアイテム形式です" };
        }

        const id = Number((item as { id?: unknown }).id);
        const order = Number((item as { order?: unknown }).order);

        if (!Number.isInteger(id) || id <= 0) {
          return { error: "無効なIDが含まれています" };
        }

        if (!Number.isInteger(order) || order < 0) {
          return { error: "無効な順序が含まれています" };
        }

        orders.push({ id, order });
      }

      // 各カテゴリの順序を更新（バージョンチェック付き）
      const results = await Promise.all(
        orders.map(({ id, order }) =>
          updateCategoryOrder(db, session.user.id, id, order)
        )
      );

      // 失敗があれば競合エラーを返す
      const failed = results.find((r) => !r.success);
      if (failed) {
        return {
          error: "並び替え中に競合が発生しました",
          toast: {
            type: "warning" as const,
            title: "競合検知",
            message: "他のタブで変更されました。ページを再読み込みしてください",
          },
        };
      }

      return {
        success: true,
        intent: "reorderCategories",
        toast: {
          type: "success" as const,
          title: "成功",
          message: "カテゴリの並び替えが完了しました",
        },
      };
    } catch (error) {
      console.error("Reorder categories failed:", error);
      return {
        error: "処理に失敗しました",
        toast: {
          type: "error" as const,
          title: "エラー",
          message: "処理に失敗しました",
        },
      };
    }
  }

  // ブックマーク追加処理
  const url = formData.get("url") as string;

  // AI処理を含むため、専用のレート制限チェック
  const bookmarkAddRateLimit = checkBookmarkAddRateLimit(
    clientIp,
    session.user.id
  );
  if (!bookmarkAddRateLimit.allowed) {
    const resetInSeconds = Math.ceil(bookmarkAddRateLimit.resetIn / 1000);
    const reason =
      bookmarkAddRateLimit.reason === "ip"
        ? "このIPアドレスから"
        : "このアカウントで";
    return {
      error: `${reason}のブックマーク追加が多すぎます（AI処理制限）。${resetInSeconds}秒後に再試行してください。`,
    };
  }

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
  const duplicateCheck = await checkDuplicateUrl(db, session.user.id, url);
  if (duplicateCheck.exists) {
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
          // eslint-disable-next-line no-console
          console.log("[Background] Starting AI processing for:", url);

          // 既存URLメタデータをチェック（AI呼び出しスキップ用）
          const existingUrlData = await getUrlMetadata(db, url);

          let urlId: number;

          if (existingUrlData) {
            // 既存URLがある場合、そのメタデータを使用（AI呼び出しスキップ）
            // eslint-disable-next-line no-console
            console.log(
              "[Background] Existing URL found, skipping AI processing"
            );
            urlId = existingUrlData.id;
          } else {
            // 新規URLの場合、AIでメタデータ生成
            // 既存カテゴリ取得（userIdパラメータなし）
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

            // eslint-disable-next-line no-console
            console.log("[Background] AI processing completed, saving to DB");

            // カテゴリを取得または作成（userIdパラメータなし）
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

            // URLマスター作成
            const urlResult = await getOrCreateUrl(db, {
              url,
              title,
              description: metadata.description,
              majorCategoryId,
              minorCategoryId,
            });
            urlId = urlResult.id;
          }

          // ユーザーブックマーク作成
          await createUserBookmark(db, {
            userId: session.user.id,
            urlId,
          });

          // eslint-disable-next-line no-console
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
      error:
        error instanceof Error
          ? error.message
          : "ページ情報の取得に失敗しました",
      toast: {
        type: "error" as const,
        title: "エラー",
        message:
          error instanceof Error
            ? error.message
            : "ページ情報の取得に失敗しました",
      },
    };
  }
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

  // ドラッグ&ドロップ用state
  const [draggedItem, setDraggedItem] = useState<{
    type: "bookmark" | "category";
    id: number;
    currentOrder: number;
  } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{
    type: "bookmark" | "category";
    id: number;
    position: "before" | "after";
  } | null>(null);

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
      if (actionData.error || actionData.toast?.type === "warning") {
        setOptimisticBookmarks(loaderData.bookmarksByCategory);
      }

      // フォームをクリア（すぐに次の入力が可能）
      if (formRef.current) {
        formRef.current.reset();
      }

      // 結果トーストを表示
      if (actionData.toast) {
        const toastId = Date.now().toString();
        setToasts((prev) => [
          ...prev,
          {
            id: toastId,
            ...actionData.toast,
          },
        ]);
      }

      if (actionData.success) {
        // Broadcast: 他のタブに変更を通知
        if (actionData.intent === "add" && "bookmarkId" in actionData) {
          broadcast({
            type: "bookmark-added",
            bookmarkId: actionData.bookmarkId as number,
          });
        } else if (
          actionData.intent === "delete" &&
          "bookmarkId" in actionData
        ) {
          broadcast({
            type: "bookmark-deleted",
            bookmarkId: actionData.bookmarkId as number,
          });
        } else if (
          actionData.intent === "reorderBookmarks" &&
          "bookmarkId" in actionData
        ) {
          broadcast({
            type: "bookmark-reordered",
            bookmarkId: actionData.bookmarkId as number,
            newOrder: 0,
          });
        } else if (
          actionData.intent === "reorderCategories" &&
          "categoryId" in actionData
        ) {
          broadcast({
            type: "category-reordered",
            categoryId: actionData.categoryId as number,
            newOrder: 0,
          });
        } else if (
          [
            "toggleStar",
            "toggleReadStatus",
            "toggleArchive",
            "refresh",
            "edit",
          ].includes(actionData.intent || "")
        ) {
          const bookmarkId = (
            "bookmarkId" in actionData ? actionData.bookmarkId : 0
          ) as number;
          broadcast({ type: "bookmark-updated", bookmarkId });
        }

        // 処理中の場合、カウントを増やして定期リフレッシュを開始
        if (actionData.processing) {
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

  // ドラッグ&ドロップハンドラー
  const handleDragStart = (
    type: "bookmark" | "category",
    id: number,
    order: number
  ) => {
    setDraggedItem({ type, id, currentOrder: order });
  };

  const handleDragOver = (
    e: React.DragEvent,
    type: "bookmark" | "category",
    id: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.type !== type || draggedItem.id === id) {
      return;
    }

    // マウスの位置から挿入位置を判定（上半分なら前、下半分なら後）
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? "before" : "after";

    setDragOverItem({ type, id, position });
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetType: "bookmark" | "category",
    targetId: number,
    _targetOrder: number,
    _minorCategoryId?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !draggedItem ||
      draggedItem.type !== targetType ||
      draggedItem.id === targetId
    ) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    try {
      // ブックマークの並び替えのみ対応（カテゴリはボタンで移動）
      if (targetType === "bookmark") {
        // ブックマークの並び替え
        // ドラッグ元とドロップ先のカテゴリを取得
        let draggedCategoryId: number | null = null;
        let targetCategoryId: number | null = null;

        for (const major of displayBookmarks) {
          for (const minor of major.minorCategories) {
            if (minor.bookmarks.some((b) => b.id === draggedItem.id)) {
              draggedCategoryId = minor.minorCategoryId;
            }
            if (minor.bookmarks.some((b) => b.id === targetId)) {
              targetCategoryId = minor.minorCategoryId;
            }
          }
        }

        if (draggedCategoryId === null || targetCategoryId === null) return;
        if (draggedCategoryId !== targetCategoryId) {
          // 異なるカテゴリ間での移動を試みた場合の警告トースト
          const toastId = Date.now().toString();
          setToasts((prev) => [
            ...prev,
            {
              id: toastId,
              type: "warning" as const,
              title: "移動できません",
              message: "同じカテゴリ内でのみ並び替えできます",
            },
          ]);
          setDraggedItem(null);
          setDragOverItem(null);
          return;
        }

        // カテゴリIDベースで検索
        type BookmarkArray = BookmarkWithCategories[];
        let bookmarksInCategory: BookmarkArray = [];
        for (const major of displayBookmarks) {
          const minor = major.minorCategories.find(
            (m) => m.minorCategoryId === targetCategoryId
          );
          if (minor) {
            bookmarksInCategory = [...minor.bookmarks];
            break;
          }
        }

        const draggedIndex = bookmarksInCategory.findIndex(
          (b) => b.id === draggedItem.id
        );
        const targetIndex = bookmarksInCategory.findIndex(
          (b) => b.id === targetId
        );

        if (
          draggedIndex === -1 ||
          targetIndex === -1 ||
          draggedIndex === targetIndex
        )
          return;

        // positionに基づいて挿入位置を調整
        const position = dragOverItem?.position || "after";
        let insertIndex = targetIndex;

        if (position === "after") {
          insertIndex = targetIndex + 1;
        }

        // draggedIndexがinsertIndexより前にある場合、削除後にindexがずれるので調整
        if (draggedIndex < insertIndex) {
          insertIndex--;
        }

        // 同じ位置なら何もしない
        if (draggedIndex === insertIndex) {
          setDraggedItem(null);
          setDragOverItem(null);
          return;
        }

        // 配列を並び替え
        const [removed] = bookmarksInCategory.splice(draggedIndex, 1);
        bookmarksInCategory.splice(insertIndex, 0, removed);

        // 楽観的UI更新: ローカルstateを即座に更新
        setOptimisticBookmarks((prevBookmarks) => {
          return prevBookmarks.map((major) => ({
            ...major,
            minorCategories: major.minorCategories.map((minor) => {
              if (minor.minorCategoryId === targetCategoryId) {
                return { ...minor, bookmarks: bookmarksInCategory };
              }
              return minor;
            }),
          }));
        });

        // 新しい順序を計算
        const orders = bookmarksInCategory.map((bookmark, index) => ({
          id: bookmark.id,
          order: index,
        }));

        // サーバーに送信
        const formData = new FormData();
        formData.append("intent", "reorderBookmarks");
        formData.append("orders", JSON.stringify(orders));

        submit(formData, { method: "post", action: "/?index" });
      }
    } catch (error) {
      console.error("Reorder failed:", error);
      // エラーが発生したら楽観的stateをリセット
      setOptimisticBookmarks(loaderData.bookmarksByCategory);

      // エラートーストを表示
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: "error" as const,
          title: "エラー",
          message: "処理に失敗しました",
        },
      ]);
    } finally {
      setDraggedItem(null);
      setDragOverItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // カテゴリをボタンで移動するハンドラー
  const handleMoveCategoryUp = async (
    majorCategoryId: number,
    currentIndex: number
  ) => {
    if (currentIndex === 0) return; // 既に一番上

    try {
      const categories = [...displayBookmarks];
      const targetIndex = currentIndex - 1;

      // 配列を並び替え
      const [removed] = categories.splice(currentIndex, 1);
      categories.splice(targetIndex, 0, removed);

      // 楽観的UI更新
      setOptimisticBookmarks(categories);

      // 新しい順序を計算
      const orders = categories.map((category, index) => ({
        id: category.majorCategoryId,
        order: index,
      }));

      // サーバーに送信
      const formData = new FormData();
      formData.append("intent", "reorderCategories");
      formData.append("orders", JSON.stringify(orders));

      submit(formData, { method: "post", action: "/?index" });
    } catch (error) {
      console.error("Move category up failed:", error);
      // エラーが発生したら楽観的stateをリセット
      setOptimisticBookmarks(loaderData.bookmarksByCategory);

      // エラートーストを表示
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: "error" as const,
          title: "エラー",
          message: "カテゴリの移動に失敗しました",
        },
      ]);
    }
  };

  const handleMoveCategoryDown = async (
    majorCategoryId: number,
    currentIndex: number
  ) => {
    if (currentIndex === displayBookmarks.length - 1) return; // 既に一番下

    try {
      const categories = [...displayBookmarks];
      const targetIndex = currentIndex + 1;

      // 配列を並び替え
      const [removed] = categories.splice(currentIndex, 1);
      categories.splice(targetIndex, 0, removed);

      // 楽観的UI更新
      setOptimisticBookmarks(categories);

      // 新しい順序を計算
      const orders = categories.map((category, index) => ({
        id: category.majorCategoryId,
        order: index,
      }));

      // サーバーに送信
      const formData = new FormData();
      formData.append("intent", "reorderCategories");
      formData.append("orders", JSON.stringify(orders));

      submit(formData, { method: "post", action: "/?index" });
    } catch (error) {
      console.error("Move category down failed:", error);
      // エラーが発生したら楽観的stateをリセット
      setOptimisticBookmarks(loaderData.bookmarksByCategory);

      // エラートーストを表示
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: "error" as const,
          title: "エラー",
          message: "カテゴリの移動に失敗しました",
        },
      ]);
    }
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
                      {loaderData.starredBookmarks.map((bookmark, index) => {
                        const isDragging =
                          draggedItem?.type === "bookmark" &&
                          draggedItem.id === bookmark.id;
                        const isDragOver =
                          dragOverItem?.type === "bookmark" &&
                          dragOverItem.id === bookmark.id;
                        const showBeforeLine =
                          isDragOver && dragOverItem?.position === "before";
                        const showAfterLine =
                          isDragOver && dragOverItem?.position === "after";

                        return (
                          <div key={bookmark.id} className="relative">
                            {/* 挿入位置インジケーター（前） - カード間の左側に表示 */}
                            {showBeforeLine && (
                              <div className="absolute -left-2 top-0 bottom-0 w-1 bg-blue-500 dark:bg-blue-400 z-20 shadow-lg rounded-full" />
                            )}

                            <div
                              draggable
                              onDragStart={() =>
                                handleDragStart("bookmark", bookmark.id, index)
                              }
                              onDragOver={(e) =>
                                handleDragOver(e, "bookmark", bookmark.id)
                              }
                              onDrop={(e) =>
                                handleDrop(e, "bookmark", bookmark.id, index)
                              }
                              onDragEnd={handleDragEnd}
                              className={`group relative bg-white dark:bg-gray-900 rounded-2xl p-5 transition-all duration-200 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 border flex flex-col animate-scale-in ${
                                isDragging
                                  ? "opacity-30 scale-95 cursor-grabbing border-gray-300 dark:border-gray-700"
                                  : "cursor-grab border-transparent hover:border-gray-100 dark:hover:border-gray-800"
                              } ${isDragOver ? "scale-105" : ""}`}
                            >
                              <div className="flex flex-col flex-1 min-h-0">
                                {/* ドラッグハンドルアイコン */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
                                  <svg
                                    className="w-5 h-5 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 9h8M8 15h8"
                                    />
                                  </svg>
                                </div>
                                <div className="flex items-start gap-3 mb-3">
                                  {/* Favicon */}
                                  <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 shadow-inner">
                                    <img
                                      src={`https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=64`}
                                      alt=""
                                      className="w-6 h-6 rounded-md"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  </div>

                                  <a
                                    href={bookmark.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 min-w-0 block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                                  >
                                    <h4 className="font-semibold text-sm sm:text-base md:text-lg text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 line-clamp-2 tracking-tight leading-snug">
                                      {bookmark.title}
                                    </h4>
                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                                      {bookmark.description}
                                    </p>
                                    <div className="flex flex-col gap-1 text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 font-medium">
                                      <span className="truncate">
                                        {new URL(bookmark.url).hostname}
                                      </span>
                                      <span>
                                        {new Date(
                                          bookmark.createdAt
                                        ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </span>
                                    </div>
                                  </a>
                                </div>

                                <div className="shrink-0 flex items-center gap-1 justify-end mt-auto pt-2">
                                  {/* 読了ステータスボタン */}
                                  <Form method="post">
                                    <input
                                      type="hidden"
                                      name="intent"
                                      value="toggleReadStatus"
                                    />
                                    <input
                                      type="hidden"
                                      name="bookmarkId"
                                      value={bookmark.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="readStatus"
                                      value={bookmark.readStatus}
                                    />
                                    <button
                                      type="submit"
                                      className="p-2 text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                      title={
                                        bookmark.readStatus === "read"
                                          ? "Mark as unread"
                                          : "Mark as read"
                                      }
                                    >
                                      {bookmark.readStatus === "read" ? (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-5 w-5 text-green-500 dark:text-green-400"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                        >
                                          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                                        </svg>
                                      ) : (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-5 w-5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                          />
                                        </svg>
                                      )}
                                    </button>
                                  </Form>

                                  {/* スターボタン */}
                                  <Form method="post">
                                    <input
                                      type="hidden"
                                      name="intent"
                                      value="toggleStar"
                                    />
                                    <input
                                      type="hidden"
                                      name="bookmarkId"
                                      value={bookmark.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="isStarred"
                                      value={bookmark.isStarred.toString()}
                                    />
                                    <button
                                      type="submit"
                                      className="p-2 text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                      title={
                                        bookmark.isStarred ? "Unstar" : "Star"
                                      }
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-5 w-5 text-yellow-500 dark:text-yellow-400"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    </button>
                                  </Form>

                                  {/* アーカイブボタン */}
                                  <Form method="post">
                                    <input
                                      type="hidden"
                                      name="intent"
                                      value="toggleArchive"
                                    />
                                    <input
                                      type="hidden"
                                      name="bookmarkId"
                                      value={bookmark.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="isArchived"
                                      value={bookmark.isArchived.toString()}
                                    />
                                    <button
                                      type="submit"
                                      className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                      title={
                                        bookmark.isArchived
                                          ? "Unarchive"
                                          : "Archive"
                                      }
                                    >
                                      {bookmark.isArchived ? (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-5 w-5 text-blue-500 dark:text-blue-400"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                        >
                                          <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                                          <path
                                            fillRule="evenodd"
                                            d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      ) : (
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-5 w-5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                                          />
                                        </svg>
                                      )}
                                    </button>
                                  </Form>

                                  {/* 情報更新ボタン */}
                                  <Form method="post">
                                    <input
                                      type="hidden"
                                      name="intent"
                                      value="refresh"
                                    />
                                    <input
                                      type="hidden"
                                      name="bookmarkId"
                                      value={bookmark.id}
                                    />
                                    <button
                                      type="submit"
                                      onClick={(e) => {
                                        if (
                                          !confirm(
                                            `"「${bookmark.title}」の情報を再取得しますか？\nカテゴリや説明が更新される可能性があります。`
                                          )
                                        ) {
                                          e.preventDefault();
                                        }
                                      }}
                                      className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                      title="情報を更新"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-5 w-5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                        />
                                      </svg>
                                    </button>
                                  </Form>

                                  {/* 編集ボタン */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingBookmark({
                                        id: bookmark.id,
                                        title: bookmark.title,
                                        description: bookmark.description,
                                        majorCategory:
                                          bookmark.majorCategory.name,
                                        minorCategory:
                                          bookmark.minorCategory.name,
                                      })
                                    }
                                    className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                    title="Edit"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-5 w-5"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                  </button>

                                  {/* 削除ボタン */}
                                  <Form method="post">
                                    <input
                                      type="hidden"
                                      name="intent"
                                      value="delete"
                                    />
                                    <input
                                      type="hidden"
                                      name="bookmarkId"
                                      value={bookmark.id}
                                    />
                                    <button
                                      type="submit"
                                      onClick={(e) => {
                                        if (
                                          !confirm(
                                            `"「${bookmark.title}」を削除しますか？`
                                          )
                                        ) {
                                          e.preventDefault();
                                        }
                                      }}
                                      className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                      title="Delete"
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

                            {/* 挿入位置インジケーター（後） - カード間の右側に表示 */}
                            {showAfterLine && (
                              <div className="absolute -right-2 top-0 bottom-0 w-1 bg-blue-500 dark:bg-blue-400 z-20 shadow-lg rounded-full" />
                            )}
                          </div>
                        );
                      })}
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
                      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
                        <h2 className="text-xl sm:text-2xl md:text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight flex-1">
                          {major.majorCategory}
                        </h2>

                        {/* カテゴリ移動ボタン */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleMoveCategoryUp(
                                major.majorCategoryId,
                                majorIndex
                              )
                            }
                            disabled={majorIndex === 0}
                            className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                            title="上に移動"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleMoveCategoryDown(
                                major.majorCategoryId,
                                majorIndex
                              )
                            }
                            disabled={
                              majorIndex === displayBookmarks.length - 1
                            }
                            className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                            title="下に移動"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

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
                            {minor.bookmarks.map((bookmark, index) => {
                              const isDragging =
                                draggedItem?.type === "bookmark" &&
                                draggedItem.id === bookmark.id;
                              const isDragOver =
                                dragOverItem?.type === "bookmark" &&
                                dragOverItem.id === bookmark.id;
                              const showBeforeLine =
                                isDragOver &&
                                dragOverItem?.position === "before";
                              const showAfterLine =
                                isDragOver &&
                                dragOverItem?.position === "after";

                              return (
                                <div key={bookmark.id} className="relative">
                                  {/* 挿入位置インジケーター（前） - カード間の左側に表示 */}
                                  {showBeforeLine && (
                                    <div className="absolute -left-2 top-0 bottom-0 w-1 bg-blue-500 dark:bg-blue-400 z-20 shadow-lg rounded-full" />
                                  )}

                                  <div
                                    draggable
                                    onDragStart={() =>
                                      handleDragStart(
                                        "bookmark",
                                        bookmark.id,
                                        index
                                      )
                                    }
                                    onDragOver={(e) =>
                                      handleDragOver(e, "bookmark", bookmark.id)
                                    }
                                    onDrop={(e) =>
                                      handleDrop(
                                        e,
                                        "bookmark",
                                        bookmark.id,
                                        index,
                                        minor.minorCategoryId
                                      )
                                    }
                                    onDragEnd={handleDragEnd}
                                    className={`group relative bg-white dark:bg-gray-900 rounded-2xl p-5 transition-all duration-200 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 border flex flex-col animate-scale-in ${
                                      bookmark.isArchived
                                        ? "opacity-60 grayscale"
                                        : ""
                                    } ${
                                      isDragging
                                        ? "opacity-30 scale-95 cursor-grabbing border-gray-300 dark:border-gray-700"
                                        : "cursor-grab border-transparent hover:border-gray-100 dark:hover:border-gray-800"
                                    } ${isDragOver ? "scale-105" : ""}`}
                                  >
                                    <div className="flex flex-col flex-1 min-h-0">
                                      {/* ドラッグハンドルアイコン */}
                                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
                                        <svg
                                          className="w-5 h-5 text-gray-400"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M8 9h8M8 15h8"
                                          />
                                        </svg>
                                      </div>
                                      <div className="flex items-start gap-3 mb-3">
                                        {/* Favicon */}
                                        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 shadow-inner">
                                          <img
                                            src={`https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=64`}
                                            alt=""
                                            className="w-6 h-6 rounded-md"
                                            onError={(e) => {
                                              e.currentTarget.style.display =
                                                "none";
                                            }}
                                          />
                                        </div>

                                        <a
                                          href={bookmark.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex-1 min-w-0 block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                                        >
                                          <h4 className="font-semibold text-sm sm:text-base md:text-lg text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 line-clamp-2 tracking-tight leading-snug">
                                            {bookmark.title}
                                          </h4>
                                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                                            {bookmark.description}
                                          </p>
                                          <div className="flex flex-col gap-1 text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 font-medium">
                                            <span className="truncate">
                                              {new URL(bookmark.url).hostname}
                                            </span>
                                            <span>
                                              {new Date(
                                                bookmark.createdAt
                                              ).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                              })}
                                            </span>
                                          </div>
                                        </a>
                                      </div>

                                      <div className="shrink-0 flex items-center gap-1 justify-end mt-auto pt-2">
                                        {/* 読了ステータスボタン */}
                                        <Form method="post">
                                          <input
                                            type="hidden"
                                            name="intent"
                                            value="toggleReadStatus"
                                          />
                                          <input
                                            type="hidden"
                                            name="bookmarkId"
                                            value={bookmark.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="readStatus"
                                            value={bookmark.readStatus}
                                          />
                                          <button
                                            type="submit"
                                            className="p-2 text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                            title={
                                              bookmark.readStatus === "read"
                                                ? "Mark as unread"
                                                : "Mark as read"
                                            }
                                          >
                                            {bookmark.readStatus === "read" ? (
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5 text-green-500 dark:text-green-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                              >
                                                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                                              </svg>
                                            ) : (
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                                />
                                              </svg>
                                            )}
                                          </button>
                                        </Form>

                                        {/* スターボタン */}
                                        <Form method="post">
                                          <input
                                            type="hidden"
                                            name="intent"
                                            value="toggleStar"
                                          />
                                          <input
                                            type="hidden"
                                            name="bookmarkId"
                                            value={bookmark.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="isStarred"
                                            value={bookmark.isStarred.toString()}
                                          />
                                          <button
                                            type="submit"
                                            className="p-2 text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                            title={
                                              bookmark.isStarred
                                                ? "Unstar"
                                                : "Star"
                                            }
                                          >
                                            {bookmark.isStarred ? (
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5 text-yellow-500 dark:text-yellow-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                              >
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                              </svg>
                                            ) : (
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                                />
                                              </svg>
                                            )}
                                          </button>
                                        </Form>

                                        {/* アーカイブボタン */}
                                        <Form method="post">
                                          <input
                                            type="hidden"
                                            name="intent"
                                            value="toggleArchive"
                                          />
                                          <input
                                            type="hidden"
                                            name="bookmarkId"
                                            value={bookmark.id}
                                          />
                                          <input
                                            type="hidden"
                                            name="isArchived"
                                            value={bookmark.isArchived.toString()}
                                          />
                                          <button
                                            type="submit"
                                            className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                            title={
                                              bookmark.isArchived
                                                ? "Unarchive"
                                                : "Archive"
                                            }
                                          >
                                            {bookmark.isArchived ? (
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5 text-blue-500 dark:text-blue-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                              >
                                                <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                                                <path
                                                  fillRule="evenodd"
                                                  d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                                  clipRule="evenodd"
                                                />
                                              </svg>
                                            ) : (
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-5 w-5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                                                />
                                              </svg>
                                            )}
                                          </button>
                                        </Form>

                                        {/* 情報更新ボタン */}
                                        <Form method="post">
                                          <input
                                            type="hidden"
                                            name="intent"
                                            value="refresh"
                                          />
                                          <input
                                            type="hidden"
                                            name="bookmarkId"
                                            value={bookmark.id}
                                          />
                                          <button
                                            type="submit"
                                            onClick={(e) => {
                                              if (
                                                !confirm(
                                                  `"「${bookmark.title}」の情報を再取得しますか？\nカテゴリや説明が更新される可能性があります。`
                                                )
                                              ) {
                                                e.preventDefault();
                                              }
                                            }}
                                            className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                            title="情報を更新"
                                          >
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              className="h-5 w-5"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                              strokeWidth="1.5"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                              />
                                            </svg>
                                          </button>
                                        </Form>

                                        {/* 編集ボタン */}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingBookmark({
                                              id: bookmark.id,
                                              title: bookmark.title,
                                              description: bookmark.description,
                                              majorCategory:
                                                bookmark.majorCategory.name,
                                              minorCategory:
                                                bookmark.minorCategory.name,
                                            })
                                          }
                                          className="p-2 text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                                          title="Edit"
                                        >
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                            />
                                          </svg>
                                        </button>

                                        {/* 削除ボタン */}
                                        <Form method="post">
                                          <input
                                            type="hidden"
                                            name="intent"
                                            value="delete"
                                          />
                                          <input
                                            type="hidden"
                                            name="bookmarkId"
                                            value={bookmark.id}
                                          />
                                          <button
                                            type="submit"
                                            onClick={(e) => {
                                              if (
                                                !confirm(
                                                  `"「${bookmark.title}」を削除しますか？`
                                                )
                                              ) {
                                                e.preventDefault();
                                              }
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                            title="Delete"
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

                                  {/* 挿入位置インジケーター（後） - カード間の右側に表示 */}
                                  {showAfterLine && (
                                    <div className="absolute -right-2 top-0 bottom-0 w-1 bg-blue-500 dark:bg-blue-400 z-20 shadow-lg rounded-full" />
                                  )}
                                </div>
                              );
                            })}
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
