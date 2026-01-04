import { Form } from "react-router";

interface CategoryHeaderProps {
  majorCategory: string;
  majorIndex: number;
  totalCategories: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

/**
 * カテゴリヘッダーコンポーネント
 *
 * カテゴリ名と上下移動ボタンを表示する
 *
 * @param majorCategory - カテゴリ名
 * @param majorIndex - カテゴリのインデックス
 * @param totalCategories - カテゴリの総数
 * @param onMoveUp - 上へ移動ボタンのクリックハンドラ
 * @param onMoveDown - 下へ移動ボタンのクリックハンドラ
 */
export const CategoryHeader: React.FC<CategoryHeaderProps> = ({
  majorCategory,
  majorIndex,
  totalCategories,
  onMoveUp,
  onMoveDown,
}) => {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
      <h2 className="text-xl sm:text-2xl md:text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight flex-1">
        {majorCategory}
      </h2>

      {/* カテゴリ移動ボタン */}
      <div className="flex items-center gap-1">
        {/* 上へ移動ボタン */}
        {majorIndex > 0 && onMoveUp && (
          <button
            onClick={onMoveUp}
            className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            title="カテゴリを上へ移動"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 15l7-7 7 7"
              />
            </svg>
          </button>
        )}

        {/* 下へ移動ボタン */}
        {majorIndex < totalCategories - 1 && onMoveDown && (
          <button
            onClick={onMoveDown}
            className="p-2 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            title="カテゴリを下へ移動"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
