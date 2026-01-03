import { useEffect, useState } from "react";

export interface ToastMessage {
  id: string;
  type: "info" | "success" | "error";
  title: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-6 right-6 z-50 space-y-3 max-w-md">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // エラー以外は5秒後に自動で消える
    if (toast.type !== "error") {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss(toast.id), 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.type, onDismiss]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const bgColor = {
    info: "bg-white dark:bg-gray-800 border-blue-500 dark:border-blue-400",
    success: "bg-white dark:bg-gray-800 border-green-500 dark:border-green-400",
    error: "bg-white dark:bg-gray-800 border-red-500 dark:border-red-400",
  }[toast.type];

  const textColor = {
    info: "text-gray-700 dark:text-gray-300",
    success: "text-gray-900 dark:text-white",
    error: "text-gray-900 dark:text-white",
  }[toast.type];

  const iconColor = {
    info: "text-blue-500 dark:text-blue-400",
    success: "text-green-500 dark:text-green-400",
    error: "text-red-500 dark:text-red-400",
  }[toast.type];

  const icon = {
    info: (
      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    ),
    success: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    error: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
  }[toast.type];

  return (
    <div
      className={`${bgColor} border-l-4 rounded-xl shadow-lg p-4 transition-all duration-300 backdrop-blur-sm ${
        isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={iconColor}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${textColor}`}>{toast.title}</p>
          <p className={`text-sm mt-1 ${textColor} opacity-70 line-clamp-2 break-all`}>{toast.message}</p>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
