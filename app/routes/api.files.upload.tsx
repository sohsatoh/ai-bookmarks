/**
 * ファイルアップロードAPI
 *
 * POST /api/files/upload
 * セキュリティ:
 * - 認証必須（requireAuth）
 * - レート制限（IPベース + ユーザーベース）
 * - ファイルサイズ制限（5MB）
 * - ファイル数制限（通常ユーザー: 10ファイル、admin: 無制限）
 * - MIMEタイプ検証
 * - Magic number検証
 * - ファイル名サニタイズ
 */

import type { Route } from "./+types/api.files.upload";
import { data } from "react-router";
import { requireAuth } from "~/services/auth.server";
import { uploadFile } from "~/services/file.server";
import { SimpleRateLimiter } from "~/services/security.server";
import { RATE_LIMIT_CONFIG } from "~/constants";

// レート制限インスタンス
const ipRateLimiter = new SimpleRateLimiter(
  RATE_LIMIT_CONFIG.FILE_UPLOAD_IP_MAX_REQUESTS,
  RATE_LIMIT_CONFIG.FILE_UPLOAD_IP_WINDOW_MS
);

const userRateLimiter = new SimpleRateLimiter(
  RATE_LIMIT_CONFIG.FILE_UPLOAD_USER_MAX_REQUESTS,
  RATE_LIMIT_CONFIG.FILE_UPLOAD_USER_WINDOW_MS
);

export async function action({ request, context }: Route.ActionArgs) {
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
        },
        { status: 429 }
      );
    }

    // フォームデータを取得
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return data({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    // ファイルをアップロード
    const result = await uploadFile(file, session.user.id, context);

    if (!result.success) {
      return data(
        { error: result.error || "アップロードに失敗しました" },
        { status: 400 }
      );
    }

    return data({ success: true, file: result.file }, { status: 200 });
  } catch (error) {
    console.error("ファイルアップロードエラー:", error);
    return data(
      { error: "ファイルのアップロードに失敗しました" },
      { status: 500 }
    );
  }
}
