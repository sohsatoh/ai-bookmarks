import {
  sqliteTable,
  text,
  integer,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

// ユーザーテーブル（Better Auth用）
export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"), // プロフィール画像URL（オプショナル）
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"), // デフォルトはuser、adminは手動設定
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// セッションテーブル（Better Auth用）
export const sessions = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(), // セッショントークン
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// OAuthアカウントテーブル（Better Auth用）
export const accounts = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(), // プロバイダー側のユーザーID
  providerId: text("provider_id").notNull(), // "google" or "github"
  accessToken: text("access_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }), // アクセストークン有効期限
  refreshToken: text("refresh_token"),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }), // リフレッシュトークン有効期限
  idToken: text("id_token"), // OpenID Connect IDトークン
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  scope: text("scope"), // OAuthスコープ
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 検証テーブル（Better Auth用 - PKCE, state等）
export const verifications = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// レート制限テーブル（Better Auth用 - ブルートフォース攻撃対策）
export const rateLimits = sqliteTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(), // Unixタイムスタンプ（ミリ秒）
});

// カテゴリマスターテーブル（全ユーザー共有）
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // カテゴリ名（ユニーク制約で重複防止）
  type: text("type", { enum: ["major", "minor"] }).notNull(), // major: 大カテゴリ, minor: 小カテゴリ
  parentId: integer("parent_id").references(
    (): AnySQLiteColumn => categories.id
  ), // 小カテゴリの場合、親カテゴリID
  icon: text("icon"), // SVGアイコン（AI生成）
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// URLマスターテーブル（全ユーザー共有、AI生成メタデータ保存）
export const urls = sqliteTable("urls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull().unique(), // URL（ユニーク制約で重複防止）
  title: text("title").notNull(),
  description: text("description").notNull(),
  majorCategoryId: integer("major_category_id")
    .notNull()
    .references(() => categories.id),
  minorCategoryId: integer("minor_category_id")
    .notNull()
    .references(() => categories.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ユーザーブックマークテーブル（ユーザー固有のブックマーク設定）
export const userBookmarks = sqliteTable("user_bookmarks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // ユーザーIDで分離
  urlId: integer("url_id")
    .notNull()
    .references(() => urls.id, { onDelete: "cascade" }), // URL参照
  isStarred: integer("is_starred", { mode: "boolean" })
    .notNull()
    .default(false),
  readStatus: text("read_status", { enum: ["unread", "read"] })
    .notNull()
    .default("unread"),
  isArchived: integer("is_archived", { mode: "boolean" })
    .notNull()
    .default(false),
  displayOrder: integer("display_order").notNull().default(0), // 表示順序
  version: integer("version").notNull().default(0), // 楽観的ロック用バージョン
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Url = typeof urls.$inferSelect;
export type NewUrl = typeof urls.$inferInsert;
export type UserBookmark = typeof userBookmarks.$inferSelect;
export type NewUserBookmark = typeof userBookmarks.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
