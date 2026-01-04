/**
 * ブックマークカードコンポーネント
 *
 * 個別のブックマークを表示し、操作（スター、既読、アーカイブ、編集、削除）を提供
 */

import { Form } from "react-router";
import type { BookmarkWithCategories } from "~/types/bookmark";

interface BookmarkCardProps {
  bookmark: BookmarkWithCategories;
  isSubmitting: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onEdit: (bookmark: {
    id: number;
    title: string;
    description: string;
    majorCategory: string | { id: number; name: string; icon?: string | null };
    minorCategory: string | { id: number; name: string; icon?: string | null };
  }) => void;
}

export function BookmarkCard({
  bookmark,
  isSubmitting,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onEdit,
}: BookmarkCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-700 ${
        isDragging ? "opacity-50 scale-95" : ""
      } ${bookmark.isArchived ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white hover:text-[#0071e3] dark:hover:text-[#2997FF] transition-colors line-clamp-2 mb-1">
            {bookmark.title}
          </h3>
        </a>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* スターボタン */}
          <Form method="post">
            <input type="hidden" name="intent" value="toggleStar" />
            <input type="hidden" name="bookmarkId" value={bookmark.id} />
            <input
              type="hidden"
              name="isStarred"
              value={bookmark.isStarred.toString()}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className={`p-2 rounded-full transition-all ${
                bookmark.isStarred
                  ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
                  : "text-gray-400 hover:text-yellow-500 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              title={bookmark.isStarred ? "スターを外す" : "スターを付ける"}
            >
              <svg
                className="w-5 h-5"
                fill={bookmark.isStarred ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </button>
          </Form>

          {/* 既読ボタン */}
          <Form method="post">
            <input type="hidden" name="intent" value="toggleReadStatus" />
            <input type="hidden" name="bookmarkId" value={bookmark.id} />
            <input
              type="hidden"
              name="readStatus"
              value={bookmark.readStatus}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className={`p-2 rounded-full transition-all ${
                bookmark.readStatus === "read"
                  ? "text-green-500 bg-green-50 dark:bg-green-900/20"
                  : "text-gray-400 hover:text-green-500 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
              title={
                bookmark.readStatus === "read" ? "未読にする" : "既読にする"
              }
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </Form>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
        {bookmark.description}
      </p>

      <div className="flex items-center justify-between">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#0071e3] hover:text-[#0077ED] dark:text-[#2997FF] dark:hover:text-[#3AA0FF] font-medium truncate flex-1 mr-4"
        >
          {new URL(bookmark.url).hostname}
        </a>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {/* アーカイブボタン */}
          <Form method="post">
            <input type="hidden" name="intent" value="toggleArchive" />
            <input type="hidden" name="bookmarkId" value={bookmark.id} />
            <input
              type="hidden"
              name="isArchived"
              value={bookmark.isArchived.toString()}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              title={bookmark.isArchived ? "アーカイブ解除" : "アーカイブする"}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                />
              </svg>
            </button>
          </Form>

          {/* 編集ボタン */}
          <button
            onClick={() =>
              onEdit({
                id: bookmark.id,
                title: bookmark.title,
                description: bookmark.description,
                majorCategory:
                  typeof bookmark.majorCategory === "string"
                    ? bookmark.majorCategory
                    : bookmark.majorCategory.name,
                minorCategory:
                  typeof bookmark.minorCategory === "string"
                    ? bookmark.minorCategory
                    : bookmark.minorCategory.name,
              })
            }
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
            title="編集"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>

          {/* 削除ボタン */}
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="bookmarkId" value={bookmark.id} />
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={(e) => {
                if (!confirm("本当に削除しますか？")) {
                  e.preventDefault();
                }
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
              title="削除"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
