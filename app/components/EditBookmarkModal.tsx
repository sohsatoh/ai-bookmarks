/**
 * ブックマーク編集モーダルコンポーネント
 */

import { Form } from "react-router";

interface EditBookmarkModalProps {
  bookmark: {
    id: number;
    title: string;
    description: string;
    majorCategory: string;
    minorCategory: string;
  };
  allCategories: Array<{
    id: number;
    name: string;
    type: "major" | "minor";
  }>;
  onClose: () => void;
  onChange: (field: "majorCategory" | "minorCategory", value: string) => void;
}

export function EditBookmarkModal({
  bookmark,
  allCategories,
  onClose,
  onChange,
}: EditBookmarkModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full p-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              Edit Bookmark
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <Form method="post" onSubmit={onClose}>
            <input type="hidden" name="intent" value="edit" />
            <input type="hidden" name="bookmarkId" value={bookmark.id} />

            <div className="space-y-6">
              <div>
                <label
                  htmlFor="edit-title"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1"
                >
                  Title
                </label>
                <input
                  id="edit-title"
                  name="title"
                  type="text"
                  defaultValue={bookmark.title}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-description"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1"
                >
                  Description
                </label>
                <textarea
                  id="edit-description"
                  name="description"
                  rows={4}
                  defaultValue={bookmark.description}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="edit-major-category"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1"
                  >
                    Category
                  </label>
                  <select
                    id="edit-major-category"
                    name="majorCategory"
                    value={bookmark.majorCategory}
                    onChange={(e) => onChange("majorCategory", e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                  >
                    <option value="">選択してください</option>
                    {allCategories
                      ?.filter((c) => c.type === "major")
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="edit-minor-category"
                    className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1"
                  >
                    Subcategory
                  </label>
                  <select
                    id="edit-minor-category"
                    name="minorCategory"
                    value={bookmark.minorCategory}
                    onChange={(e) => onChange("minorCategory", e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                  >
                    <option value="">選択してください</option>
                    {allCategories
                      ?.filter((c) => c.type === "minor")
                      .map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-white bg-[#0071e3] hover:bg-[#0077ED] font-medium transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
