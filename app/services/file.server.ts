/**
 * ファイル管理サービス
 *
 * Cloudflare R2を使用したファイルのアップロード、ダウンロード、削除を管理
 * セキュリティ対策:
 * - ファイルサイズ制限（5MB）
 * - ファイル数制限（通常ユーザー: 10ファイル、admin: 無制限）
 * - MIMEタイプ検証
 * - Magic number検証（MIMEタイプ偽装対策）
 * - ファイル名サニタイズ（パストラバーサル対策）
 * - SHA-256ハッシュによる整合性検証
 * - ユーザー分離（他のユーザーのファイルにアクセス不可）
 *
 * OWASP推奨事項に準拠:
 * - Input Validation
 * - Access Control
 * - File Upload Security
 */

import type { AppLoadContext } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "~/db/schema";
import { files, users } from "~/db/schema";
import type { File as FileType } from "~/db/schema";
import { FILE_CONFIG } from "~/constants";
import { validateFile, calculateFileHash } from "./security.server";
import { analyzeFileContent } from "./ai.server";

/**
 * ユーザーのファイル数を取得
 */
export async function getUserFileCount(
  userId: string,
  context: AppLoadContext
): Promise<number> {
  const db = drizzle(context.cloudflare.env.DB, { schema });

  const userFiles = await db
    .select()
    .from(files)
    .where(eq(files.userId, userId));

  return userFiles.length;
}

/**
 * ユーザーがファイルをアップロード可能か確認
 */
export async function canUserUploadFile(
  userId: string,
  context: AppLoadContext
): Promise<{ allowed: boolean; error?: string; currentCount?: number }> {
  const db = drizzle(context.cloudflare.env.DB, { schema });

  // ユーザー情報を取得（roleチェック）
  const user = await db.select().from(users).where(eq(users.id, userId));

  if (!user || user.length === 0) {
    return { allowed: false, error: "ユーザーが見つかりません" };
  }

  const isAdmin = user[0].role === "admin";

  // adminは無制限
  if (isAdmin) {
    return { allowed: true };
  }

  // 通常ユーザーはファイル数制限
  const currentCount = await getUserFileCount(userId, context);

  if (currentCount >= FILE_CONFIG.MAX_FILES_PER_USER) {
    return {
      allowed: false,
      error: `ファイル数の上限（${FILE_CONFIG.MAX_FILES_PER_USER}ファイル）に達しています`,
      currentCount,
    };
  }

  return { allowed: true, currentCount };
}

/**
 * R2にファイルをアップロード
 */
async function uploadToR2(
  r2: R2Bucket,
  key: string,
  file: ArrayBuffer,
  metadata: {
    originalFilename: string;
    mimeType: string;
    userId: string;
    sha256Hash: string;
  }
): Promise<void> {
  await r2.put(key, file, {
    httpMetadata: {
      contentType: metadata.mimeType,
    },
    customMetadata: {
      originalFilename: metadata.originalFilename,
      userId: metadata.userId,
      sha256Hash: metadata.sha256Hash,
      uploadedAt: new Date().toISOString(),
    },
  });
}

/**
 * R2からファイルを取得
 */
async function getFromR2(
  r2: R2Bucket,
  key: string
): Promise<R2ObjectBody | null> {
  return await r2.get(key);
}

/**
 * R2からファイルを削除
 */
async function deleteFromR2(r2: R2Bucket, key: string): Promise<void> {
  await r2.delete(key);
}

/**
 * ユニークなR2キーを生成
 */
function generateR2Key(userId: string, sanitizedFilename: string): string {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomUUID().split("-")[0];
  return `users/${userId}/${timestamp}-${randomSuffix}-${sanitizedFilename}`;
}

/**
 * ファイルをアップロード（R2 + D1メタデータ）
 */
