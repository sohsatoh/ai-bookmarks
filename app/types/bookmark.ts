export interface BookmarkWithCategories {
  id: number;
  url: string;
  title: string;
  description: string;
  majorCategory: {
    id: number;
    name: string;
    icon?: string | null;
  };
  minorCategory: {
    id: number;
    name: string;
    icon?: string | null;
  };
  isStarred: boolean;
  readStatus: "unread" | "read";
  isArchived: boolean;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIGeneratedMetadata {
  majorCategory: string;
  minorCategory: string;
  description: string;
}

export interface CreateBookmarkInput {
  url: string;
}

export interface BookmarksByCategory {
  majorCategory: string;
  majorCategoryIcon?: string | null;
  majorCategoryId: number;
  majorCategoryOrder: number;
  minorCategories: {
    minorCategory: string;
    minorCategoryIcon?: string | null;
    minorCategoryId: number;
    minorCategoryOrder: number;
    bookmarks: BookmarkWithCategories[];
  }[];
}
