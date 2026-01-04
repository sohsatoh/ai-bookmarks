/**
 * ファイル削除API
 *
 * DELETE /api/files/delete/:fileId
 * セキュリティ:
 * - 認証必須（requireAuth）
 * - ユーザー分離（自分のファイルのみ削除可能）
 * - レート制限
 */

import type { Route } from "./+types/api.files.delete.$fileId";
import { data } from "react-router";
import { requireAuth } from "~/services/auth.server";
import { deleteFile } from "~/services/file.server";
import { SimpleRateLimiter } from "~/services/security.server";
import { RATE_LIMIT_CONFIG } from "~/constants";

// レート制限インスタンス
const ipRateLimiter = new SimpleRateLimiter(
  RATE_LIMIT_CONFIG.MUTATION_IP_MAX_REQUESTS,
  RATE_LIMIT_CONFIG.MUTATION_IP_WINDOW_MS
);

const userRateLimiter = new SimpleRateLimiter(
  RATE_LIMIT_CONFIG.MUTATION_USER_MAX_REQUESTS,
  RATE_LIMIT_CONFIG.MUTATION_USER_WINDOW_MS
);

export async function action({ request, params, context }: Route.ActionArgs) {
  try {
    // 認証チェック
    const session = await requireAuth(request, context);

    // IPベースのレート制限
    const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
    const ipCheck = ipRateLimiter.check(clientIp);

    if (!ipCheck.allowed) {
      return data(
        {
          error: "レート制限を超過しました。しばらくしてから再試行してください",
          toast: {
            type: "error",
            title: "エラー",
            message:
              "レート制限を超過しました。しばらくしてから再試行してください",
          },
        },
        { status: 429 }
      );
    }

    // ユーザーベースのレート制限
    const userCheck = userRateLimiter.check(session.user.id);

    if (!userCheck.allowed) {
      return data(
        {
          error: "レート制限を超過しました。しばらくしてから再試行してください",
          toast: {
            type: "error",
            title: "エラー",
            message:
              "レート制限を超過しました。しばらくしてから再試行してください",
          },
        },
        { status: 429 }
      );
    }

    // ファイルIDを取得
    const fileId = Number(params.fileId);

    if (Number.isNaN(fileId)) {
      return data(
        {
          error: "無効なファイルIDです",
          toast: {
            type: "error",
            title: "エラー",
            message: "無効なファイルIDです",
          },
        },
        { status: 400 }
      );
    }

    // ファイルを削除
    const result = await deleteFile(fileId, session.user.id, context);

    if (!result.success) {
      return data(
        {
          error: result.error || "削除に失敗しました",
          toast: {
            type: "error",
            title: "エラー",
            message: result.error || "削除に失敗しました",
          },
        },
        { status: 400 }
      );
    }

    return data(
      {
        success: true,
        toast: {
          type: "success",
          title: "削除完了",
          message: "ファイルを削除しました",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("ファイル削除エラー:", error);
    return data(
      {
        error: "ファイルの削除に失敗しました",
        toast: {
          type: "error",
          title: "エラー",
          message: "ファイルの削除に失敗しました",
        },
      },
      { status: 500 }
    );
  }
}
