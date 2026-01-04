import { SECURITY_CONFIG } from "~/constants";
import sanitizeHtml from "sanitize-html";

/**
 * セキュリティユーティリティ関数
 * Cloudflare Workers環境向け（DOM APIなし）
 */

/**
 * XSS対策: HTMLタグを除去してプレーンテキスト化
 * サーバー側でのスクレイピング時に使用
 *
 * sanitize-htmlライブラリを使用した安全な実装:
 * - すべてのHTMLタグを削除
 * - すべての属性を削除
 * - 危険なタグを再帰的にエスケープ
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";

  return sanitizeHtml(html, {
    allowedTags: [], // すべてのタグを削除
    allowedAttributes: {}, // すべての属性を削除
    disallowedTagsMode: "recursiveEscape", // 危険なタグを再帰的にエスケープ
  });
}

/**
 * HTMLエンティティをデコード
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";

  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#39;": "'",
    "&nbsp;": " ",
  };

  return text.replaceAll(
    /&(?:amp|lt|gt|quot|#x27|#x2F|#39|nbsp);/g,
    (match) => entities[match] || match
  );
}

/**
 * Prompt Injection対策: ユーザー入力をサニタイズ
 * - 制御文字を除去
 * - プロンプトインジェクション用のキーワードをエスケープ
 * - 長さ制限
 */
export function sanitizeForPrompt(
  input: string,
  maxLength: number = SECURITY_CONFIG.DEFAULT_SANITIZED_TEXT_MAX_LENGTH
): string {
  if (!input) return "";

  return (
    input
      // 制御文字を除去（改行とタブ以外）
      // eslint-disable-next-line no-control-regex
      .replaceAll(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
      // 連続する改行を1つに
      .replaceAll(/\n{3,}/g, "\n\n")
      // 危険なプロンプトパターンをエスケープ
      .replaceAll(/```/g, "'''")
      .replaceAll(/\{/g, "\\{")
      .replaceAll(/\}/g, "\\}")
      // システムロール侵害パターンを無効化
      .replaceAll(/(?:system|assistant|user):/gi, "$&_")
      // 指示注入パターンを無効化
      .replaceAll(
        /(?:ignore|disregard|forget)\s+(?:previous|above|all)/gi,
        "[removed]"
      )
      .trim()
      .slice(0, maxLength)
  );
}

/**
 * SQLインジェクション対策: 入力値の検証
 * Drizzle ORMはプリペアドステートメントを使用するが、追加のバリデーション
 */
export function validateTextInput(
  input: string,
  fieldName: string,
  minLength: number = 1,
  maxLength: number = 500
): { valid: boolean; error?: string; sanitized?: string } {
  if (!input || typeof input !== "string") {
    return { valid: false, error: `${fieldName}は必須です` };
  }

  const trimmed = input.trim();

  if (trimmed.length < minLength) {
    return {
      valid: false,
      error: `${fieldName}は${minLength}文字以上である必要があります`,
    };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName}は${maxLength}文字以内である必要があります`,
    };
  }

  // SQL特殊文字のチェック（警告のみ、Drizzleが処理する）
  const dangerousPatterns = [
    /--/,
    /;.*(?:DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)/i,
    /UNION.*SELECT/i,
    /\/\*.*\*\//,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      console.warn(`Potential SQL injection attempt detected in ${fieldName}`);
      // 攻撃パターンを検出した場合は拒否
      return {
        valid: false,
        error: "不正な入力が検出されました",
      };
    }
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * URL検証の強化版（既存のvalidateUrlに追加）
 */
export function validateUrlStrict(urlString: string): {
  valid: boolean;
  error?: string;
  sanitizedUrl?: string;
} {
  try {
    // 基本的な型チェック
    if (!urlString || typeof urlString !== "string") {
      return { valid: false, error: "URLは必須です" };
    }

    const trimmed = urlString.trim();

    // 長さチェック（最大2048文字）
    if (trimmed.length > 2048) {
      return { valid: false, error: "URLが長すぎます" };
    }

    // javascript: data: などの危険なプロトコルを拒否
    const dangerousProtocols = ["javascript:", "data:", "file:", "vbscript:"];
    const lowerUrl = trimmed.toLowerCase();
    for (const proto of dangerousProtocols) {
      if (lowerUrl.startsWith(proto)) {
        return { valid: false, error: "許可されていないプロトコルです" };
      }
    }

    const url = new URL(trimmed);

    // HTTPまたはHTTPSのみ許可
    if (
      !SECURITY_CONFIG.ALLOWED_URL_PROTOCOLS.includes(
        url.protocol as "http:" | "https:"
      )
    ) {
      return { valid: false, error: "HTTPまたはHTTPSのURLのみ対応しています" };
    }

    // ホスト名が存在するか確認
    if (!url.hostname) {
      return { valid: false, error: "有効なホスト名が必要です" };
    }

    // ローカルホスト、プライベートIPへのアクセスを防ぐ（SSRF対策）
    const hostname = url.hostname.toLowerCase();

    for (const pattern of SECURITY_CONFIG.BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return {
          valid: false,
          error: "プライベートIPアドレスは使用できません",
        };
      }
    }

    return { valid: true, sanitizedUrl: url.toString() };
  } catch {
    return { valid: false, error: "無効なURL形式です" };
  }
}

/**
 * AI応答の検証とサニタイズ
 */
export function validateAiResponse(response: unknown): {
  valid: boolean;
  error?: string;
} {
  if (!response) {
    return { valid: false, error: "AI応答が空です" };
  }

  // 応答サイズのチェック（DoS対策）
  const responseStr = JSON.stringify(response);
  if (responseStr.length > 10000) {
    return { valid: false, error: "AI応答が大きすぎます" };
  }

  return { valid: true };
}

/**
 * レート制限用のシンプルなトークンバケット実装
 * 注: 本番環境ではCloudflare Rate Limitingを使用することを推奨
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  checkLimit(identifier: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];

    // 古いリクエストを削除
    const validRequests = requests.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    if (validRequests.length >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    return {
      allowed: true,
      remaining: this.maxRequests - validRequests.length,
    };
  }

  reset(identifier: string) {
    this.requests.delete(identifier);
  }
}

/**
 * SimpleRateLimiter（RateLimiterのエイリアス）
 */
export class SimpleRateLimiter extends RateLimiter {
  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    super(maxRequests, windowMs);
  }

  check(identifier: string): { allowed: boolean; remaining: number } {
    return this.checkLimit(identifier);
  }
}

