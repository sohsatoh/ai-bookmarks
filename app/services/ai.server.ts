import type { AIGeneratedMetadata } from "~/types/bookmark";
import { sanitizeForPrompt, validateAiResponse } from "./security.server";

/**
 * Workers AIを使用してURLからメタデータを生成
 * - 既存のカテゴリとの類似性を考慮してカテゴリを選択
 * - 短い説明文を生成
 * - Prompt Injection対策済み
 */
export async function generateBookmarkMetadata(ai: Ai, url: string, pageTitle: string, pageDescription: string, pageContent: string, existingCategories: { major: string[]; minor: string[] }): Promise<AIGeneratedMetadata> {
  // コスト削減: コンテンツ長を制限
  const sanitizedTitle = sanitizeForPrompt(pageTitle, 150);
  const sanitizedDescription = sanitizeForPrompt(pageDescription, 200);
  const sanitizedContent = sanitizeForPrompt(pageContent, 400);
  // 既存カテゴリは最大10個まで（プロンプト長を削減）
  const sanitizedMajorCats = existingCategories.major.slice(0, 10).map((cat) => sanitizeForPrompt(cat, 50));
  const sanitizedMinorCats = existingCategories.minor.slice(0, 10).map((cat) => sanitizeForPrompt(cat, 50));

  // 既存カテゴリのフォーマットを改善
  const existingMajorList = sanitizedMajorCats.length > 0 ? `\n利用可能な大カテゴリ（このリストから選択してください）:\n${sanitizedMajorCats.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : "";
  const existingMinorList = sanitizedMinorCats.length > 0 ? `\n利用可能な小カテゴリ（このリストから選択してください）:\n${sanitizedMinorCats.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : "";

  // プロンプトを改善：既存カテゴリの使用を強調
  const systemPrompt = `あなたはWebページを分類する専門家です。以下のルールに従ってJSON形式で出力してください：

【重要】既存カテゴリが提示されている場合、必ずそのリストから最も適切なものを選択してください。新しいカテゴリは既存のものがどれも適切でない場合のみ作成します。

【固有名詞・技術用語の扱い】企業名、製品名、サービス名、技術用語（例：Google、GitHub、React、AWS等）は翻訳せず、そのまま原語で使用してください。

【大分類と小分類の例】
- 大分類: コンピューターサイエンス、ニュース、エンターテイメント、教育、健康、ビジネス、趣味、ライフスタイル、旅行、ショッピングなど
- 小分類: モバイルアプリセキュリティ、Webセキュリティ...など、より具体的なカテゴリ

出力形式:
{"majorCategory":"大分類","minorCategory":"小分類","description":"日本語で80文字以内の説明"}`;

  const userInput = `【分類対象】
タイトル: ${sanitizedTitle}
ページ説明: ${sanitizedDescription}
内容: ${sanitizedContent}${existingMajorList}${existingMinorList}`;

  try {
    console.log(`[AI] Starting metadata generation for URL: ${url.substring(0, 50)}...`);

    // OpenAI GPT 20Bモデルを使用（input形式）
    const response = await ai.run("@cf/openai/gpt-oss-20b", {
      instructions: systemPrompt,
      input: userInput,
      max_tokens: 150,
    });

    console.log(`[AI] Raw response received:`, JSON.stringify(response).substring(0, 200) + "...");

    // AI応答の検証
    const validation = validateAiResponse(response);
    if (!validation.valid) {
      console.error(`[AI] Validation failed:`, validation.error);
      throw new Error(validation.error);
    }

    // レスポンスからテキストを抽出（新しいoutput形式に対応）
    let responseText = "";
    if (typeof response === "string") {
      responseText = response;
    } else if (response && typeof response === "object") {
      // output配列からstatus: "completed"のmessageタイプのオブジェクトを探す
      const output = (response as any).output;
      if (Array.isArray(output)) {
        const messageObj = output.find((item: any) => item.type === "message" && item.status === "completed");
        if (messageObj?.content && Array.isArray(messageObj.content)) {
          // content配列からtype: "output_text"のアイテムを取得
          const contentItem = messageObj.content.find((item: any) => item.type === "output_text" || item.type === "text" || typeof item === "string");
          responseText = typeof contentItem === "string" ? contentItem : contentItem?.text || "";
        }
      }
      // フォールバック: 旧形式のresponseプロパティ
      if (!responseText) {
        responseText = (response as { response?: string }).response || "";
      }
    }

    if (!responseText) {
      console.error(`[AI] Could not extract text from response`);
      throw new Error("AI応答からテキストを抽出できませんでした");
    }

    console.log(`[AI] Extracted text:`, responseText.substring(0, 200));

    // JSONブロックを抽出（```json または { で始まるパターン）
    const jsonRegex1 = /```json\s*([\s\S]*?)\s*```/;
    const jsonRegex2 = /(\{[\s\S]*\})/;
    const jsonMatch = jsonRegex1.exec(responseText) || jsonRegex2.exec(responseText);

    if (!jsonMatch) {
      console.error(`[AI] Could not extract JSON from text:`, responseText);
      throw new Error("AI応答からJSONを抽出できませんでした");
    }

    const metadata = JSON.parse(jsonMatch[1]) as AIGeneratedMetadata;
    console.log(`[AI] Parsed metadata:`, metadata);

    // バリデーションとサニタイズ
    if (!metadata.majorCategory || !metadata.minorCategory || !metadata.description) {
      console.error(`[AI] Missing required fields:`, metadata);
      throw new Error("必須フィールドが不足しています");
    }

    // XSS対策: 特殊文字をチェック（Reactがエスケープするが、追加の確認）
    const dangerousChars = /<|>|script|onerror|onclick/i;
    if (dangerousChars.test(metadata.majorCategory) || dangerousChars.test(metadata.minorCategory) || dangerousChars.test(metadata.description)) {
      console.warn("Potential XSS attempt detected in AI response");
      throw new Error("不正な応答が検出されました");
    }

    console.log(`[AI] Successfully generated metadata`);
    return {
      majorCategory: metadata.majorCategory.trim().slice(0, 100),
      minorCategory: metadata.minorCategory.trim().slice(0, 100),
      description: metadata.description.trim().slice(0, 200), // 最大200文字に制限
    };
  } catch (error) {
    console.error("[AI] Metadata generation failed:", error);
    console.error("[AI] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // フォールバック: URLベースのシンプルなカテゴリ分類
    const domain = new URL(url).hostname;
    return {
      majorCategory: "未分類",
      minorCategory: domain,
      description: pageTitle.slice(0, 50),
    };
  }
}

/**
 * AIを使用してカテゴリアイコン（SVG）を生成
 * シンプルなアイコン風のSVGを生成します
 */
export async function generateCategoryIcon(ai: Ai, categoryName: string, categoryType: "major" | "minor"): Promise<string> {
  const systemPrompt = `あなたはシンプルで美しいSVGアイコンを生成する専門家です。
カテゴリ名に基づいて、24x24のシンプルなSVGアイコンを生成してください。

【要件】
- サイズ: viewBox="0 0 24 24" width="24" height="24"
- スタイル: シンプルで認識しやすい、線画またはフラットデザイン
- 色: currentColor を使用（テーマに応じて色が変わるように）
- 背景なし、透明
- XMLヘッダー不要、<svg>タグから始めてください

【出力形式】
純粋なSVGコードのみを出力してください。説明文やマークダウンは不要です。`;

  const userInput = `カテゴリ名: ${sanitizeForPrompt(categoryName, 50)}
カテゴリタイプ: ${categoryType === "major" ? "大カテゴリ" : "小カテゴリ"}

このカテゴリを表現するシンプルなアイコンを生成してください。`;

  try {
    console.log(`[AI] Generating icon for category: ${categoryName}`);

    const response = await ai.run("@cf/openai/gpt-oss-20b", {
      instructions: systemPrompt,
      input: userInput,
      max_tokens: 500,
    });

    // レスポンスからテキストを抽出
    let responseText = "";
    if (typeof response === "string") {
      responseText = response;
    } else if (response && typeof response === "object") {
      const output = (response as any).output;
      if (Array.isArray(output)) {
        const messageObj = output.find((item: any) => item.type === "message" && item.status === "completed");
        if (messageObj?.content && Array.isArray(messageObj.content)) {
          const contentItem = messageObj.content.find((item: any) => item.type === "output_text" || item.type === "text" || typeof item === "string");
          responseText = typeof contentItem === "string" ? contentItem : contentItem?.text || "";
        }
      }
      if (!responseText) {
        responseText = (response as { response?: string }).response || "";
      }
    }

    if (!responseText) {
      console.error(`[AI] Could not extract icon SVG from response`);
      return getDefaultIcon(categoryType);
    }

    // SVGコードを抽出（```svg または <svg で始まるパターン）
    const svgRegex1 = /```svg\s*([\s\S]*?)\s*```/;
    const svgRegex2 = /(<svg[\s\S]*?<\/svg>)/i;
    const svgMatch = svgRegex1.exec(responseText) || svgRegex2.exec(responseText);

    if (!svgMatch) {
      console.error(`[AI] Could not extract SVG from text`);
      return getDefaultIcon(categoryType);
    }

    const svgCode = svgMatch[1].trim();

    // セキュリティチェック: scriptタグやイベントハンドラーがないか確認
    const dangerousPatterns = /<script|onerror|onclick|onload|javascript:/i;
    if (dangerousPatterns.test(svgCode)) {
      console.warn("Potential XSS attempt detected in SVG");
      return getDefaultIcon(categoryType);
    }

    // SVGタグの基本検証
    if (!svgCode.startsWith("<svg") || !svgCode.endsWith("</svg>")) {
      console.error(`[AI] Invalid SVG format`);
      return getDefaultIcon(categoryType);
    }

    console.log(`[AI] Successfully generated icon SVG`);
    return svgCode;
  } catch (error) {
    console.error("[AI] Icon generation failed:", error);
    return getDefaultIcon(categoryType);
  }
}

/**
 * デフォルトアイコンを返す
 */
function getDefaultIcon(categoryType: "major" | "minor"): string {
  if (categoryType === "major") {
    // 大カテゴリ用のフォルダーアイコン
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
  } else {
    // 小カテゴリ用のタグアイコン
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`;
  }
}
