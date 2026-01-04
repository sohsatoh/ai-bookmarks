/**
 * バッチ系アクション
 * - 一括更新
 * - ブックマークの並び替え
 * - カテゴリの並び替え
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { urls } from "~/db/schema";
import {
  getExistingCategories,
  getOrCreateCategory,
  updateBookmarkOrder,
  updateCategoryOrder,
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
  intent?: string;
};

/**
 * すべてのブックマーク情報を一括更新
 */
export async function handleRefreshAll(
  db: DrizzleD1Database,
  ai: unknown,
  ctx: { waitUntil: (promise: Promise<unknown>) => void }
): Promise<ActionResult> {
  try {
    // すべてのURLマスターを取得
    const allUrls = await db.select().from(urls);

    if (allUrls.length === 0) {
      return {
        error: "更新するブックマークがありません",
        toast: {
          type: "info",
          title: "情報",
          message: "更新するブックマークがありません",
        },
      };
    }

    // バックグラウンドで処理
    ctx.waitUntil(
      (async () => {
        // eslint-disable-next-line no-console
        console.log(
          `[Refresh All] Starting batch update for ${allUrls.length} URLs`
        );

        // 既存カテゴリ取得
        const existingCategories = await getExistingCategories(db as any);
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
              ai as any,
              urlData.url,
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
        type: "info",
        title: "一括更新を開始",
        message: `${allUrls.length}件のブックマークを更新しています...`,
      },
    };
  } catch (error) {
    console.error("Refresh all failed:", error);
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

/**
 * ブックマークの並び替え処理
 */
export async function handleReorderBookmarks(
  formData: FormData,
  db: DrizzleD1Database,
  userId: string
): Promise<ActionResult> {
  try {
    const ordersJson = formData.get("orders") as string;
    if (!ordersJson) {
      return {
        error: "並び替え情報が不正です",
        toast: {
          type: "error",
          title: "エラー",
          message: "並び替え情報が不正です",
        },
      };
    }

    // JSON.parseの検証
    let parsed: unknown;
    try {
      parsed = JSON.parse(ordersJson);
    } catch {
      return {
        error: "並び替え情報の形式が不正です",
        toast: {
          type: "error",
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

    // 各ブックマークの順序を更新
    const results = await Promise.all(
      orders.map(({ id, order }) =>
        updateBookmarkOrder(db as any, userId, id, order)
      )
    );

    // 失敗があれば競合エラーを返す
    const failed = results.find((r) => !r.success);
    if (failed) {
      return {
        error: "並び替え中に競合が発生しました",
        toast: {
          type: "warning",
          title: "競合検知",
          message: "他のタブで変更されました。ページを再読み込みしてください",
        },
      };
    }

    return {
      success: true,
      intent: "reorderBookmarks",
      toast: {
        type: "success",
        title: "成功",
        message: "並び替えが完了しました",
      },
    };
  } catch (error) {
    console.error("Reorder bookmarks failed:", error);
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

/**
 * カテゴリの並び替え処理
 */
export async function handleReorderCategories(
  formData: FormData,
  db: DrizzleD1Database,
  userId: string
): Promise<ActionResult> {
  try {
    const ordersJson = formData.get("orders") as string;
    if (!ordersJson) {
      return {
        error: "並び替え情報が不正です",
        toast: {
          type: "error",
          title: "エラー",
          message: "並び替え情報が不正です",
        },
      };
    }

    // JSON.parseの検証
    let parsed: unknown;
    try {
      parsed = JSON.parse(ordersJson);
    } catch {
      return {
        error: "並び替え情報の形式が不正です",
        toast: {
          type: "error",
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

    // 各カテゴリの順序を更新
    const results = await Promise.all(
      orders.map(({ id, order }) =>
        updateCategoryOrder(db as any, userId, id, order)
      )
    );

    // 失敗があれば競合エラーを返す
    const failed = results.find((r) => !r.success);
    if (failed) {
      return {
        error: "並び替え中に競合が発生しました",
        toast: {
          type: "warning",
          title: "競合検知",
          message: "他のタブで変更されました。ページを再読み込みしてください",
        },
      };
    }

    return {
      success: true,
      intent: "reorderCategories",
      toast: {
        type: "success",
        title: "成功",
        message: "カテゴリの並び替えが完了しました",
      },
    };
  } catch (error) {
    console.error("Reorder categories failed:", error);
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
