/**
 * Better Auth認証サービス
 *
 * GoogleとGitHubのOAuth認証を提供します。
 * セキュリティ対策:
 * - CSRF保護（Origin検証、state/PKCE検証、SameSite=Lax）
 * - セッション管理（サーバーサイドセッション、自動有効期限延長）
 * - セキュアクッキー（httpOnly, secure）
 * - IPトラッキング（不正アクセス検出用）
 *
 * OWASP推奨事項に準拠:
 * - OAuth 2.0 (RFC 6749)
 * - PKCE (RFC 7636)
 * - セッション管理のベストプラクティス
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { AppLoadContext } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import { users } from "~/db/schema";

/**
 * Better Auth設定
 *
 * @param context - React Router AppLoadContext（D1、環境変数を含む）
 * @returns Better Auth インスタンス
 */
export function createAuth(context: AppLoadContext) {
  const db = drizzle(context.cloudflare.env.DB, { schema });

  return betterAuth({
    // データベースアダプター（Drizzle ORM使用）
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),

    // 基本設定
    baseURL: context.cloudflare.env.BETTER_AUTH_URL,
    secret: context.cloudflare.env.BETTER_AUTH_SECRET,

    // セッション設定
    session: {
      // セッション有効期限（7日間）
      expiresIn: 60 * 60 * 24 * 7, // 秒単位
      // セッション更新間隔（1日）- この間隔で有効期限が延長される
      updateAge: 60 * 60 * 24, // 秒単位
      // cookieキャッシュの有効化（パフォーマンス向上）
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5分
      },
    },

    // ソーシャルログインプロバイダー設定
    socialProviders: {
      google: {
        clientId: context.cloudflare.env.GOOGLE_CLIENT_ID,
        clientSecret: context.cloudflare.env.GOOGLE_CLIENT_SECRET,
        // スコープ: プロフィール情報とメールアドレス
        scope: ["openid", "email", "profile"],
      },
      github: {
        clientId: context.cloudflare.env.GITHUB_CLIENT_ID,
        clientSecret: context.cloudflare.env.GITHUB_CLIENT_SECRET,
        // スコープ: メールアドレスの読み取り
        scope: ["user:email"],
      },
    },

    // アカウント連携設定（セキュリティ重視）
    account: {
      accountLinking: {
        // メールアドレスによる自動アカウント統合を無効化
        // セキュリティ理由: https://zenn.dev/ritou/articles/ca7be3f329e68f
        // - メールアドレスは変更可能でリサイクルされる可能性がある
        // - Pre-hijacking攻撃のリスクを回避
        // - OAuth ProviderのユーザーID（accountId）のみで紐付けを管理
        enabled: false,
        trustedProviders: [], // 自動統合を行わない
        allowDifferentEmails: false, // 異なるメールアドレスでの統合を禁止
      },
    },

    // 高度なセキュリティ設定
    advanced: {
      // CSRF保護を有効化（デフォルトでtrue）
      disableCSRFCheck: false,

      // セキュアクッキーの使用（本番環境で必須）
      useSecureCookies:
        context.cloudflare.env.BETTER_AUTH_URL.startsWith("https://"),

      // IPトラッキング設定
      ipAddress: {
        // CloudflareのIPヘッダーを使用
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
        // IPトラッキングを有効化
        disableIpTracking: false,
      },

      // デフォルトクッキー属性
      defaultCookieAttributes: {
        // JavaScriptからアクセス不可（XSS対策）
        httpOnly: true,
        // HTTPS接続でのみ送信（本番環境）
        secure: context.cloudflare.env.BETTER_AUTH_URL.startsWith("https://"),
        // CSRF対策（Lax: 通常のリンクでは送信、POSTでは同一サイトのみ）
        sameSite: "lax",
        // クッキーのパス
        path: "/",
      },

      // データベース設定
      database: {
        // UUID v4を使用したID生成（セキュアなランダムID）
        generateId: () => crypto.randomUUID(),
      },
    },

    // トラストされたOrigin（セキュリティ強化）
    trustedOrigins: [
      context.cloudflare.env.BETTER_AUTH_URL, // 本番/開発URL
      "https://*.pages.dev",                   // Cloudflare Pagesプレビュー環境
      "http://localhost:*",                    // ローカル開発（任意ポート）
    ],

    // Rate Limiting（ブルートフォース攻撃対策）
    rateLimit: {
      enabled: true,
      window: 60,        // 60秒のウィンドウ
      max: 10,           // ウィンドウ内で10リクエスト
      storage: "database", // D1に保存
    },

    // クッキー名のカスタマイズ（フィンガープリンティング対策）
    cookies: {
      sessionToken: {
        name: "__Host-auth.session",
        attributes: {
          httpOnly: true,
          secure: context.cloudflare.env.BETTER_AUTH_URL.startsWith("https://"),
          sameSite: "lax",
          path: "/",
        },
      },
    },
  });
}

/**
 * セッションからユーザー情報を取得（roleを含む完全なユーザー情報）
 *
 * @param request - Request オブジェクト
 * @param context - AppLoadContext
 * @returns ユーザー情報（認証されていない場合はnull）
 */
export async function getSession(request: Request, context: AppLoadContext) {
  const auth = createAuth(context);

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return null;
    }

    // DBから完全なユーザー情報（role含む）を取得
    const db = drizzle(context.cloudflare.env.DB);
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (userResult.length === 0) {
      return null;
    }

    // セッション情報にDBのユーザー情報をマージ
    return {
      ...session,
      user: {
        ...session.user,
        role: userResult[0].role,
      },
    };
  } catch (error) {
    console.error("セッション取得エラー:", error);
    return null;
  }
}

/**
 * ユーザーが認証されているか確認
 *
 * @param request - Request オブジェクト
 * @param context - AppLoadContext
 * @returns 認証されている場合true
 */
export async function requireAuth(request: Request, context: AppLoadContext) {
  const session = await getSession(request, context);

  if (!session) {
    throw new Response("認証が必要です", { status: 401 });
  }

  return session;
}

/**
 * ユーザーがadmin権限を持っているか確認
 *
 * @param session - セッションオブジェクト
 * @returns admin権限がある場合true
 */
export function hasAdminRole(
  session: { user: { role?: string } } | null
): boolean {
  return session?.user?.role === "admin";
}

/**
 * admin権限が必要な操作で使用
 *
 * @param request - Request オブジェクト
 * @param context - AppLoadContext
 * @returns admin権限がある場合、セッションを返す
 * @throws admin権限がない場合、403エラー
 */
export async function requireAdmin(request: Request, context: AppLoadContext) {
  const session = await requireAuth(request, context);

  if (!hasAdminRole(session)) {
    throw new Response("管理者権限が必要です", { status: 403 });
  }

  return session;
}

/**
 * セッションを無効化（ログアウト）
 *
 * @param request - Request オブジェクト
 * @param context - AppLoadContext
 */
export async function signOut(request: Request, context: AppLoadContext) {
  const auth = createAuth(context);

  try {
    await auth.api.signOut({
      headers: request.headers,
    });
  } catch (error) {
    console.error("ログアウトエラー:", error);
    throw new Error("ログアウトに失敗しました");
  }
}
