import { Link } from "react-router";

/**
 * フッターコンポーネント
 * プライバシーポリシーと利用規約へのリンクを表示
 */
export const Footer = () => {
  return (
    <footer className="mt-20 border-t border-gray-200 dark:border-gray-800 bg-[#F5F5F7] dark:bg-black">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            © 2026 AI Bookmarks. All rights reserved.
          </div>
          <nav className="flex gap-6">
            <Link
              to="/privacy"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              プライバシーポリシー
            </Link>
            <Link
              to="/terms"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              利用規約
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
};
