import type { BookmarkWithCategories } from "~/types/bookmark";
import { BookmarkActionButtons } from "./BookmarkActionButtons";

interface BookmarkCardFullProps {
  bookmark: BookmarkWithCategories;
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  dragOverPosition?: "before" | "after";
  onDragStart: (type: "bookmark", id: number, index: number) => void;
  onDragOver: (e: React.DragEvent, type: "bookmark", id: number) => void;
  onDrop: (
    e: React.DragEvent,
    type: "bookmark",
    id: number,
    index: number,
    categoryId?: number
  ) => void;
  onDragEnd: () => void;
  onEdit: (bookmark: {
    id: number;
    title: string;
    description: string;
    majorCategory: string;
    minorCategory: string;
  }) => void;
  categoryId?: number;
  isPinned?: boolean;
}

/**
 * ブックマークカード（フル機能版）
 *
 * ドラッグ&ドロップ、アクションボタン、表示を含む完全なブックマークカード
 *
 * @param bookmark - ブックマークデータ
 * @param index - 配列内のインデックス
 * @param isDragging - ドラッグ中かどうか
 * @param isDragOver - ドラッグオーバー中かどうか
 * @param dragOverPosition - ドラッグオーバー位置（before/after）
 * @param onDragStart - ドラッグ開始ハンドラー
 * @param onDragOver - ドラッグオーバーハンドラー
 * @param onDrop - ドロップハンドラー
 * @param onDragEnd - ドラッグ終了ハンドラー
 * @param onEdit - 編集ハンドラー
 * @param categoryId - カテゴリID（通常ブックマークの場合）
 * @param isPinned - ピン留めブックマークかどうか
 */
export const BookmarkCardFull: React.FC<BookmarkCardFullProps> = ({
  bookmark,
  index,
  isDragging,
  isDragOver,
  dragOverPosition,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onEdit,
  categoryId,
  isPinned = false,
}) => {
  const showBeforeLine = isDragOver && dragOverPosition === "before";
  const showAfterLine = isDragOver && dragOverPosition === "after";
  return (
    <div key={bookmark.id} className="relative">
      {/* 挿入位置インジケーター（前） */}
      {showBeforeLine && (
        <div className="absolute -left-2 top-0 bottom-0 w-1 bg-blue-500 dark:bg-blue-400 z-20 shadow-lg rounded-full" />
      )}

      <div
        draggable
        onDragStart={() => onDragStart("bookmark", bookmark.id, index)}
        onDragOver={(e) => onDragOver(e, "bookmark", bookmark.id)}
        onDrop={(e) => onDrop(e, "bookmark", bookmark.id, index, categoryId)}
        onDragEnd={onDragEnd}
        className={`group relative bg-white dark:bg-gray-900 rounded-2xl p-5 transition-all duration-200 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5 border flex flex-col animate-scale-in ${
          bookmark.isArchived ? "opacity-60 grayscale" : ""
        } ${
          isDragging
            ? "opacity-30 scale-95 cursor-grabbing border-gray-300 dark:border-gray-700"
            : "cursor-grab border-transparent hover:border-gray-100 dark:hover:border-gray-800"
        } ${isDragOver ? "scale-105" : ""}`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* ドラッグハンドルアイコン */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9h8M8 15h8"
              />
            </svg>
          </div>

          <div className="flex items-start gap-3 mb-3">
            {/* Favicon */}
            <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 shadow-inner">
              <img
                src={`https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=64`}
                alt=""
                className="w-6 h-6 rounded-md"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>

            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-0 block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
            >
              <h4 className="font-semibold text-sm sm:text-base md:text-lg text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 line-clamp-2 tracking-tight leading-snug">
                {bookmark.title}
              </h4>
              {isPinned && (
                <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400 font-medium mb-2">
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
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                {bookmark.description}
              </p>
              <div className="flex flex-col gap-1 text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 font-medium">
                <span className="truncate">
                  {new URL(bookmark.url).hostname}
                </span>
                <span>
                  {new Date(bookmark.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </a>
          </div>

          <div className="shrink-0 flex items-center gap-1 justify-end mt-auto pt-2">
            <BookmarkActionButtons bookmark={bookmark} onEdit={onEdit} />
          </div>
        </div>
      </div>

      {/* 挿入位置インジケーター（後） */}
      {showAfterLine && (
        <div className="absolute -right-2 top-0 bottom-0 w-1 bg-blue-500 dark:bg-blue-400 z-20 shadow-lg rounded-full" />
      )}
    </div>
  );
};
