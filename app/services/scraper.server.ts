import { validateUrlStrict, stripHtmlTags, decodeHtmlEntities } from "./security.server";
import { SCRAPER_CONFIG } from "~/constants";

/**
 * URLからページタイトルとコンテンツを取得
 * SSRF対策、XSS対策済み
 */
export async function fetchPageMetadata(url: string): Promise<{
  title: string;
  description: string;
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
        "User-Agent": SCRAPER_CONFIG.USER_AGENT,
      },
      // DoS対策: タイムアウト設定
      signal: AbortSignal.timeout(SCRAPER_CONFIG.FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // DoS対策: コンテンツサイズの制限
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number.parseInt(contentLength) > SCRAPER_CONFIG.MAX_CONTENT_SIZE_BYTES) {
      throw new Error("コンテンツサイズが大きすぎます");
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

    // 本文を抽出（<body>タグ全体から取得）
    let bodyContent = "";
    const bodyStartRegex = /<body[^>]*>/i;
    const bodyEndRegex = /<\/body>/i;
    const bodyStartMatch = bodyStartRegex.exec(html);
    const bodyEndMatch = bodyEndRegex.exec(html);

    if (bodyStartMatch && bodyEndMatch) {
      const bodyHtml = html.slice(bodyStartMatch.index, bodyEndMatch.index);

      // script, style, nav, footer, headerなどのノイズを除去
      const cleanedBody = bodyHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ");

      // HTMLタグを除去してテキスト化
      bodyContent = stripHtmlTags(decodeHtmlEntities(cleanedBody))
        .replace(/\s+/g, " ") // 連続する空白を1つに
        .trim()
        .slice(0, SCRAPER_CONFIG.BODY_MAX_LENGTH); // AI分析用に取得
    }

    const rawTitle = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
    const rawDescription = descMatch ? descMatch[1].trim() : "";

    // XSS対策: HTMLタグを除去してテキストのみ抽出
    const title = stripHtmlTags(decodeHtmlEntities(rawTitle)).slice(0, SCRAPER_CONFIG.TITLE_MAX_LENGTH);
    const description = stripHtmlTags(decodeHtmlEntities(rawDescription)).slice(0, SCRAPER_CONFIG.DESCRIPTION_MAX_LENGTH);

    // コンテンツを結合（AI分析用）
    const content = bodyContent || [title, description].filter(Boolean).join(" ").slice(0, SCRAPER_CONFIG.CONTENT_MAX_LENGTH);

    return {
      title: title || "Untitled",
      description: description || "",
      content: content || title || "No content",
    };
  } catch (error) {
    console.error("Failed to fetch page metadata:", error);
    // フォールバック: URLのホスト名をタイトルとして使用
    const fallbackTitle = new URL(url).hostname;
    return {
      title: fallbackTitle,
      description: "",
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
