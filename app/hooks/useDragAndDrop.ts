import { useState } from "react";
import { useSubmit } from "react-router";
import type {
  BookmarkWithCategories,
  BookmarksByCategory,
} from "~/types/bookmark";
import type { ToastMessage } from "~/components/Toast";

interface DraggedItem {
  type: "bookmark" | "category";
  id: number;
  index: number;
}

interface DragOverItem {
  type: "bookmark" | "category";
  id: number;
  position: "before" | "after";
}

interface UseDragAndDropProps {
  displayBookmarks: BookmarksByCategory[];
  setOptimisticBookmarks: React.Dispatch<
    React.SetStateAction<BookmarksByCategory[]>
  >;
  loaderDataBookmarks: BookmarksByCategory[];
  setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>>;
}

interface UseDragAndDropReturn {
  draggedItem: DraggedItem | null;
  dragOverItem: DragOverItem | null;
  handleDragStart: (
    type: "bookmark" | "category",
    id: number,
    index: number
  ) => void;
  handleDragOver: (
    e: React.DragEvent,
    type: "bookmark" | "category",
    id: number
  ) => void;
  handleDrop: (
    e: React.DragEvent,
    targetType: "bookmark" | "category",
    targetId: number,
    targetIndex: number,
    categoryId?: number
  ) => void;
  handleDragEnd: () => void;
  handleMoveCategoryUp: (
    majorCategoryId: number,
    currentIndex: number
  ) => Promise<void>;
  handleMoveCategoryDown: (
    majorCategoryId: number,
    currentIndex: number
  ) => Promise<void>;
}

/**
 * ドラッグ&ドロップのロジックを管理するカスタムフック
 *
 * ブックマークの並び替えとカテゴリの上下移動を処理する
 *
 * @param displayBookmarks - 表示中のブックマークデータ
 * @param setOptimisticBookmarks - 楽観的UI更新用のstate setter
 * @param loaderDataBookmarks - サーバーから取得した元データ
 * @param setToasts - トースト表示用のstate setter
 */
