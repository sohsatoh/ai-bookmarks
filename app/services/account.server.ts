/**
 * アカウント管理サービス
 *
 * セキュリティ機能:
 * - ユーザー認証（requireAuth）
 * - IDOR対策（ユーザーID一致確認）
 * - 入力検証
 * - トランザクション管理
 * - マージトークン（署名付き、有効期限付き）
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { users, accounts, sessions, userBookmarks } from "~/db/schema";
import type { AppLoadContext } from "react-router";

/**
 * マージトークンの有効期限（5分）
 */
const MERGE_TOKEN_EXPIRY_MS = 5 * 60 * 1000;

/**
 * マージトークンのペイロード
 */
interface MergeTokenPayload {
  userId: string;
  provider: string;
  timestamp: number;
}

/**
 * マージトークンを生成
 *
 * HMAC-SHA256で署名された一時トークンを生成します。
 * このトークンはOAuth認証フローで使用され、認証後のマージ処理で検証されます。
 *
 * @param userId - 現在のユーザーID（マージ先）
 * @param provider - マージするOAuthプロバイダー（google/github）
 * @param secret - 署名に使用するシークレット
 * @returns 署名付きトークン文字列
 */
export async function generateMergeToken(
  userId: string,
  provider: string,
  secret: string
): Promise<string> {
  const payload: MergeTokenPayload = {
    userId,
    provider,
    timestamp: Date.now(),
  };

  const payloadStr = JSON.stringify(payload);
  const payloadBase64 = btoa(payloadStr);

  // HMAC-SHA256で署名
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadBase64)
  );
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${payloadBase64}.${signatureBase64}`;
}

/**
 * マージトークンを検証
 *
 * 署名と有効期限を検証し、ペイロードを返します。
 *
 * @param token - 検証するトークン
 * @param secret - 署名検証に使用するシークレット
 * @returns 検証成功時はペイロード、失敗時はnull
 */
export async function verifyMergeToken(
  token: string,
  secret: string
): Promise<MergeTokenPayload | null> {
  try {
    const [payloadBase64, signatureBase64] = token.split(".");
    if (!payloadBase64 || !signatureBase64) {
      return null;
    }

    // 署名を検証
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = Uint8Array.from(atob(signatureBase64), (c) =>
      c.charCodeAt(0)
    );
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(payloadBase64)
    );

    if (!isValid) {
      return null;
    }

    // ペイロードをデコード
    const payload: MergeTokenPayload = JSON.parse(atob(payloadBase64));

    // 有効期限を検証
    if (Date.now() - payload.timestamp > MERGE_TOKEN_EXPIRY_MS) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * データベースインスタンスを取得
 */
export function getAccountDb(context: AppLoadContext) {
  return drizzle(context.cloudflare.env.DB);
}

/**
 * ユーザーの連携アカウント一覧を取得
 */
export async function getUserAccounts(
  db: ReturnType<typeof getAccountDb>,
  userId: string
) {
  return await db.select().from(accounts).where(eq(accounts.userId, userId));
}

/**
 * アカウント連携解除
 *
 * @throws {Error} バリデーションエラーまたは権限エラー
 */
export async function unlinkAccount(
  db: ReturnType<typeof getAccountDb>,
  userId: string,
  accountId: string
): Promise<{ success: boolean; error?: string }> {
  // バリデーション: accountIdの型チェック
  if (!accountId || typeof accountId !== "string") {
    return { success: false, error: "アカウントIDが指定されていません" };
  }

  // ユーザーのアカウント一覧を取得
  const userAccounts = await getUserAccounts(db, userId);

  // 最後のアカウントは削除不可（ログイン不能防止）
  if (userAccounts.length <= 1) {
    return {
      success: false,
      error:
        "最後のアカウントは削除できません。別の認証方法を追加してから削除してください。",
    };
  }

  // IDOR対策: 削除対象のアカウントが現在のユーザーに属しているか確認
  const targetAccount = userAccounts.find((acc) => acc.id === accountId);
  if (!targetAccount) {
    return {
      success: false,
      error: "指定されたアカウントが見つからないか、アクセス権限がありません",
    };
  }

  // アカウント削除（WHERE句でユーザーID一致も確認）
  await db
    .delete(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  return { success: true };
}

/**
 * アカウント完全削除（カスケード削除）
 *
 * すべてのユーザーデータを削除します：
 * - ブックマーク
 * - アカウント連携
 * - セッション
 * - ユーザー情報
 */
export async function deleteAccount(
  db: ReturnType<typeof getAccountDb>,
  userId: string
): Promise<void> {
  // カスケード削除を明示的に実行
  // schema.tsでonDelete: "cascade"が設定されているが、確実性のため明示的に削除

  // 1. ユーザーブックマーク削除（ユーザーID一致確認）
  await db.delete(userBookmarks).where(eq(userBookmarks.userId, userId));

  // 2. アカウント削除（ユーザーID一致確認）
  await db.delete(accounts).where(eq(accounts.userId, userId));

  // 3. セッション削除（ユーザーID一致確認）
  await db.delete(sessions).where(eq(sessions.userId, userId));

  // 4. ユーザー削除（本人確認）
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * セキュアなアカウントマージ
 *
 * OAuth認証で検証されたユーザーを別のユーザーに統合します。
 * この関数はOAuth認証フロー経由でのみ呼び出されるべきです。
 *
 * セキュリティ:
 * - sourceUserId: OAuth認証で検証されたユーザーID（マージ元）
 * - targetUserId: マージトークンで検証されたユーザーID（マージ先）
 * - クライアントからの任意の入力を受け付けない
 *
 * @param db - データベースインスタンス
 * @param targetUserId - マージ先ユーザーID（元のログインユーザー）
 * @param sourceUserId - マージ元ユーザーID（OAuth認証で新たに認証されたユーザー）
 * @returns マージ結果
 */
export async function mergeAccountSecure(
  db: ReturnType<typeof getAccountDb>,
  targetUserId: string,
  sourceUserId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  // バリデーション
  if (!targetUserId || !sourceUserId) {
    return { success: false, error: "ユーザーIDが指定されていません" };
  }

  // 同じユーザーの場合は何もしない
  if (targetUserId === sourceUserId) {
    return { success: true, message: "既に同じアカウントです" };
  }

  // ターゲットユーザーが存在するか確認
  const targetUser = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (targetUser.length === 0) {
    return { success: false, error: "マージ先ユーザーが見つかりません" };
  }

  // ソースユーザーが存在するか確認
  const sourceUser = await db
    .select()
    .from(users)
    .where(eq(users.id, sourceUserId))
    .limit(1);

  if (sourceUser.length === 0) {
    return { success: false, error: "マージ元ユーザーが見つかりません" };
  }

  // トランザクション内でデータマージを実行
  await db.batch([
    // 1. ブックマークをターゲットユーザーに移行
    db
      .update(userBookmarks)
      .set({ userId: targetUserId })
      .where(eq(userBookmarks.userId, sourceUserId)),

    // 2. アカウントをターゲットユーザーに移行
    db
      .update(accounts)
      .set({ userId: targetUserId })
      .where(eq(accounts.userId, sourceUserId)),

    // 3. ソースユーザーのセッションを削除
    db.delete(sessions).where(eq(sessions.userId, sourceUserId)),

    // 4. ソースユーザーを削除
    db.delete(users).where(eq(users.id, sourceUserId)),
  ]);

  return { success: true, message: "アカウントを統合しました" };
}
