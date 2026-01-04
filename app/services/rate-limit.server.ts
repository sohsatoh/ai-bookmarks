import { RATE_LIMIT_CONFIG } from "~/constants";

/**
 * レート制限機能（IPベースとユーザーベース）
 * DoS攻撃を防ぐための包括的なレート制限
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// メモリベースのレート制限（シンプルな実装）
// 本番環境ではCloudflare Workers KVやDurable Objectsの使用を推奨
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * レート制限をチェック
 * @param identifier IPアドレスまたはユーザーID（プレフィックス付き）
 * @param maxRequests 制限時間内の最大リクエスト数
 * @param windowMs 制限時間（ミリ秒）
 * @returns 制限内ならtrue、超過ならfalse
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = RATE_LIMIT_CONFIG.DEFAULT_MAX_REQUESTS,
  windowMs: number = RATE_LIMIT_CONFIG.DEFAULT_WINDOW_MS
): { allowed: boolean; remaining: number; resetIn: number } {
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
 * 複合レート制限チェック（IPとユーザーの両方）
 * @param ip IPアドレス
 * @param userId ユーザーID（オプション）
 * @param ipLimit IPベースの制限設定
 * @param userLimit ユーザーベースの制限設定
 * @returns 両方の制限内ならtrue、超過ならfalse
 */
export function checkCombinedRateLimit(
  ip: string,
  userId: string | null | undefined,
  ipLimit: { max: number; window: number },
  userLimit?: { max: number; window: number }
): {
  allowed: boolean;
  reason?: "ip" | "user";
  resetIn: number;
  remaining: number;
} {
  // IPベースのチェック
  const ipKey = `ip:${ip}`;
  const ipResult = checkRateLimit(ipKey, ipLimit.max, ipLimit.window);

  if (!ipResult.allowed) {
    return {
      allowed: false,
      reason: "ip",
      resetIn: ipResult.resetIn,
      remaining: 0,
    };
  }

  // ユーザーベースのチェック（認証済みの場合）
  if (userId && userLimit) {
    const userKey = `user:${userId}`;
    const userResult = checkRateLimit(userKey, userLimit.max, userLimit.window);

    if (!userResult.allowed) {
      return {
        allowed: false,
        reason: "user",
        resetIn: userResult.resetIn,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      resetIn: Math.min(ipResult.resetIn, userResult.resetIn),
      remaining: Math.min(ipResult.remaining, userResult.remaining),
    };
  }

  return {
    allowed: true,
    resetIn: ipResult.resetIn,
    remaining: ipResult.remaining,
  };
}

/**
 * AI処理のレート制限チェック
 */
export function checkAIRateLimit(
  ip: string,
  userId: string
): {
  allowed: boolean;
  reason?: "ip" | "user";
  resetIn: number;
  remaining: number;
} {
  return checkCombinedRateLimit(
    ip,
    userId,
    {
      max: RATE_LIMIT_CONFIG.AI_IP_MAX_REQUESTS,
      window: RATE_LIMIT_CONFIG.AI_IP_WINDOW_MS,
    },
    {
      max: RATE_LIMIT_CONFIG.AI_USER_MAX_REQUESTS,
      window: RATE_LIMIT_CONFIG.AI_USER_WINDOW_MS,
    }
  );
}

/**
 * ブックマーク追加のレート制限チェック
 */
export function checkBookmarkAddRateLimit(
  ip: string,
  userId: string
): {
  allowed: boolean;
  reason?: "ip" | "user";
  resetIn: number;
  remaining: number;
} {
  return checkCombinedRateLimit(
    ip,
    userId,
    {
      max: RATE_LIMIT_CONFIG.BOOKMARK_ADD_IP_MAX_REQUESTS,
      window: RATE_LIMIT_CONFIG.BOOKMARK_ADD_IP_WINDOW_MS,
    },
    {
      max: RATE_LIMIT_CONFIG.BOOKMARK_ADD_USER_MAX_REQUESTS,
      window: RATE_LIMIT_CONFIG.BOOKMARK_ADD_USER_WINDOW_MS,
    }
  );
}

/**
 * 一般的な変更操作のレート制限チェック
 */
export function checkMutationRateLimit(
  ip: string,
  userId: string
): {
  allowed: boolean;
  reason?: "ip" | "user";
  resetIn: number;
  remaining: number;
} {
  return checkCombinedRateLimit(
    ip,
    userId,
    {
      max: RATE_LIMIT_CONFIG.MUTATION_IP_MAX_REQUESTS,
      window: RATE_LIMIT_CONFIG.MUTATION_IP_WINDOW_MS,
    },
    {
      max: RATE_LIMIT_CONFIG.MUTATION_USER_MAX_REQUESTS,
      window: RATE_LIMIT_CONFIG.MUTATION_USER_WINDOW_MS,
    }
  );
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

  // フォールバック
  return "unknown";
}

// 定期的なクリーンアップ（5分ごと）
if (typeof setInterval !== "undefined") {
  setInterval(cleanupRateLimitStore, RATE_LIMIT_CONFIG.CLEANUP_INTERVAL_MS);
}
