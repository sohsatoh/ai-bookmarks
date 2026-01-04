import type { BookmarkWithCategories } from "~/types/bookmark";

interface BookmarkHeaderProps {
  bookmark: BookmarkWithCategories;
  isPinned?: boolean;
}

/**
 * ブックマークのヘッダー部分（Faviconとタイトル）
 *
 * @param bookmark - 対象ブックマーク
 * @param isPinned - ピン留め表示かどうか
 */
export const BookmarkHeader: React.FC<BookmarkHeaderProps> = ({
  bookmark,
  isPinned = false,
}) => {
  return (
    <div className="flex items-start gap-3 mb-2">
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(bookmark.url)}`}
        alt=""
        className="w-6 h-6 rounded flex-shrink-0 mt-0.5"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23666'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z'/%3E%3C/svg%3E";
        }}
      />
      <div className="flex-1 min-w-0">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${isPinned ? "text-base sm:text-lg" : "text-base sm:text-lg"} font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] hover:text-blue-500 dark:hover:text-blue-400 transition-colors line-clamp-2 break-words`}
        >
          {bookmark.title}
        </a>
        {isPinned && (
          <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 font-medium mt-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Pinned
          </span>
        )}
      </div>
    </div>
  );
};
