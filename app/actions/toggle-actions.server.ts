/**
 * ブックマークのトグル系アクション
 * - スター
 * - 読了ステータス
 * - アーカイブ
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { userBookmarks } from "~/db/schema";

export type ActionResult = {
  success?: boolean;
  error?: string;
};

/**
 * スターのトグル処理
 */
export async function handleToggleStar(
  formData: FormData,
  db: DrizzleD1Database,
  userId: string
): Promise<ActionResult> {
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
      .where(and(eq(userBookmarks.id, id), eq(userBookmarks.userId, userId)))
      .returning();

    if (result.length === 0) {
      console.error("Bookmark not found or unauthorized:", id, userId);
      return { error: "処理に失敗しました" };
    }

    return { success: true };
  } catch (error) {
    console.error("Toggle star failed:", error);
    return { error: "処理に失敗しました" };
  }
}

/**
 * 読了ステータスのトグル処理
 */
export async function handleToggleReadStatus(
  formData: FormData,
  db: DrizzleD1Database,
  userId: string
): Promise<ActionResult> {
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
      .where(and(eq(userBookmarks.id, id), eq(userBookmarks.userId, userId)))
      .returning();

    if (result.length === 0) {
      console.error("Bookmark not found or unauthorized:", id, userId);
      return { error: "処理に失敗しました" };
    }

    return { success: true };
  } catch (error) {
    console.error("Toggle read status failed:", error);
    return { error: "処理に失敗しました" };
  }
}

/**
 * アーカイブのトグル処理
 */
export async function handleToggleArchive(
  formData: FormData,
  db: DrizzleD1Database,
  userId: string
): Promise<ActionResult> {
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
      .where(and(eq(userBookmarks.id, id), eq(userBookmarks.userId, userId)))
      .returning();

    if (result.length === 0) {
      console.error("Bookmark not found or unauthorized:", id, userId);
      return { error: "処理に失敗しました" };
    }

    return { success: true };
  } catch (error) {
    console.error("Toggle archive failed:", error);
    return { error: "処理に失敗しました" };
  }
}