export const useDragAndDrop = ({
  displayBookmarks,
  setOptimisticBookmarks,
  loaderDataBookmarks,
  setToasts,
}: UseDragAndDropProps): UseDragAndDropReturn => {
  const submit = useSubmit();
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dragOverItem, setDragOverItem] = useState<DragOverItem | null>(null);

  const handleDragStart = (
    type: "bookmark" | "category",
    id: number,
    index: number
  ) => {
    setDraggedItem({ type, id, index });
  };

  const handleDragOver = (
    e: React.DragEvent,
    type: "bookmark" | "category",
    id: number
  ) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const height = rect.height;
    const position = mouseY < height / 2 ? "before" : "after";

    setDragOverItem({ type, id, position });
  };

  const handleDrop = (
    e: React.DragEvent,
    targetType: "bookmark" | "category",
    targetId: number,
    _targetIndex: number,
    _categoryId?: number
  ) => {
    e.preventDefault();

    if (
      !draggedItem ||
      draggedItem.type !== targetType ||
      draggedItem.id === targetId
    ) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    try {
      // ブックマークの並び替えのみ対応（カテゴリはボタンで移動）
      if (targetType === "bookmark") {
        // ブックマークの並び替え
        // ドラッグ元とドロップ先のカテゴリを取得
        let draggedCategoryId: number | null = null;
        let targetCategoryId: number | null = null;

        for (const major of displayBookmarks) {
          for (const minor of major.minorCategories) {
            if (minor.bookmarks.some((b) => b.id === draggedItem.id)) {
              draggedCategoryId = minor.minorCategoryId;
            }
            if (minor.bookmarks.some((b) => b.id === targetId)) {
              targetCategoryId = minor.minorCategoryId;
            }
          }
        }

        if (draggedCategoryId === null || targetCategoryId === null) return;
        if (draggedCategoryId !== targetCategoryId) {
          // 異なるカテゴリ間での移動を試みた場合の警告トースト
          const toastId = Date.now().toString();
          setToasts((prev) => [
            ...prev,
            {
              id: toastId,
              type: "warning" as const,
              title: "移動できません",
              message: "同じカテゴリ内でのみ並び替えできます",
            },
          ]);
          setDraggedItem(null);
          setDragOverItem(null);
          return;
        }

        // カテゴリIDベースで検索
        type BookmarkArray = BookmarkWithCategories[];
        let bookmarksInCategory: BookmarkArray = [];
        for (const major of displayBookmarks) {
          const minor = major.minorCategories.find(
            (m) => m.minorCategoryId === targetCategoryId
          );
          if (minor) {
            bookmarksInCategory = [...minor.bookmarks];
            break;
          }
        }

        const draggedIndex = bookmarksInCategory.findIndex(
          (b) => b.id === draggedItem.id
        );
        const targetIndex = bookmarksInCategory.findIndex(
          (b) => b.id === targetId
        );

        if (
          draggedIndex === -1 ||
          targetIndex === -1 ||
          draggedIndex === targetIndex
        )
          return;

        // positionに基づいて挿入位置を調整
        const position = dragOverItem?.position || "after";
        let insertIndex = targetIndex;

        if (position === "after") {
          insertIndex = targetIndex + 1;
        }

        // draggedIndexがinsertIndexより前にある場合、削除後にindexがずれるので調整
        if (draggedIndex < insertIndex) {
          insertIndex--;
        }

        // 同じ位置なら何もしない
        if (draggedIndex === insertIndex) {
          setDraggedItem(null);
          setDragOverItem(null);
          return;
        }

        // 配列を並び替え
        const [removed] = bookmarksInCategory.splice(draggedIndex, 1);
        bookmarksInCategory.splice(insertIndex, 0, removed);

        // 楽観的UI更新: ローカルstateを即座に更新
        setOptimisticBookmarks((prevBookmarks) => {
          return prevBookmarks.map((major) => ({
            ...major,
            minorCategories: major.minorCategories.map((minor) => {
              if (minor.minorCategoryId === targetCategoryId) {
                return { ...minor, bookmarks: bookmarksInCategory };
              }
              return minor;
            }),
          }));
        });

        // 新しい順序を計算
        const orders = bookmarksInCategory.map((bookmark, index) => ({
          id: bookmark.id,
          order: index,
        }));

        // サーバーに送信
        const formData = new FormData();
        formData.append("intent", "reorderBookmarks");
        formData.append("orders", JSON.stringify(orders));

        submit(formData, { method: "post", action: "/?index" });
      }
    } catch (error) {
      console.error("Reorder failed:", error);
      // エラーが発生したら楽観的stateをリセット
      setOptimisticBookmarks(loaderDataBookmarks);

      // エラートーストを表示
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: "error" as const,
          title: "エラー",
          message: "処理に失敗しました",
        },
      ]);
    } finally {
      setDraggedItem(null);
      setDragOverItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // カテゴリをボタンで移動するハンドラー
  const handleMoveCategoryUp = async (
    majorCategoryId: number,
    currentIndex: number
  ) => {
    if (currentIndex === 0) return; // 既に一番上

    try {
      const categories = [...displayBookmarks];
      const targetIndex = currentIndex - 1;

      // 配列を並び替え
      const [removed] = categories.splice(currentIndex, 1);
      categories.splice(targetIndex, 0, removed);

      // 楽観的UI更新
      setOptimisticBookmarks(categories);

      // 新しい順序を計算
      const orders = categories.map((category, index) => ({
        id: category.majorCategoryId,
        order: index,
      }));

      // サーバーに送信
      const formData = new FormData();
      formData.append("intent", "reorderCategories");
      formData.append("orders", JSON.stringify(orders));

      submit(formData, { method: "post", action: "/?index" });
    } catch (error) {
      console.error("Move category up failed:", error);
      // エラーが発生したら楽観的stateをリセット
      setOptimisticBookmarks(loaderDataBookmarks);

      // エラートーストを表示
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: "error" as const,
          title: "エラー",
          message: "カテゴリの移動に失敗しました",
        },
      ]);
    }
  };

  const handleMoveCategoryDown = async (
    majorCategoryId: number,
    currentIndex: number
  ) => {
    if (currentIndex === displayBookmarks.length - 1) return; // 既に一番下

    try {
      const categories = [...displayBookmarks];
      const targetIndex = currentIndex + 1;

      // 配列を並び替え
      const [removed] = categories.splice(currentIndex, 1);
      categories.splice(targetIndex, 0, removed);

      // 楽観的UI更新
      setOptimisticBookmarks(categories);

      // 新しい順序を計算
      const orders = categories.map((category, index) => ({
        id: category.majorCategoryId,
        order: index,
      }));

      // サーバーに送信
      const formData = new FormData();
      formData.append("intent", "reorderCategories");
      formData.append("orders", JSON.stringify(orders));

      submit(formData, { method: "post", action: "/?index" });
    } catch (error) {
      console.error("Move category down failed:", error);
      // エラーが発生したら楽観的stateをリセット
      setOptimisticBookmarks(loaderDataBookmarks);

      // エラートーストを表示
      const toastId = Date.now().toString();
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          type: "error" as const,
          title: "エラー",
          message: "カテゴリの移動に失敗しました",
        },
      ]);
    }
  };

  return {
    draggedItem,
    dragOverItem,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleMoveCategoryUp,
    handleMoveCategoryDown,
  };
};
