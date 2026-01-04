/**
 * Cloudflare Workers環境変数の型定義拡張
 * 
 * wrangler typesで生成される型定義を拡張し、
 * シークレット変数を含む完全な型安全性を提供します。
 */

declare namespace Cloudflare {
  interface Env {
    // Better Auth
    BETTER_AUTH_URL: string;
    BETTER_AUTH_SECRET: string;
    
    // OAuth Providers
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    
    // Cloudflare Bindings
    DB: D1Database;
    AI: Ai;
  }
}