/**
 * ファイルセキュリティ検証
 */

import { FILE_CONFIG } from "~/constants";

/**
 * ファイル名をサニタイズ（パストラバーサル、特殊文字除去）
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return "unnamed";

  return (
    filename
      // パストラバーサル対策
      .replaceAll(/\.\./g, "")
      .replaceAll(/[/\\]/g, "_")
      // 特殊文字を除去（英数字、ハイフン、アンダースコア、ドット、日本語のみ許可）
      .replaceAll(/[^\w\-.\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "_")
      // 連続するドットを1つに
      .replaceAll(/\.{2,}/g, ".")
      // 先頭のドットを除去（隠しファイル防止）
      .replace(/^\.+/, "")
      // 長さ制限
      .slice(0, FILE_CONFIG.MAX_FILENAME_LENGTH)
      .trim() || "unnamed"
  );
}

/**
 * ファイル拡張子を取得
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? `.${parts.pop()?.toLowerCase() || ""}` : "";
}

/**
 * MIMEタイプが許可されているか検証
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return FILE_CONFIG.ALLOWED_MIME_TYPES.includes(
    mimeType as (typeof FILE_CONFIG.ALLOWED_MIME_TYPES)[number]
  );
}

/**
 * ファイル拡張子がブロックされているか検証
 */
export function isBlockedExtension(filename: string): boolean {
  const ext = getFileExtension(filename);
  return FILE_CONFIG.BLOCKED_EXTENSIONS.includes(
    ext as (typeof FILE_CONFIG.BLOCKED_EXTENSIONS)[number]
  );
}

