export interface BookmarkWithCategories {
  id: number;
  url: string;
  title: string;
  description: string;
  majorCategory: {
    id: number;
    name: string;
  };
  minorCategory: {
    id: number;
    name: string;
  };
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
  minorCategories: {
    minorCategory: string;
    bookmarks: BookmarkWithCategories[];
  }[];
}