export async function uploadFile(
  file: File,
  userId: string,
  context: AppLoadContext
): Promise<{
  success: boolean;
  error?: string;
  file?: FileType;
}> {
  const db = drizzle(context.cloudflare.env.DB, { schema });
  const r2 = context.cloudflare.env.R2 as R2Bucket;

  try {
    // アップロード可能か確認
    const uploadCheck = await canUserUploadFile(userId, context);
    if (!uploadCheck.allowed) {
      return { success: false, error: uploadCheck.error };
    }

    // ファイル検証
    const validation = await validateFile(file);
    if (
      !validation.valid ||
      !validation.sanitizedFilename ||
      !validation.hash
    ) {
      return { success: false, error: validation.error };
    }

    // R2キー生成
    const r2Key = generateR2Key(userId, validation.sanitizedFilename);

    // ファイル内容を取得
    const fileBuffer = await file.arrayBuffer();

    // R2にアップロード
    await uploadToR2(r2, r2Key, fileBuffer, {
      originalFilename: file.name,
      mimeType: file.type,
      userId,
      sha256Hash: validation.hash,
    });

    // D1にメタデータを保存
    const newFile = await db
      .insert(files)
      .values({
        userId,
        originalFilename: file.name,
        sanitizedFilename: validation.sanitizedFilename,
        r2Key,
        mimeType: file.type,
        fileSize: file.size,
        sha256Hash: validation.hash,
        aiAnalysisStatus: "pending",
      })
      .returning();

    // バックグラウンドでAI分析を実行（非同期、エラーは無視）
    analyzeFileContentAsync(newFile[0].id, r2Key, file.type, context).catch(
      (error) => {
        console.error("AI分析エラー:", error);
      }
    );

    return { success: true, file: newFile[0] };
  } catch (error) {
    console.error("ファイルアップロードエラー:", error);
    return { success: false, error: "ファイルのアップロードに失敗しました" };
  }
}

/**
 * ファイルをダウンロード
 */
export async function downloadFile(
  fileId: number,
  userId: string,
  context: AppLoadContext
): Promise<{
  success: boolean;
  error?: string;
  file?: R2ObjectBody;
  metadata?: FileType;
}> {
  const db = drizzle(context.cloudflare.env.DB, { schema });
  const r2 = context.cloudflare.env.R2 as R2Bucket;

  try {
    // ファイルメタデータを取得（ユーザー分離）
    const fileMetadata = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)));

    if (!fileMetadata || fileMetadata.length === 0) {
      return { success: false, error: "ファイルが見つかりません" };
    }

    // R2からファイルを取得
    const r2Object = await getFromR2(r2, fileMetadata[0].r2Key);

    if (!r2Object) {
      return { success: false, error: "ファイルの取得に失敗しました" };
    }

    // SHA-256ハッシュを検証（整合性チェック）
    const downloadedBuffer = await r2Object.arrayBuffer();
    const downloadedHash = await calculateFileHash(downloadedBuffer);

    if (downloadedHash !== fileMetadata[0].sha256Hash) {
      console.error("ファイルハッシュ不一致:", {
        expected: fileMetadata[0].sha256Hash,
        actual: downloadedHash,
      });
      return { success: false, error: "ファイルの整合性検証に失敗しました" };
    }

    // R2Objectを再取得（arrayBuffer()は一度しか呼べないため）
    const finalR2Object = await getFromR2(r2, fileMetadata[0].r2Key);

    if (!finalR2Object) {
      return { success: false, error: "ファイルの取得に失敗しました" };
    }

    return { success: true, file: finalR2Object, metadata: fileMetadata[0] };
  } catch (error) {
    console.error("ファイルダウンロードエラー:", error);
    return { success: false, error: "ファイルのダウンロードに失敗しました" };
  }
}

/**
 * ファイルを削除
 */
