import { drizzle } from "drizzle-orm/d1";
import { eq, asc } from "drizzle-orm";
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
      icon: null,
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
 * 全カテゴリ情報を取得（編集画面用）
 */
export async function getAllCategories(db: ReturnType<typeof getDb>) {
  return await db.select().from(categories);
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
  // カテゴリとブックマークを並行取得（displayOrderでソート）
  const [allCategories, results] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.displayOrder)),
    db
      .select({
        bookmark: bookmarks,
      })
      .from(bookmarks)
      .orderBy(asc(bookmarks.displayOrder)),
  ]);

  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  // データを整形
  const bookmarksWithCategories: BookmarkWithCategories[] = results.map((r) => {
    const majorCat = categoryMap.get(r.bookmark.majorCategoryId);
    const minorCat = categoryMap.get(r.bookmark.minorCategoryId);

    return {
      ...r.bookmark,
      majorCategory: {
        id: r.bookmark.majorCategoryId,
        name: majorCat?.name || "不明",
        icon: majorCat?.icon || null,
      },
      minorCategory: {
        id: r.bookmark.minorCategoryId,
        name: minorCat?.name || "不明",
        icon: minorCat?.icon || null,
      },
    };
  });

  // カテゴリ別にグループ化
  const grouped = new Map<number, Map<number, BookmarkWithCategories[]>>();

  for (const bookmark of bookmarksWithCategories) {
    const majorCatId = bookmark.majorCategory.id;
    const minorCatId = bookmark.minorCategory.id;

    if (!grouped.has(majorCatId)) {
      grouped.set(majorCatId, new Map());
    }

    const minorMap = grouped.get(majorCatId)!;
    if (!minorMap.has(minorCatId)) {
      minorMap.set(minorCatId, []);
    }

    minorMap.get(minorCatId)!.push(bookmark);
  }

  // 最終的なデータ構造に変換（displayOrderでソート）
  return Array.from(grouped.entries())
    .map(([majorCatId, minorMap]) => {
      const majorCat = categoryMap.get(majorCatId);
      return {
        majorCategory: majorCat?.name || "不明",
        majorCategoryIcon: majorCat?.icon || null,
        majorCategoryId: majorCatId,
        majorCategoryOrder: majorCat?.displayOrder || 0,
        minorCategories: Array.from(minorMap.entries())
          .map(([minorCatId, bookmarks]) => {
            const minorCat = categoryMap.get(minorCatId);
            return {
              minorCategory: minorCat?.name || "不明",
              minorCategoryIcon: minorCat?.icon || null,
              minorCategoryId: minorCatId,
              minorCategoryOrder: minorCat?.displayOrder || 0,
              bookmarks,
            };
          })
          .sort((a, b) => a.minorCategoryOrder - b.minorCategoryOrder),
      };
    })
    .sort((a, b) => a.majorCategoryOrder - b.majorCategoryOrder);
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

/**
 * ブックマークの表示順序を更新（楽観的ロック付き）
 */
export async function updateBookmarkOrder(db: ReturnType<typeof getDb>, bookmarkId: number, newOrder: number, expectedVersion?: number): Promise<{ success: boolean; currentVersion?: number }> {
  // バージョンチェックが有効な場合、現在のバージョンを確認
  if (expectedVersion !== undefined) {
    const current = await db.select().from(bookmarks).where(eq(bookmarks.id, bookmarkId)).limit(1);
    if (current.length === 0) {
      return { success: false };
    }
    if (current[0].version !== expectedVersion) {
      return { success: false, currentVersion: current[0].version };
    }
  }

  // 更新実行（バージョンをインクリメント）
  await db
    .update(bookmarks)
    .set({
      displayOrder: newOrder,
      version: expectedVersion !== undefined ? expectedVersion + 1 : undefined,
    })
    .where(eq(bookmarks.id, bookmarkId));

  return { success: true };
}

/**
 * カテゴリの表示順序を更新（楽観的ロック付き）
 */
export async function updateCategoryOrder(db: ReturnType<typeof getDb>, categoryId: number, newOrder: number, expectedVersion?: number): Promise<{ success: boolean; currentVersion?: number }> {
  // バージョンチェックが有効な場合、現在のバージョンを確認
  if (expectedVersion !== undefined) {
    const current = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    if (current.length === 0) {
      return { success: false };
    }
    if (current[0].version !== expectedVersion) {
      return { success: false, currentVersion: current[0].version };
    }
  }

  // 更新実行（バージョンをインクリメント）
  await db
    .update(categories)
    .set({
      displayOrder: newOrder,
      version: expectedVersion !== undefined ? expectedVersion + 1 : undefined,
    })
    .where(eq(categories.id, categoryId));

  return { success: true };
}