/**
 * ファイルサイズが制限内か検証
 */
export function isFileSizeValid(size: number): boolean {
  return size > 0 && size <= FILE_CONFIG.MAX_FILE_SIZE_BYTES;
}

/**
 * ファイルのmagic numberを検証（MIMEタイプ偽装対策）
 */
export function verifyFileSignature(
  buffer: ArrayBuffer,
  expectedMimeType: string
): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 16));

  // 主要なファイル形式のmagic number定義
  const signatures: Record<string, number[][]> = {
    "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
    "image/jpeg": [
      [0xff, 0xd8, 0xff],
      [0xff, 0xd8, 0xff, 0xe0],
      [0xff, 0xd8, 0xff, 0xe1],
    ],
    "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]], // PNG signature
    "image/gif": [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
    "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP)
    "application/zip": [
      [0x50, 0x4b, 0x03, 0x04], // ZIP
      [0x50, 0x4b, 0x05, 0x06], // ZIP empty
      [0x50, 0x4b, 0x07, 0x08], // ZIP spanned
    ],
    // Office形式（ZIPベース）
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
      [0x50, 0x4b, 0x03, 0x04],
    ],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
      [0x50, 0x4b, 0x03, 0x04],
    ],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      [[0x50, 0x4b, 0x03, 0x04]],
    // 動画形式
    "video/mp4": [
      [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp (24バイトオフセット)
      [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], // ftyp (32バイトオフセット)
      [0x66, 0x74, 0x79, 0x70], // ftyp (簡易版)
    ],
    "video/quicktime": [
      [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], // ftyp (20バイトオフセット)
      [0x66, 0x74, 0x79, 0x70], // ftyp (簡易版)
    ],
    "video/webm": [[0x1a, 0x45, 0xdf, 0xa3]], // EBML (WebM/Matroska)
    "video/x-msvideo": [[0x52, 0x49, 0x46, 0x46]], // RIFF (AVI)
    "video/x-matroska": [[0x1a, 0x45, 0xdf, 0xa3]], // EBML (Matroska)
    // テキスト系はmagic number検証スキップ
    "text/plain": [],
    "text/markdown": [],
    "text/csv": [],
    "text/html": [],
    "application/json": [],
  };

  const expectedSignatures = signatures[expectedMimeType];
  if (!expectedSignatures || expectedSignatures.length === 0) {
    return true; // テキスト系はスキップ
  }

  return expectedSignatures.some((signature) =>
    signature.every((byte, index) => bytes[index] === byte)
  );
}

/**
 * ファイルのSHA-256ハッシュを計算
 */
export async function calculateFileHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 包括的なファイル検証
 */
export async function validateFile(
  file:
    | File
    | {
        name: string;
        type: string;
        size: number;
        arrayBuffer: () => Promise<ArrayBuffer>;
      }
): Promise<{
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
  hash?: string;
}> {
  // ファイルサイズ検証
  if (!isFileSizeValid(file.size)) {
    return {
      valid: false,
      error: `ファイルサイズは${FILE_CONFIG.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB以下にしてください`,
    };
  }

  // ファイル名サニタイズ
  const sanitizedFilename = sanitizeFilename(file.name);

  // 拡張子ブロックチェック
  if (isBlockedExtension(sanitizedFilename)) {
    return {
      valid: false,
      error:
        "このファイル形式はセキュリティ上の理由によりアップロードできません",
    };
  }

  // MIMEタイプ検証
  if (!isAllowedMimeType(file.type)) {
    return {
      valid: false,
      error: "このファイル形式はサポートされていません",
    };
  }

  // ファイル内容の読み込み
  const buffer = await file.arrayBuffer();

  // Magic number検証（MIMEタイプ偽装対策）
  if (!verifyFileSignature(buffer, file.type)) {
    return {
      valid: false,
      error: "ファイル形式が正しくありません",
    };
  }

  // SHA-256ハッシュ計算
  const hash = await calculateFileHash(buffer);

  return {
    valid: true,
    sanitizedFilename,
    hash,
  };
}
