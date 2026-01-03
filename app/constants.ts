/**
 * アプリケーション全体で使用する定数
 */

// ==================================================
// AI関連の設定
// ==================================================
export const AI_CONFIG = {
  /** 使用するAIモデル */
  MODEL_NAME: "@cf/openai/gpt-oss-120b" as const,
  /** AI応答の最大トークン数 */
  MAX_TOKENS: 300,
  /** AIプロンプトへのタイトルの最大文字数 */
  TITLE_MAX_LENGTH: 300,
  /** AIプロンプトへの説明の最大文字数 */
  DESCRIPTION_MAX_LENGTH: 500,
  /** AIプロンプトへのコンテンツの最大文字数 */
  CONTENT_MAX_LENGTH: 1500,
  /** カテゴリ名の最大文字数 */
  CATEGORY_MAX_LENGTH: 100,
  /** AI生成の説明文の最大文字数 */
  GENERATED_DESCRIPTION_MAX_LENGTH: 150,
} as const;

// ==================================================
// スクレイピング関連の設定
// ==================================================
export const SCRAPER_CONFIG = {
  /** User-Agent文字列 */
  USER_AGENT: "Mozilla/5.0 (compatible; BookmarkBot/1.0; +https://example.com/bot)" as const,
  /** フェッチタイムアウト（ミリ秒） */
  FETCH_TIMEOUT_MS: 10000,
  /** 最大コンテンツサイズ（バイト）: 5MB */
  MAX_CONTENT_SIZE_BYTES: 5 * 1024 * 1024,
  /** 抽出したタイトルの最大文字数 */
  TITLE_MAX_LENGTH: 150,
  /** 抽出した説明の最大文字数 */
  DESCRIPTION_MAX_LENGTH: 300,
  /** 抽出したボディコンテンツの最大文字数 */
  BODY_MAX_LENGTH: 1500,
  /** 結合後のコンテンツの最大文字数 */
  CONTENT_MAX_LENGTH: 1500,
} as const;

// ==================================================
// レート制限関連の設定
// ==================================================
export const RATE_LIMIT_CONFIG = {
  /** デフォルトの最大リクエスト数 */
  DEFAULT_MAX_REQUESTS: 10,
  /** デフォルトの制限時間（ミリ秒）: 1分 */
  DEFAULT_WINDOW_MS: 1 * 60 * 1000,
  /** クリーンアップ間隔（ミリ秒）: 5分 */
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
} as const;

// ==================================================
// セキュリティ関連の設定
// ==================================================
export const SECURITY_CONFIG = {
  /** サニタイズ後のテキストのデフォルト最大長 */
  DEFAULT_SANITIZED_TEXT_MAX_LENGTH: 1000,
  /** 許可されるURLプロトコル */
  ALLOWED_URL_PROTOCOLS: ["http:", "https:"] as const,
  /** ブロックするIPアドレス範囲（プライベートIPなど） */
  BLOCKED_IP_PATTERNS: [
    /^127\./, // localhost
    /^10\./, // プライベートIP (10.0.0.0/8)
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // プライベートIP (172.16.0.0/12)
    /^192\.168\./, // プライベートIP (192.168.0.0/16)
    /^169\.254\./, // リンクローカル
    /^::1$/, // IPv6 localhost
    /^fc00:/, // IPv6 プライベート
    /^fe80:/, // IPv6 リンクローカル
  ] as const,
} as const;

// ==================================================
// UI関連の設定
// ==================================================
export const UI_CONFIG = {
  /** ポーリング間隔（ミリ秒） */
  POLLING_INTERVAL_MS: 8000,
  /** 最大幅（PC表示） */
  MAX_WIDTH_PX: 1400,
  /** トーストの表示時間（ミリ秒） */
  TOAST_DURATION_MS: 10000,
} as const;
