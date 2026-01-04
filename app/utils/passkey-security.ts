/**
 * パスキーセキュリティ検証
 *
 * 検出された脆弱性:
 *
 * 1. IDOR（Insecure Direct Object Reference）- 重大度: 高
 *    - パスキー削除・更新時にユーザーID検証なし
 *    - 攻撃者が他のユーザーのパスキーIDを推測できれば削除・変更可能
 *    - 対策: サーバーサイドでユーザーID検証を追加
 *
 * 2. レート制限なし - 重大度: 中
 *    - パスキー追加/削除にレート制限なし
 *    - ブルートフォース攻撃でパスキーIDを推測される可能性
 *    - 対策: レート制限を追加
 *
 * 3. セッション固定攻撃 - 重大度: 低
 *    - Better Authがセッション管理を適切に処理
 *    - 既存の実装で対策済み
 *
 * 4. XSS（クロスサイトスクリプティング）- 重大度: 中
 *    - パスキー名のユーザー入力がエスケープされずに表示
 *    - Reactの自動エスケープで一部対策済みだが、DOMPurifyで強化推奨
 *
 * 5. 入力検証不足 - 重大度: 低
 *    - パスキー名の長さ制限なし
 *    - 対策: 最大長を設定（255文字）
 *
 * 6. CSRF（クロスサイトリクエストフォージェリ）- 重大度: 低
 *    - Better AuthのCSRF保護が有効
 *    - クライアントサイドAPIはBetter Auth経由なので保護済み
 *
 * 推奨される修正:
 * 1. サーバーサイドでパスキー所有権検証を追加
 * 2. パスキー名の入力検証を強化（長さ制限、特殊文字チェック）
 * 3. レート制限を追加
 * 4. 監査ログを追加（誰がいつパスキーを追加/削除したか）
 */

// セキュリティ定数
export const PASSKEY_SECURITY = {
  // パスキー名の最大長
  MAX_NAME_LENGTH: 255,

  // パスキー名に許可される文字（英数字、スペース、一部記号）
  ALLOWED_NAME_PATTERN: /^[\w\s\-_.()]+$/,

  // レート制限（60秒で最大5回のパスキー操作）
  RATE_LIMIT: {
    WINDOW: 60,
    MAX_REQUESTS: 5,
  },
} as const;

/**
 * パスキー名のバリデーション
 * @param name - 検証するパスキー名
 * @returns バリデーション結果
 */
export function validatePasskeyName(name: string): {
  isValid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { isValid: true }; // 空は許可（自動生成される）
  }

  if (name.length > PASSKEY_SECURITY.MAX_NAME_LENGTH) {
    return {
      isValid: false,
      error: `パスキー名は${PASSKEY_SECURITY.MAX_NAME_LENGTH}文字以内にしてください`,
    };
  }

  // XSS対策: 危険な文字列をチェック
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i, // onclick=, onload=等
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      return {
        isValid: false,
        error: "パスキー名に使用できない文字が含まれています",
      };
    }
  }

  return { isValid: true };
}

/**
 * パスキー名のサニタイズ（追加の安全対策）
 * @param name - サニタイズするパスキー名
 * @returns サニタイズされた名前
 */
export function sanitizePasskeyName(name: string): string {
  return name
    .trim()
    .substring(0, PASSKEY_SECURITY.MAX_NAME_LENGTH)
    .replace(/[<>]/g, ""); // HTMLタグの開始・終了記号を削除
}
