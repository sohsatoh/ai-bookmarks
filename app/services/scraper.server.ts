import { validateUrlStrict, stripHtmlTags, decodeHtmlEntities } from "./security.server";

/**
 * URLからページタイトルとコンテンツを取得
 * SSRF対策、XSS対策済み
 */
export async function fetchPageMetadata(url: string): Promise<{
  title: string;
  content: string;
}> {
  // URL検証（SSRF対策）
  const urlValidation = validateUrlStrict(url);
  if (!urlValidation.valid) {
    throw new Error(urlValidation.error || "Invalid URL");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BookmarkBot/1.0; +https://example.com/bot)",
      },
      // タイムアウト設定
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // タイトルを抽出（<title>タグまたはOGタイトル）
    const ogTitleRegex = /<meta\s+property="og:title"\s+content="([^"]+)"/i;
    const titleRegex = /<title[^>]*>([^<]+)<\/title>/i;
    const titleMatch = ogTitleRegex.exec(html) || titleRegex.exec(html);

    // メタディスクリプションを抽出
    const ogDescRegex = /<meta\s+property="og:description"\s+content="([^"]+)"/i;
    const descRegex = /<meta\s+name="description"\s+content="([^"]+)"/i;
    const descMatch = ogDescRegex.exec(html) || descRegex.exec(html);

    // 本文の一部を抽出（簡易版：最初のpタグの内容）
    const bodyRegex = /<p[^>]*>([^<]+)<\/p>/i;
    const bodyMatch = bodyRegex.exec(html);

    const rawTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
    const rawDescription = descMatch ? descMatch[1].trim() : "";
    const rawBodyText = bodyMatch ? bodyMatch[1].trim() : "";

    // XSS対策: HTMLタグを除去してテキストのみ抽出
    const title = stripHtmlTags(decodeHtmlEntities(rawTitle)).slice(0, 150);
    const description = stripHtmlTags(decodeHtmlEntities(rawDescription)).slice(0, 300);
    const bodyText = stripHtmlTags(decodeHtmlEntities(rawBodyText)).slice(0, 400);

    // コンテンツを結合（AI分析用、コスト削減のため短縮）
    const content = [title, description, bodyText].filter(Boolean).join(" ").slice(0, 800); // 最大800文字

    return {
      title: title || "Untitled",
      content: content || title || "No content",
    };
  } catch (error) {
    console.error("Failed to fetch page metadata:", error);
    // フォールバック: URLのホスト名をタイトルとして使用
    const fallbackTitle = new URL(url).hostname;
    return {
      title: fallbackTitle,
      content: fallbackTitle,
    };
  }
}

/**
 * URLの妥当性を検証（後方互換性のため）
 */
export function validateUrl(urlString: string): { valid: boolean; error?: string } {
  const result = validateUrlStrict(urlString);
  return {
    valid: result.valid,
    error: result.error,
  };
}
