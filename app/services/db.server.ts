import { drizzle } from "drizzle-orm/d1";
import { eq, asc, and } from "drizzle-orm";
import { bookmarks, categories } from "~/db/schema";
import type {
  BookmarkWithCategories,
  BookmarksByCategory,
} from "~/types/bookmark";

/**
 * Drizzle ORMのインスタンスを取得
 */
export function getDb(d1Database: D1Database) {
  return drizzle(d1Database);
}

/**
 * カテゴリを取得または作成（ユーザーIDでフィルタ）
 */
export async function getOrCreateCategory(
  db: ReturnType<typeof getDb>,
  userId: string,
  name: string,
  type: "major" | "minor",
  parentId?: number
): Promise<number> {
  // 既存のカテゴリを検索（ユーザーIDでフィルタ）
  const existing = await db
    .select()
    .from(categories)
    .where(and(eq(categories.name, name), eq(categories.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // 新規作成
  const result = await db
    .insert(categories)
    .values({
      userId,
      name,
      type,
      parentId: parentId || null,
      icon: null,
    })
    .returning({ id: categories.id });

  return result[0].id;
}

/**
 * 既存のカテゴリ名を取得（AI生成時の参考用、ユーザーIDでフィルタ）
 */
export async function getExistingCategories(
  db: ReturnType<typeof getDb>,
  userId: string
): Promise<{ major: string[]; minor: string[] }> {
  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));

  return {
    major: allCategories.filter((c) => c.type === "major").map((c) => c.name),
    minor: allCategories.filter((c) => c.type === "minor").map((c) => c.name),
  };
}

/**
 * 全カテゴリ情報を取得（編集画面用、ユーザーIDでフィルタ）
 */
export async function getAllCategories(
  db: ReturnType<typeof getDb>,
  userId: string
) {
  return await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
}

/**
 * ブックマークを作成（ユーザーID必須）
 */
export async function createBookmark(
  db: ReturnType<typeof getDb>,
  data: {
    userId: string;
    url: string;
    title: string;
    description: string;
    majorCategoryId: number;
    minorCategoryId: number;
  }
): Promise<{ id: number }> {
  const result = await db
    .insert(bookmarks)
    .values(data)
    .returning({ id: bookmarks.id });

  return result[0];
}

/**
 * 全ブックマークをカテゴリ別に取得（ユーザーIDでフィルタ）
 */
export async function getAllBookmarks(
  db: ReturnType<typeof getDb>,
  userId: string
): Promise<BookmarksByCategory[]> {
  // カテゴリとブックマークを並行取得（displayOrderでソート、ユーザーIDでフィルタ）
  const [allCategories, results] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.displayOrder)),
    db
      .select({
        bookmark: bookmarks,
      })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
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
 * ブックマークを削除（ユーザーIDでフィルタ）
 */
export async function deleteBookmark(
  db: ReturnType<typeof getDb>,
  userId: string,
  id: number
): Promise<void> {
  await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
}

/**
 * URLの重複チェック（ユーザーIDでフィルタ）
 * 既存のブックマークがある場合、そのブックマーク情報を返す
 */
export async function checkDuplicateUrl(
  db: ReturnType<typeof getDb>,
  userId: string,
  url: string
): Promise<{ exists: boolean; bookmark?: BookmarkWithCategories }> {
  const existing = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.url, url), eq(bookmarks.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    return { exists: false };
  }

  // 既存ブックマークのカテゴリ情報を取得
  const bookmark = existing[0];
  const [majorCat, minorCat] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.id, bookmark.majorCategoryId))
      .limit(1),
    db
      .select()
      .from(categories)
      .where(eq(categories.id, bookmark.minorCategoryId))
      .limit(1),
  ]);

  return {
    exists: true,
    bookmark: {
      ...bookmark,
      majorCategory: {
        id: bookmark.majorCategoryId,
        name: majorCat[0]?.name || "不明",
        icon: majorCat[0]?.icon || null,
      },
      minorCategory: {
        id: bookmark.minorCategoryId,
        name: minorCat[0]?.name || "不明",
        icon: minorCat[0]?.icon || null,
      },
    },
  };
}

/**
 * ブックマークの表示順序を更新（楽観的ロック付き、ユーザーIDでフィルタ）
 */
export async function updateBookmarkOrder(
  db: ReturnType<typeof getDb>,
  userId: string,
  bookmarkId: number,
  newOrder: number,
  expectedVersion?: number
): Promise<{ success: boolean; currentVersion?: number }> {
  // バージョンチェックが有効な場合、現在のバージョンを確認
  if (expectedVersion !== undefined) {
    const current = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
      .limit(1);
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
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)));

  return { success: true };
}

/**
 * カテゴリの表示順序を更新（楽観的ロック付き、ユーザーIDでフィルタ）
 */
export async function updateCategoryOrder(
  db: ReturnType<typeof getDb>,
  userId: string,
  categoryId: number,
  newOrder: number,
  expectedVersion?: number
): Promise<{ success: boolean; currentVersion?: number }> {
  // バージョンチェックが有効な場合、現在のバージョンを確認
  if (expectedVersion !== undefined) {
    const current = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .limit(1);
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
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));

  return { success: true };
}