export async function deleteFile(
  fileId: number,
  userId: string,
  context: AppLoadContext
): Promise<{ success: boolean; error?: string }> {
  const db = drizzle(context.cloudflare.env.DB, { schema });
  const r2 = context.cloudflare.env.R2 as R2Bucket;

  try {
    // ファイルメタデータを取得（ユーザー分離）
    const fileMetadata = await db
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.userId, userId)));

    if (!fileMetadata || fileMetadata.length === 0) {
      return { success: false, error: "ファイルが見つかりません" };
    }

    // R2から削除
    await deleteFromR2(r2, fileMetadata[0].r2Key);

    // D1から削除
    await db.delete(files).where(eq(files.id, fileId));

    return { success: true };
  } catch (error) {
    console.error("ファイル削除エラー:", error);
    return { success: false, error: "ファイルの削除に失敗しました" };
  }
}

/**
 * ユーザーのファイル一覧を取得
 */
export async function getUserFiles(
  userId: string,
  context: AppLoadContext
): Promise<FileType[]> {
  const db = drizzle(context.cloudflare.env.DB, { schema });

  const userFiles = await db
    .select()
    .from(files)
    .where(eq(files.userId, userId))
    .orderBy(desc(files.createdAt));

  return userFiles;
}

/**
 * ファイル内容をAIで分析（非同期）
 */
async function analyzeFileContentAsync(
  fileId: number,
  r2Key: string,
  mimeType: string,
  context: AppLoadContext
): Promise<void> {
  const db = drizzle(context.cloudflare.env.DB, { schema });
  const r2 = context.cloudflare.env.R2 as R2Bucket;

  try {
    // R2からファイルを取得
    const r2Object = await getFromR2(r2, r2Key);

    if (!r2Object) {
      throw new Error("ファイルが見つかりません");
    }

    // ファイル内容を取得
    const fileBuffer = await r2Object.arrayBuffer();
    const fileText = await extractTextFromFile(fileBuffer, mimeType);

    if (!fileText || fileText.trim().length === 0) {
      // テキスト抽出失敗（画像等）
      await db
        .update(files)
        .set({
          aiAnalysisStatus: "failed",
          aiAnalysisError: "テキストを抽出できませんでした",
          updatedAt: new Date(),
        })
        .where(eq(files.id, fileId));
      return;
    }

    // AIで分析
    const analysis = await analyzeFileContent(fileText, context);

    // 結果を保存
    await db
      .update(files)
      .set({
        title: analysis.title,
        description: analysis.description,
        majorCategoryId: analysis.majorCategoryId,
        minorCategoryId: analysis.minorCategoryId,
        aiAnalysisStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId));
  } catch (error) {
    console.error("AI分析エラー:", error);

    // エラー状態を保存
    await db
      .update(files)
      .set({
        aiAnalysisStatus: "failed",
        aiAnalysisError:
          error instanceof Error ? error.message : "AI分析に失敗しました",
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId));
  }
}

/**
 * ファイルからテキストを抽出
 */
async function extractTextFromFile(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  // テキスト系ファイル
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    const decoder = new TextDecoder("utf-8");
    let text = decoder.decode(buffer);

    // 長さ制限
    if (text.length > FILE_CONFIG.MAX_AI_ANALYSIS_TEXT_LENGTH) {
      text = text.slice(0, FILE_CONFIG.MAX_AI_ANALYSIS_TEXT_LENGTH);
    }

    return text;
  }

  // PDF（簡易的なテキスト抽出 - 本番環境では専用ライブラリ推奨）
  if (mimeType === "application/pdf") {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let text = decoder.decode(buffer);

    // PDFのバイナリから可視テキストを抽出（簡易版）
    text = text.replaceAll(/[^\x20-\x7E\u3000-\u30FF\u4E00-\u9FFF]/g, "");

    if (text.length > FILE_CONFIG.MAX_AI_ANALYSIS_TEXT_LENGTH) {
      text = text.slice(0, FILE_CONFIG.MAX_AI_ANALYSIS_TEXT_LENGTH);
    }

    return text;
  }

  // 画像、動画、その他バイナリファイルは空文字列を返す
  return "";
}
