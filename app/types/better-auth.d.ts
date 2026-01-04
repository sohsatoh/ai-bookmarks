/**
 * Better Authの型定義拡張
 * 
 * ユーザーモデルにカスタムフィールドを追加
 */

import "better-auth/types";

declare module "better-auth/types" {
  interface User {
    role: "admin" | "user";
  }
}
