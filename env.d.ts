/**
 * Custom environment variable type definitions
 * This file extends the Cloudflare.Env interface with Better Auth environment variables
 */

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    AI: Ai;
    
    // Better Auth環境変数
    BETTER_AUTH_URL: string;
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
  }
}
