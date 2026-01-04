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
    "Mozilla/5.0 (compatible; BookmarkBot/1.0; +https://bookmarks.satoh.dev/bot)" as const,
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

  // ファイルアップロード
  /** ファイルアップロード（IPベース）: 5回/1分 */
  FILE_UPLOAD_IP_MAX_REQUESTS: 5,
  FILE_UPLOAD_IP_WINDOW_MS: 60 * 1000,
  /** ファイルアップロード（ユーザーベース）: 10回/1分 */
  FILE_UPLOAD_USER_MAX_REQUESTS: 10,
  FILE_UPLOAD_USER_WINDOW_MS: 60 * 1000,
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
// ファイル関連の設定
// ==================================================
export const FILE_CONFIG = {
  /** 最大ファイルサイズ（バイト）: 5MB */
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  /** 通常ユーザーの最大ファイル数 */
  MAX_FILES_PER_USER: 5,
  /** 管理者の最大ファイル数（無制限） */
  MAX_FILES_PER_ADMIN: Number.POSITIVE_INFINITY,
  /** ファイル名の最大文字数 */
  MAX_FILENAME_LENGTH: 255,
  /** 許可されるMIMEタイプ */
  ALLOWED_MIME_TYPES: [
    // ドキュメント
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // テキスト
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/html",
    "text/css",
    "text/javascript",
    "application/json",
    "application/xml",
    // 画像
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // 動画
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo",
    "video/x-matroska",
    // その他
    "application/zip",
  ] as const,
  /** 拒否する拡張子（実行可能ファイル等） */
  BLOCKED_EXTENSIONS: [
    ".exe",
    ".dll",
    ".bat",
    ".cmd",
    ".com",
    ".scr",
    ".vbs",
    ".js", // サーバー側では許可するがブラウザ実行を防ぐ
    ".jar",
    ".app",
    ".deb",
    ".rpm",
    ".sh",
    ".bash",
    ".ps1",
  ] as const,
  /** AI分析用の最大テキスト抽出サイズ（文字数） */
  MAX_AI_ANALYSIS_TEXT_LENGTH: 3000,
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
