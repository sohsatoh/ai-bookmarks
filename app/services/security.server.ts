/**
 * セキュリティユーティリティ関数
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * XSS対策: HTMLをサニタイズ（DOMPurifyを使用）
 * - すべてのHTMLタグとスクリプトを安全に処理
 * - 設定可能なオプション
 */
export function sanitizeHtml(
  html: string,
  options: {
    allowedTags?: string[];
    stripTags?: boolean;
  } = {}
): string {
  if (!html) return "";

  const { stripTags = true } = options;

  if (stripTags) {
    // すべてのHTMLタグを除去してプレーンテキストのみ抽出
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  }

  // 安全なHTMLのみ許可（デフォルト設定）
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: options.allowedTags || ["b", "i", "em", "strong", "a", "p", "br"],
    ALLOWED_ATTR: ["href", "title"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * HTMLエンティティをデコード（DOMPurify使用）
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";

  // DOMPurifyでサニタイズしてからテキスト抽出
  const sanitized = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  });

  // 一般的なHTMLエンティティをデコード
  const textarea = typeof document !== "undefined" ? document.createElement("textarea") : null;
  if (textarea) {
    textarea.innerHTML = sanitized;
    return textarea.value;
  }

  // フォールバック: 基本的なエンティティのみデコード
  return sanitized
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#39;/g, "'");
}

/**
 * Prompt Injection対策: ユーザー入力をサニタイズ
 * - 制御文字を除去
 * - プロンプトインジェクション用のキーワードをエスケープ
 * - 長さ制限
 */
export function sanitizeForPrompt(input: string, maxLength: number = 1000): string {
  if (!input) return "";

  return (
    input
      // 制御文字を除去（改行とタブ以外）
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
      // 連続する改行を1つに
      .replace(/\n{3,}/g, "\n\n")
      // 危険なプロンプトパターンをエスケープ
      .replace(/```/g, "'''")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}")
      // システムロール侵害パターンを無効化
      .replace(/(?:system|assistant|user):/gi, "$&_")
      // 指示注入パターンを無効化
      .replace(/(?:ignore|disregard|forget)\s+(?:previous|above|all)/gi, "[removed]")
      .trim()
      .slice(0, maxLength)
  );
}

/**
 * SQLインジェクション対策: 入力値の検証
 * Drizzle ORMはプリペアドステートメントを使用するが、追加のバリデーション
 */
export function validateTextInput(input: string, fieldName: string, minLength: number = 1, maxLength: number = 500): { valid: boolean; error?: string; sanitized?: string } {
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
  const dangerousPatterns = [/--/, /;.*(?:DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)/i, /UNION.*SELECT/i, /\/\*.*\*\//];

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
export function validateUrlStrict(urlString: string): { valid: boolean; error?: string; sanitizedUrl?: string } {
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
    if (!["http:", "https:"].includes(url.protocol)) {
      return { valid: false, error: "HTTPまたはHTTPSのURLのみ対応しています" };
    }

    // ホスト名が存在するか確認
    if (!url.hostname) {
      return { valid: false, error: "有効なホスト名が必要です" };
    }

    // ローカルホスト、プライベートIPへのアクセスを防ぐ（SSRF対策）
    const hostname = url.hostname.toLowerCase();
    const privatePatterns = [/^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./, /^169\.254\./, /^::1$/, /^fe80:/i];

    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) {
        return { valid: false, error: "プライベートIPアドレスは使用できません" };
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
export function validateAiResponse(response: any): {
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
    const validRequests = requests.filter((timestamp) => now - timestamp < this.windowMs);

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
