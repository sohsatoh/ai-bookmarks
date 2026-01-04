import { drizzle } from "drizzle-orm/d1";
import { eq, asc, and } from "drizzle-orm";
import { urls, userBookmarks, categories } from "~/db/schema";
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
 * カテゴリを取得または作成（全ユーザー共有）
 */
export async function getOrCreateCategory(
  db: ReturnType<typeof getDb>,
  name: string,
  type: "major" | "minor",
  parentId?: number
): Promise<number> {
  // 既存のカテゴリを検索（共有カテゴリマスター）
  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.name, name))
    .limit(1);

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
 * 既存のカテゴリ名を取得（AI生成時の参考用、全ユーザー共有）
 */
export async function getExistingCategories(
  db: ReturnType<typeof getDb>
): Promise<{ major: string[]; minor: string[] }> {
  const allCategories = await db.select().from(categories);

  return {
    major: allCategories.filter((c) => c.type === "major").map((c) => c.name),
    minor: allCategories.filter((c) => c.type === "minor").map((c) => c.name),
  };
}

/**
 * 全カテゴリ情報を取得（編集画面用、全ユーザー共有）
 */
export async function getAllCategories(db: ReturnType<typeof getDb>) {
  return await db.select().from(categories);
}

/**
 * URLマスターを取得または作成（全ユーザー共有、AI生成メタデータ保存）
 */
export async function getOrCreateUrl(
  db: ReturnType<typeof getDb>,
  data: {
    url: string;
    title: string;
    description: string;
    majorCategoryId: number;
    minorCategoryId: number;
  }
): Promise<{ id: number; isNew: boolean }> {
  // 既存のURLを検索
  const existing = await db
    .select()
    .from(urls)
    .where(eq(urls.url, data.url))
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0].id, isNew: false };
  }

  // 新規作成
  const result = await db.insert(urls).values(data).returning({ id: urls.id });

  return { id: result[0].id, isNew: true };
}

/**
 * URLの既存メタデータを取得（AI呼び出しスキップ用）
 */
export async function getUrlMetadata(
  db: ReturnType<typeof getDb>,
  url: string
): Promise<{
  id: number;
  title: string;
  description: string;
  majorCategoryId: number;
  minorCategoryId: number;
} | null> {
  const result = await db.select().from(urls).where(eq(urls.url, url)).limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0];
}

/**
 * ブックマークを作成（ユーザー固有）
 */
export async function createUserBookmark(
  db: ReturnType<typeof getDb>,
  data: {
    userId: string;
    urlId: number;
  }
): Promise<{ id: number }> {
  const result = await db
    .insert(userBookmarks)
    .values(data)
    .returning({ id: userBookmarks.id });

  return result[0];
}

/**
 * 全ブックマークをカテゴリ別に取得（ユーザーIDでフィルタ）
 */
