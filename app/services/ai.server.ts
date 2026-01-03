import type { AIGeneratedMetadata } from "~/types/bookmark";
import { sanitizeForPrompt, validateAiResponse } from "./security.server";

/**
 * Workers AIを使用してURLからメタデータを生成
 * - 既存のカテゴリとの類似性を考慮してカテゴリを選択
 * - 短い説明文を生成
 * - Prompt Injection対策済み
 */
export async function generateBookmarkMetadata(ai: Ai, url: string, pageTitle: string, pageDescription: string, pageContent: string, existingCategories: { major: string[]; minor: string[] }): Promise<AIGeneratedMetadata> {
  // コンテンツ長を拡張
  const sanitizedTitle = sanitizeForPrompt(pageTitle, 300);
  const sanitizedDescription = sanitizeForPrompt(pageDescription, 500);
  const sanitizedContent = sanitizeForPrompt(pageContent, 1500);
  // すべての既存カテゴリを含める
  const sanitizedMajorCats = existingCategories.major.map((cat) => sanitizeForPrompt(cat, 100));
  const sanitizedMinorCats = existingCategories.minor.map((cat) => sanitizeForPrompt(cat, 100));

  // 既存カテゴリのフォーマットを改善
  const existingMajorList = sanitizedMajorCats.length > 0 ? `\n利用可能な大カテゴリ（このリストから選択してください）:\n${sanitizedMajorCats.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : "";
  const existingMinorList = sanitizedMinorCats.length > 0 ? `\n利用可能な小カテゴリ（このリストから選択してください）:\n${sanitizedMinorCats.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : "";

  // プロンプトを改善：既存カテゴリの使用を強調
  const systemPrompt = `あなたはWebページを分類する専門家です。以下のルールに従ってJSON形式で出力してください：

【重要】既存カテゴリが提示されている場合、以下の方式としてください。
- もし適切なカテゴリが存在している場合: そのリストから最も適切なものを選択してください
- 適切なカテゴリがない場合: 新しいカテゴリを作成する

【固有名詞・技術用語の扱い】企業名、製品名、サービス名、技術用語（例：Google、GitHub、React、AWS等）は翻訳せず、そのまま原語で使用してください。

【大分類と小分類の例】
- 大分類: コンピューターサイエンス、ニュース、エンターテイメント、教育、健康、ビジネス、趣味、ライフスタイル、旅行、ショッピングなど大まかなカテゴリ
- 小分類: モバイルアプリセキュリティ、Webセキュリティ...など、より具体的なカテゴリ

出力形式:
{"majorCategory":"大分類","minorCategory":"小分類","description":"日本語で150文字以内の説明"}`;

  const userInput = `【分類対象】
タイトル: ${sanitizedTitle}
ページ説明: ${sanitizedDescription}
内容: ${sanitizedContent}${existingMajorList}${existingMinorList}`;

  try {
    console.log(`[AI] Starting metadata generation for URL: ${url.substring(0, 50)}...`);

    // OpenAI GPT 120Bモデルを使用（input形式）
    const response = await ai.run("@cf/openai/gpt-oss-120b", {
      instructions: systemPrompt,
      input: userInput,
      max_tokens: 300,
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
      majorCategory: metadata.majorCategory.trim().slice(0, 150),
      minorCategory: metadata.minorCategory.trim().slice(0, 150),
      description: metadata.description.trim().slice(0, 300), // 最大300文字に制限
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
