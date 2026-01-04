/**
 * ブックマーク追加フォームコンポーネント
 */

import { Form } from "react-router";
import { useRef, useEffect } from "react";

interface AddBookmarkFormProps {
  isSubmitting: boolean;
  formRef: React.RefObject<HTMLFormElement>;
}

export function AddBookmarkForm({
  isSubmitting,
  formRef,
}: AddBookmarkFormProps) {
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-700 mb-8">
      <h2 className="text-2xl font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-6 tracking-tight">
        Add New Bookmark
      </h2>

      <Form ref={formRef} method="post" className="space-y-4">
        <input type="hidden" name="intent" value="add" />

        <div>
          <label
            htmlFor="url"
            className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 ml-1"
          >
            URL
          </label>
          <input
            ref={urlInputRef}
            id="url"
            name="url"
            type="url"
            placeholder="https://example.com"
            required
            disabled={isSubmitting}
            className="w-full px-5 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-3.5 rounded-xl text-white font-semibold bg-[#0071e3] hover:bg-[#0077ED] active:bg-[#006edb] focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md transform hover:scale-[1.01] active:scale-[0.99]"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </span>
          ) : (
            "Add Bookmark"
          )}
        </button>
      </Form>
    </div>
  );
}
