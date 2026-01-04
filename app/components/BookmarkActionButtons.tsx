import { Form } from "react-router";
import type { BookmarkWithCategories } from "~/types/bookmark";

interface BookmarkActionButtonsProps {
  bookmark: BookmarkWithCategories;
  onEdit: (bookmark: {
    id: number;
    title: string;
    description: string;
    majorCategory: string;
    minorCategory: string;
  }) => void;
  isAdmin?: boolean;
}

/**
 * ブックマークのアクションボタン群
 *
 * 既読/未読、スター、アーカイブ、情報更新、編集、削除の各ボタンを表示する
 *
 * @param bookmark - 対象ブックマーク
 * @param onEdit - 編集モーダルを開く関数
 */
export const BookmarkActionButtons: React.FC<BookmarkActionButtonsProps> = ({
  bookmark,
  onEdit,
  isAdmin = false,
}) => {
  return (
    <div className="flex items-center gap-1">
      {/* 既読/未読ボタン */}
      <Form method="post">
        <input type="hidden" name="intent" value="toggleReadStatus" />
        <input type="hidden" name="bookmarkId" value={bookmark.id} />
        <input
          type="hidden"
          name="isRead"
          value={(bookmark.readStatus === "read").toString()}
        />
        <button
          type="submit"
          className="p-2 text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          title={
            bookmark.readStatus === "read" ? "Mark as unread" : "Mark as read"
          }
        >
          {bookmark.readStatus === "read" ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-500 dark:text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          )}
        </button>
      </Form>

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
          className="p-2 text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          title={bookmark.isStarred ? "Unstar" : "Star"}
        >
          {bookmark.isStarred ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-yellow-500 dark:text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          )}
        </button>
      </Form>

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
          className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          title={bookmark.isArchived ? "Unarchive" : "Archive"}
        >
          {bookmark.isArchived ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-blue-500 dark:text-blue-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
              <path
                fillRule="evenodd"
                d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
          )}
        </button>
      </Form>

      {/* 情報更新ボタン */}
      <Form method="post">
        <input type="hidden" name="intent" value="refresh" />
        <input type="hidden" name="bookmarkId" value={bookmark.id} />
        <button
          type="submit"
          onClick={(e) => {
            if (
              !confirm(
                `「${bookmark.title}」の情報を再取得しますか？\nカテゴリや説明が更新される可能性があります。`
              )
            ) {
              e.preventDefault();
            }
          }}
          className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          title="情報を更新"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </Form>

      {/* 編集ボタン（admin限定） */}
      {isAdmin && (
        <button
          type="button"
          onClick={() =>
            onEdit({
              id: bookmark.id,
              title: bookmark.title,
              description: bookmark.description,
              majorCategory: bookmark.majorCategory.name,
              minorCategory: bookmark.minorCategory.name,
            })
          }
          className="p-2 text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Edit"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
      )}

      {/* 削除ボタン */}
      <Form method="post">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="bookmarkId" value={bookmark.id} />
        <button
          type="submit"
          onClick={(e) => {
            if (!confirm(`「${bookmark.title}」を削除しますか？`)) {
              e.preventDefault();
            }
          }}
          className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Delete"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </Form>
    </div>
  );
};
