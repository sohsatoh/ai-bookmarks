import { SECURITY_CONFIG } from "~/constants";

/**
 * セキュリティユーティリティ関数
 * Cloudflare Workers環境向け（DOM APIなし）
 */

/**
 * XSS対策: HTMLタグを除去してプレーンテキスト化
 * サーバー側でのスクレイピング時に使用
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";

  return (
    html
      // script, styleタグとその内容を削除
      .replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replaceAll(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      // その他のHTMLタグを削除
      .replaceAll(/<[^>]+>/g, " ")
      // 複数の空白を1つに
      .replaceAll(/\s+/g, " ")
      .trim()
  );
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
