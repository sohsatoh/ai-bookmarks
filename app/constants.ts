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
  USER_AGENT:
    "Mozilla/5.0 (compatible; BookmarkBot/1.0; +https://example.com/bot)" as const,
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

  // 認証関連（Better Auth内蔵のレート制限に加えて追加保護）
  /** ログイン試行（IPベース）: 5回/5分 */
  AUTH_IP_MAX_REQUESTS: 5,
  AUTH_IP_WINDOW_MS: 5 * 60 * 1000,
  /** ログイン試行（ユーザーベース）: 3回/15分 */
  AUTH_USER_MAX_REQUESTS: 3,
  AUTH_USER_WINDOW_MS: 15 * 60 * 1000,

  // AI処理関連
  /** AI処理（IPベース）: 10回/1分 */
  AI_IP_MAX_REQUESTS: 10,
  AI_IP_WINDOW_MS: 60 * 1000,
  /** AI処理（ユーザーベース）: 20回/1分 */
  AI_USER_MAX_REQUESTS: 20,
  AI_USER_WINDOW_MS: 60 * 1000,

  // ブックマーク追加（AI処理を含む）
  /** ブックマーク追加（IPベース）: 10回/1分 */
  BOOKMARK_ADD_IP_MAX_REQUESTS: 10,
  BOOKMARK_ADD_IP_WINDOW_MS: 60 * 1000,
  /** ブックマーク追加（ユーザーベース）: 30回/1分 */
  BOOKMARK_ADD_USER_MAX_REQUESTS: 30,
  BOOKMARK_ADD_USER_WINDOW_MS: 60 * 1000,

  // 一般的な変更操作
  /** 一般的な変更操作（IPベース）: 30回/1分 */
  MUTATION_IP_MAX_REQUESTS: 30,
  MUTATION_IP_WINDOW_MS: 60 * 1000,
  /** 一般的な変更操作（ユーザーベース）: 60回/1分 */
  MUTATION_USER_MAX_REQUESTS: 60,
  MUTATION_USER_WINDOW_MS: 60 * 1000,
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
