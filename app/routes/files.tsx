/**
 * ファイル管理ページ
 *
 * /files
 * セキュリティ:
 * - 認証必須（requireAuth）
 * - ユーザー分離（自分のファイルのみ表示）
 */

import type { Route } from "./+types/files";
import { useLoaderData, useNavigation } from "react-router";
import { requireAuth } from "~/services/auth.server";
import { getUserFiles, getUserFileCount } from "~/services/file.server";
import { FILE_CONFIG } from "~/constants";
import { useState } from "react";
import { Toast } from "~/components/Toast";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "ファイル管理 - AI Bookmarks" },
    { name: "description", content: "ファイルのアップロードと管理。" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await requireAuth(request, context);

  const files = await getUserFiles(session.user.id, context);
  const fileCount = await getUserFileCount(session.user.id, context);

  const isAdmin = session.user.role === "admin";
  const maxFiles = isAdmin
    ? FILE_CONFIG.MAX_FILES_PER_ADMIN
    : FILE_CONFIG.MAX_FILES_PER_USER;

  return {
    files,
    fileCount,
    maxFiles,
    isAdmin,
    user: session.user,
  };
}

export default function FilesPage() {
  const { files, fileCount, maxFiles, isAdmin } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const isUploading = navigation.state === "submitting" || uploadingFile;
  const canUpload = isAdmin || fileCount < maxFiles;

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploadingFile(true);

    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (response.ok && result.success) {
        setToast({
          message: "ファイルをアップロードしました",
          type: "success",
        });
        // ページをリロードしてファイル一覧を更新
        window.location.reload();
      } else {
        setToast({
          message: result.error || "アップロードに失敗しました",
          type: "error",
        });
      }
    } catch (error) {
      console.error("アップロードエラー:", error);
      setToast({ message: "アップロードに失敗しました", type: "error" });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileDelete = async (fileId: number) => {
    if (!confirm("このファイルを削除してもよろしいですか？")) {
      return;
    }

    try {
      const response = await fetch(`/api/files/delete/${fileId}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (response.ok && result.success) {
        setToast({ message: "ファイルを削除しました", type: "success" });
        // ページをリロードしてファイル一覧を更新
        window.location.reload();
      } else {
        setToast({
          message: result.error || "削除に失敗しました",
          type: "error",
        });
      }
    } catch (error) {
      console.error("削除エラー:", error);
      setToast({ message: "削除に失敗しました", type: "error" });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-3xl font-bold mb-6">ファイル管理</h1>

      {/* アップロードフォーム */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">ファイルをアップロード</h2>

        <div className="mb-4 text-sm text-gray-600">
          <p>
            使用容量: {fileCount} / {isAdmin ? "無制限" : maxFiles} ファイル
          </p>
          <p>
            最大ファイルサイズ: {FILE_CONFIG.MAX_FILE_SIZE_BYTES / 1024 / 1024}{" "}
            MB
          </p>
        </div>

        {canUpload ? (
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div>
              <label
                htmlFor="file"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                ファイルを選択
              </label>
              <input
                type="file"
                id="file"
                name="file"
                required
                disabled={isUploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "アップロード中..." : "アップロード"}
            </button>
          </form>
        ) : (
          <p className="text-red-600">
            ファイル数の上限に達しています。既存のファイルを削除してから再度お試しください。
          </p>
        )}
      </div>

      {/* ファイル一覧 */}
      <div className="bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold p-6 border-b">ファイル一覧</h2>

        {files.length === 0 ? (
          <p className="p-6 text-gray-500">ファイルがまだありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ファイル名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    タイトル
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    サイズ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AI分析
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    アップロード日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {file.originalFilename}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {file.title || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFileSize(file.fileSize)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {file.aiAnalysisStatus === "completed" && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          完了
                        </span>
                      )}
                      {file.aiAnalysisStatus === "pending" && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          処理中
                        </span>
                      )}
                      {file.aiAnalysisStatus === "failed" && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          失敗
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(file.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <a
                        href={`/api/files/download/${file.id}`}
                        className="text-blue-600 hover:text-blue-900"
                        download
                      >
                        ダウンロード
                      </a>
                      <button
                        onClick={() => handleFileDelete(file.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
