/**
 * ブックマーク追加アクション
 */

import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  getOrCreateCategory,
  getExistingCategories,
  checkDuplicateUrl,
  getUrlMetadata,
  getOrCreateUrl,
  createUserBookmark,
  updateUrl,
} from "~/services/db.server";
import { generateBookmarkMetadata } from "~/services/ai.server";
import { fetchPageMetadata, validateUrl } from "~/services/scraper.server";
import {
  getClientIp,
  checkBookmarkAddRateLimit,
} from "~/services/rate-limit.server";

type ToastMessage = {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
};

export type ActionResult = {
  success?: boolean;
  error?: string;
  processing?: boolean;
  toast?: ToastMessage;
  intent?: string;
};

/**
 * ブックマーク追加処理
 */
export async function handleAddBookmark(
  formData: FormData,
  request: Request,
  db: DrizzleD1Database,
  ai: unknown,
  userId: string,
  ctx: { waitUntil: (promise: Promise<unknown>) => void }
): Promise<ActionResult> {
  const url = formData.get("url") as string;

  // レート制限チェック
  const clientIp = getClientIp(request);
  const bookmarkAddRateLimit = checkBookmarkAddRateLimit(clientIp, userId);
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

  // URL長の制限
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
  const duplicateCheck = await checkDuplicateUrl(db as any, userId, url);
  if (duplicateCheck.exists) {
    return {
      error: "このURLは既に登録されています",
    };
  }

  try {
    // ページメタデータ取得
    const { title, description, content } = await fetchPageMetadata(url);

    // 既存URLメタデータをチェック
    const existingUrlData = await getUrlMetadata(db as any, url);

    let urlId: number;
    let needsAiProcessing = false;

    if (existingUrlData) {
      // 既存URLがある場合、そのメタデータを使用
      // eslint-disable-next-line no-console
      console.log("[Sync] Existing URL found, skipping AI processing");
      urlId = existingUrlData.id;
    } else {
      // 新規URLの場合、デフォルトカテゴリで即座に保存
      // eslint-disable-next-line no-console
      console.log("[Sync] New URL, creating with default category");

      // デフォルトカテゴリを取得または作成
      const majorCategoryId = await getOrCreateCategory(
        db as any,
        "未分類",
        "major"
      );
      const minorCategoryId = await getOrCreateCategory(
        db as any,
        "その他",
        "minor",
        majorCategoryId
      );

      // URLマスター作成（AI処理前のデフォルト値）
      const urlResult = await getOrCreateUrl(db as any, {
        url,
        title,
        description: description || "AI分析中...",
        majorCategoryId,
        minorCategoryId,
      });
      urlId = urlResult.id;
      needsAiProcessing = true;
    }

    // ユーザーブックマーク作成（即座に実行）
    await createUserBookmark(db as any, {
      userId,
      urlId,
    });

    // eslint-disable-next-line no-console
    console.log("[Sync] Bookmark saved successfully");

    // AI処理が必要な場合、バックグラウンドで実行
    if (needsAiProcessing) {
      ctx.waitUntil(
        (async () => {
          try {
            // eslint-disable-next-line no-console
            console.log("[Background] Starting AI processing for:", url);

            // 既存カテゴリを取得
            const existingCategories = await getExistingCategories(db as any);

            // AIでメタデータ生成
            const metadata = await generateBookmarkMetadata(
              ai as any,
              url,
              title,
              description,
              content,
              existingCategories
            );

            // eslint-disable-next-line no-console
            console.log("[Background] AI processing completed, updating DB");

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

            // URLマスターを更新（AI生成メタデータで上書き）
            await updateUrl(db as any, urlId, {
              description: metadata.description,
              majorCategoryId,
              minorCategoryId,
            });

            // eslint-disable-next-line no-console
            console.log("[Background] AI metadata updated successfully");
          } catch (error) {
            console.error("[Background] Failed to process AI metadata:", error);
          }
        })()
      );
    }

    // すぐにレスポンスを返す
    return {
      success: true,
      processing: needsAiProcessing,
      toast: {
        type: "success",
        title: needsAiProcessing ? "追加しました" : "追加しました",
        message: needsAiProcessing
          ? `${title} を追加しました。AI分析は続行中です。`
          : `${title} を追加しました。`,
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
        type: "error",
        title: "エラー",
        message:
          error instanceof Error
            ? error.message
            : "ページ情報の取得に失敗しました",
      },
    };
  }
}
