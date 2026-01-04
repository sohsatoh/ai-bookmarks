/**
 * ブックマークのCRUD系アクション
 * - 削除
 * - 編集
 * - 情報更新（AI再生成）
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { userBookmarks, urls } from "~/db/schema";
import {
  deleteBookmark,
  getOrCreateCategory,
  getExistingCategories,
} from "~/services/db.server";
import { generateBookmarkMetadata } from "~/services/ai.server";
import { fetchPageMetadata } from "~/services/scraper.server";

type ToastMessage = {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
};

export type ActionResult = {
  success?: boolean;
  error?: string;
  toast?: ToastMessage;
};

/**
 * 削除処理
 */
export async function handleDelete(
  formData: FormData,
  db: DrizzleD1Database,
  userId: string
): Promise<ActionResult> {
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
    await deleteBookmark(db as any, userId, id);
    return { success: true };
  } catch (error) {
    console.error("Delete failed:", error);
    return { error: "処理に失敗しました" };
  }
}

/**
 * 編集処理
 */
export async function handleEdit(
  formData: FormData,
  db: DrizzleD1Database,
  userId: string
): Promise<ActionResult> {
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
    // カテゴリを取得または作成
    const majorCategoryId = await getOrCreateCategory(
      db as any,
      majorCategory,
      "major"
    );
    const minorCategoryId = await getOrCreateCategory(
      db as any,
      minorCategory,
      "minor",
      majorCategoryId
    );

    // ユーザーブックマークから対応するURLを取得
    const userBookmark = await db
      .select()
      .from(userBookmarks)
      .where(and(eq(userBookmarks.id, id), eq(userBookmarks.userId, userId)))
      .limit(1);

    if (userBookmark.length === 0) {
      console.error("Bookmark not found or unauthorized:", id, userId);
      return { error: "処理に失敗しました" };
    }

    // URLマスターテーブルを更新
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
        type: "success",
        title: "更新完了",
        message: "ブックマークを更新しました",
      },
    };
  } catch (error) {
    console.error("Edit failed:", error);
    return { error: "処理に失敗しました" };
  }
}

/**
 * 情報更新処理（AIで再生成）
 */
export async function handleRefresh(
  formData: FormData,
  db: DrizzleD1Database,
  userId: string,
  ai: unknown
): Promise<ActionResult> {
  const bookmarkId = formData.get("bookmarkId");

  if (!bookmarkId || typeof bookmarkId !== "string") {
    return { error: "無効なリクエストです" };
  }

  const id = Number(bookmarkId);
  if (Number.isNaN(id) || id <= 0) {
    return { error: "無効なリクエストです" };
  }

  try {
    // 既存ブックマーク情報を取得
    const existingBookmark = await db
      .select({
        userBookmark: userBookmarks,
        url: urls,
      })
      .from(userBookmarks)
      .innerJoin(urls, eq(userBookmarks.urlId, urls.id))
      .where(and(eq(userBookmarks.id, id), eq(userBookmarks.userId, userId)))
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

    // 既存カテゴリ取得
    const existingCategories = await getExistingCategories(db as any);

    // AIでメタデータ生成
    const metadata = await generateBookmarkMetadata(
      ai as any,
      bookmark.url.url,
      title,
      description,
      content,
      existingCategories
    );

    // カテゴリを取得または作成
    const majorCategoryId = await getOrCreateCategory(
      db as any,
      metadata.majorCategory,
      "major"
    );
    const minorCategoryId = await getOrCreateCategory(
      db as any,
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
        type: "success",
        title: "更新完了",
        message: "ブックマーク情報を更新しました",
      },
    };
  } catch (error) {
    console.error("Refresh failed:", error);
    return {
      error: "処理に失敗しました",
      toast: {
        type: "error",
        title: "エラー",
        message: "処理に失敗しました",
      },
    };
  }
}
