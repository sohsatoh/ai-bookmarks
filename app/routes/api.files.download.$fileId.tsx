/**
 * ファイルダウンロードAPI
 *
 * GET /api/files/download/:fileId
 * セキュリティ:
 * - 認証必須（requireAuth）
 * - ユーザー分離（自分のファイルのみダウンロード可能）
 * - SHA-256ハッシュによる整合性検証
 * - Content-Dispositionヘッダー設定（XSS対策）
 */

import type { Route } from "./+types/api.files.download.$fileId";
import { requireAuth } from "~/services/auth.server";
import { downloadFile } from "~/services/file.server";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  try {
    // 認証チェック
    const session = await requireAuth(request, context);

    // ファイルIDを取得
    const fileId = Number(params.fileId);

    if (isNaN(fileId)) {
      return new Response("無効なファイルIDです", { status: 400 });
    }

    // ファイルをダウンロード
    const result = await downloadFile(fileId, session.user.id, context);

    if (!result.success || !result.file || !result.metadata) {
      return new Response(result.error || "ファイルが見つかりません", {
        status: 404,
      });
    }

    // レスポンスヘッダーを設定
    const headers = new Headers();
    headers.set("Content-Type", result.metadata.mimeType);
    headers.set("Content-Length", String(result.metadata.fileSize));

    // Content-Dispositionヘッダーでファイル名を設定（ダウンロード強制）
    // attachment: ブラウザでの実行を防ぐ（XSS対策）
    const encodedFilename = encodeURIComponent(
      result.metadata.originalFilename
    );
    headers.set(
      "Content-Disposition",
      `attachment; filename="${result.metadata.sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`
    );

    // セキュリティヘッダー
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Content-Security-Policy", "default-src 'none'");

    return new Response(result.file.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("ファイルダウンロードエラー:", error);
    return new Response("ファイルのダウンロードに失敗しました", {
      status: 500,
    });
  }
}
