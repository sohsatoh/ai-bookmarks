import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import { bookmarks, categories } from "~/db/schema";
import type { BookmarkWithCategories, BookmarksByCategory } from "~/types/bookmark";

/**
 * Drizzle ORMのインスタンスを取得
 */
export function getDb(d1Database: D1Database) {
  return drizzle(d1Database);
}

/**
 * カテゴリを取得または作成
 */
export async function getOrCreateCategory(db: ReturnType<typeof getDb>, name: string, type: "major" | "minor", parentId?: number): Promise<number> {
  // 既存のカテゴリを検索
  const existing = await db.select().from(categories).where(eq(categories.name, name)).limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // 新規作成
  const result = await db
    .insert(categories)
    .values({
      name,
      type,
      parentId: parentId || null,
    })
    .returning({ id: categories.id });

  return result[0].id;
}

/**
 * 既存のカテゴリ名を取得（AI生成時の参考用）
 */
export async function getExistingCategories(db: ReturnType<typeof getDb>): Promise<{ major: string[]; minor: string[] }> {
  const allCategories = await db.select().from(categories);

  return {
    major: allCategories.filter((c) => c.type === "major").map((c) => c.name),
    minor: allCategories.filter((c) => c.type === "minor").map((c) => c.name),
  };
}

/**
 * ブックマークを作成
 */
export async function createBookmark(
  db: ReturnType<typeof getDb>,
  data: {
    url: string;
    title: string;
    description: string;
    majorCategoryId: number;
    minorCategoryId: number;
    userId?: string | null;
  }
): Promise<{ id: number }> {
  const result = await db
    .insert(bookmarks)
    .values({
      ...data,
      userId: data.userId || null,
    })
    .returning({ id: bookmarks.id });

  return result[0];
}

/**
 * 全ブックマークをカテゴリ別に取得
 */
export async function getAllBookmarks(db: ReturnType<typeof getDb>): Promise<BookmarksByCategory[]> {
  // ブックマークとカテゴリをJOINして取得
  const results = await db
    .select({
      bookmark: bookmarks,
      majorCategory: {
        id: categories.id,
        name: categories.name,
      },
    })
    .from(bookmarks)
    .innerJoin(categories, eq(bookmarks.majorCategoryId, categories.id))
    .orderBy(desc(bookmarks.createdAt));

  // 小カテゴリ情報を別途取得
  const minorCategories = await db.select().from(categories).where(eq(categories.type, "minor"));

  const minorCategoryMap = new Map(minorCategories.map((c) => [c.id, c.name]));

  // データを整形
  const bookmarksWithCategories: BookmarkWithCategories[] = results.map((r) => ({
    ...r.bookmark,
    majorCategory: r.majorCategory,
    minorCategory: {
      id: r.bookmark.minorCategoryId,
      name: minorCategoryMap.get(r.bookmark.minorCategoryId) || "不明",
    },
  }));

  // カテゴリ別にグループ化
  const grouped = new Map<string, Map<string, BookmarkWithCategories[]>>();

  for (const bookmark of bookmarksWithCategories) {
    const majorCat = bookmark.majorCategory.name;
    const minorCat = bookmark.minorCategory.name;

    if (!grouped.has(majorCat)) {
      grouped.set(majorCat, new Map());
    }

    const minorMap = grouped.get(majorCat)!;
    if (!minorMap.has(minorCat)) {
      minorMap.set(minorCat, []);
    }

    minorMap.get(minorCat)!.push(bookmark);
  }

  // 最終的なデータ構造に変換
  return Array.from(grouped.entries()).map(([majorCategory, minorMap]) => ({
    majorCategory,
    minorCategories: Array.from(minorMap.entries()).map(([minorCategory, bookmarks]) => ({
      minorCategory,
      bookmarks,
    })),
  }));
}

/**
 * ブックマークを削除
 */
export async function deleteBookmark(db: ReturnType<typeof getDb>, id: number): Promise<void> {
  await db.delete(bookmarks).where(eq(bookmarks.id, id));
}

/**
 * URLの重複チェック
 */
export async function checkDuplicateUrl(db: ReturnType<typeof getDb>, url: string): Promise<boolean> {
  const existing = await db.select().from(bookmarks).where(eq(bookmarks.url, url)).limit(1);

  return existing.length > 0;
}
