/**
 * Broadcast Channel API を使用してタブ間でデータを同期
 */

export type BroadcastMessage =
  | { type: "bookmark-added"; bookmarkId: number }
  | { type: "bookmark-deleted"; bookmarkId: number }
  | { type: "bookmark-updated"; bookmarkId: number }
  | { type: "bookmark-reordered"; bookmarkId: number; newOrder: number }
  | { type: "category-reordered"; categoryId: number; newOrder: number }
  | { type: "refresh-all" };

let channel: BroadcastChannel | null = null;

/**
 * Broadcast Channelを初期化
 */
export function initBroadcastChannel(
  onMessage: (message: BroadcastMessage) => void
): void {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    console.warn("Broadcast Channel API is not supported");
    return;
  }

  if (channel) {
    channel.close();
  }

  channel = new BroadcastChannel("ai-bookmarks-sync");

  channel.onmessage = (event) => {
    // eslint-disable-next-line no-console
    console.log("Received broadcast message:", event.data);
    onMessage(event.data as BroadcastMessage);
  };
}

/**
 * メッセージをブロードキャスト
 */
export function broadcast(message: BroadcastMessage): void {
  if (!channel) {
    console.warn("Broadcast channel not initialized");
    return;
  }

  // eslint-disable-next-line no-console
  console.log("Broadcasting message:", message);
  channel.postMessage(message);
}

/**
 * Broadcast Channelをクローズ
 */
export function closeBroadcastChannel(): void {
  if (channel) {
    channel.close();
    channel = null;
  }
}
