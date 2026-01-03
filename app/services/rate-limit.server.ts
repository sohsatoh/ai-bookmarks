import { RATE_LIMIT_CONFIG } from "~/constants";

/**
 * レート制限機能
 * DoS攻撃を防ぐためのシンプルなレート制限
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// メモリベースのレート制限（シンプルな実装）
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * レート制限をチェック
 * @param identifier IPアドレスまたはユーザーID
 * @param maxRequests 制限時間内の最大リクエスト数
 * @param windowMs 制限時間（ミリ秒）
 * @returns 制限内ならtrue、超過ならfalse
 */
export function checkRateLimit(identifier: string, maxRequests: number = RATE_LIMIT_CONFIG.DEFAULT_MAX_REQUESTS, windowMs: number = RATE_LIMIT_CONFIG.DEFAULT_WINDOW_MS): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // エントリがないか、リセット時間を過ぎている場合
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetIn: windowMs,
    };
  }

  // リクエスト数が制限を超えている場合
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  // リクエスト数をインクリメント
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}

/**
 * 古いエントリをクリーンアップ（定期的に呼び出す）
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * IPアドレスを取得（Cloudflare環境に対応）
 */
export function getClientIp(request: Request): string {
  // Cloudflareのヘッダーから取得
  const cfConnectingIp = request.headers.get("CF-Connecting-IP");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // X-Forwarded-Forから取得
  const xForwardedFor = request.headers.get("X-Forwarded-For");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  // フォールバック
  return "unknown";
}
