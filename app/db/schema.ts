import { sqliteTable, text, integer, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

// カテゴリテーブル（大カテゴリ・小カテゴリを統合）
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["major", "minor"] }).notNull(), // major: 大カテゴリ, minor: 小カテゴリ
  parentId: integer("parent_id").references((): AnySQLiteColumn => categories.id), // 小カテゴリの場合、親カテゴリID
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ブックマークテーブル
export const bookmarks = sqliteTable("bookmarks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  majorCategoryId: integer("major_category_id")
    .notNull()
    .references(() => categories.id),
  minorCategoryId: integer("minor_category_id")
    .notNull()
    .references(() => categories.id),
  // 将来のユーザー分離対応用（現在はNULL許容）
  userId: text("user_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
