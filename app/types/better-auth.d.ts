/**
 * Better Authの型定義拡張
 *
 * ユーザーモデルとPasskeyモデルにカスタムフィールドを追加
 */

import "better-auth/types";

declare module "better-auth/types" {
  interface User {
    role: "admin" | "user";
  }
}

/**
 * Passkeyの型定義
 * データベーススキーマに基づく
 */
export interface Passkey {
  id: string;
  name: string | null;
  publicKey: string;
  userId: string;
  credentialID: string;
  counter: number;
  deviceType: string;
  backedUp: boolean; // Better Authではbooleanとして扱われる
  transports: string | null;
  createdAt: number;
  aaguid: string | null;
}