export async function getAllBookmarks(
  db: ReturnType<typeof getDb>,
  userId: string
): Promise<BookmarksByCategory[]> {
  // カテゴリ、URL、ユーザーブックマークを並行取得
  const [allCategories, results] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.id)),
    db
      .select({
        userBookmark: userBookmarks,
        url: urls,
      })
      .from(userBookmarks)
      .innerJoin(urls, eq(userBookmarks.urlId, urls.id))
      .where(eq(userBookmarks.userId, userId))
      .orderBy(asc(userBookmarks.displayOrder)),
  ]);

  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  // データを整形
  const bookmarksWithCategories: BookmarkWithCategories[] = results.map((r) => {
    const majorCat = categoryMap.get(r.url.majorCategoryId);
    const minorCat = categoryMap.get(r.url.minorCategoryId);

    return {
      id: r.userBookmark.id,
      userId: r.userBookmark.userId,
      url: r.url.url,
      title: r.url.title,
      description: r.url.description,
      majorCategoryId: r.url.majorCategoryId,
      minorCategoryId: r.url.minorCategoryId,
      isStarred: r.userBookmark.isStarred,
      readStatus: r.userBookmark.readStatus,
      isArchived: r.userBookmark.isArchived,
      displayOrder: r.userBookmark.displayOrder,
      version: r.userBookmark.version,
      createdAt: r.userBookmark.createdAt,
      updatedAt: r.userBookmark.updatedAt,
      majorCategory: {
        id: r.url.majorCategoryId,
        name: majorCat?.name || "不明",
        icon: majorCat?.icon || null,
      },
      minorCategory: {
        id: r.url.minorCategoryId,
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

  // 最終的なデータ構造に変換
  return Array.from(grouped.entries())
    .map(([majorCatId, minorMap]) => {
      const majorCat = categoryMap.get(majorCatId);
      return {
        majorCategory: majorCat?.name || "不明",
        majorCategoryIcon: majorCat?.icon || null,
        majorCategoryId: majorCatId,
        majorCategoryOrder: 0, // 共有カテゴリには表示順序なし
        minorCategories: Array.from(minorMap.entries())
          .map(([minorCatId, bookmarks]) => {
            const minorCat = categoryMap.get(minorCatId);
            return {
              minorCategory: minorCat?.name || "不明",
              minorCategoryIcon: minorCat?.icon || null,
              minorCategoryId: minorCatId,
              minorCategoryOrder: 0, // 共有カテゴリには表示順序なし
              bookmarks,
            };
          })
          .sort((a, b) => a.minorCategoryId - b.minorCategoryId),
      };
    })
    .sort((a, b) => a.majorCategoryId - b.majorCategoryId);
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
    .delete(userBookmarks)
    .where(and(eq(userBookmarks.id, id), eq(userBookmarks.userId, userId)));
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
  // URLマスターとユーザーブックマークを結合して検索
  const existing = await db
    .select({
      userBookmark: userBookmarks,
      url: urls,
    })
    .from(userBookmarks)
    .innerJoin(urls, eq(userBookmarks.urlId, urls.id))
    .where(and(eq(urls.url, url), eq(userBookmarks.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    return { exists: false };
  }

  // 既存ブックマークのカテゴリ情報を取得
  const r = existing[0];
  const [majorCat, minorCat] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.id, r.url.majorCategoryId))
      .limit(1),
    db
      .select()
      .from(categories)
      .where(eq(categories.id, r.url.minorCategoryId))
      .limit(1),
  ]);

  return {
    exists: true,
    bookmark: {
      id: r.userBookmark.id,
      userId: r.userBookmark.userId,
      url: r.url.url,
      title: r.url.title,
      description: r.url.description,
      majorCategoryId: r.url.majorCategoryId,
      minorCategoryId: r.url.minorCategoryId,
      isStarred: r.userBookmark.isStarred,
      readStatus: r.userBookmark.readStatus,
      isArchived: r.userBookmark.isArchived,
      displayOrder: r.userBookmark.displayOrder,
      version: r.userBookmark.version,
      createdAt: r.userBookmark.createdAt,
      updatedAt: r.userBookmark.updatedAt,
      majorCategory: {
        id: r.url.majorCategoryId,
        name: majorCat[0]?.name || "不明",
        icon: majorCat[0]?.icon || null,
      },
      minorCategory: {
        id: r.url.minorCategoryId,
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
      .from(userBookmarks)
      .where(
        and(eq(userBookmarks.id, bookmarkId), eq(userBookmarks.userId, userId))
      )
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
    .update(userBookmarks)
    .set({
      displayOrder: newOrder,
      version: expectedVersion !== undefined ? expectedVersion + 1 : undefined,
      updatedAt: new Date(),
    })
    .where(
      and(eq(userBookmarks.id, bookmarkId), eq(userBookmarks.userId, userId))
    );

  return { success: true };
}

/**
 * カテゴリの表示順序を更新（共有カテゴリでは不要だが互換性のため残す）
 */
export async function updateCategoryOrder(
  _db: ReturnType<typeof getDb>,
  _userId: string,
  _categoryId: number,
  _newOrder: number,
  _expectedVersion?: number
): Promise<{ success: boolean; currentVersion?: number }> {
  // 共有カテゴリにはユーザー固有の並び替えがないため、常に成功を返す
  return { success: true };
}
