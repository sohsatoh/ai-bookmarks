import type { AIGeneratedMetadata } from "~/types/bookmark";
import { sanitizeForPrompt, validateAiResponse } from "./security.server";
import { AI_CONFIG } from "~/constants";

/**
 * Workers AIを使用してURLからメタデータを生成
 * - 既存のカテゴリとの類似性を考慮してカテゴリを選択（全ユーザー共有）
 * - 短い説明文を生成
 * - Prompt Injection対策済み
 * - 同じURLの2回目以降はAI呼び出しをスキップして既存データを再利用
 */
export async function generateBookmarkMetadata(
  ai: Ai,
  url: string,
  pageTitle: string,
  pageDescription: string,
  pageContent: string,
  existingCategories: { major: string[]; minor: string[] }
): Promise<AIGeneratedMetadata> {
  // コンテンツ長を拡張
  const sanitizedTitle = sanitizeForPrompt(
    pageTitle,
    AI_CONFIG.TITLE_MAX_LENGTH
  );
  const sanitizedDescription = sanitizeForPrompt(
    pageDescription,
    AI_CONFIG.DESCRIPTION_MAX_LENGTH
  );
  const sanitizedContent = sanitizeForPrompt(
    pageContent,
    AI_CONFIG.CONTENT_MAX_LENGTH
  );
  // すべての既存カテゴリを含める
  const sanitizedMajorCats = existingCategories.major.map((cat) =>
    sanitizeForPrompt(cat, AI_CONFIG.CATEGORY_MAX_LENGTH)
  );
  const sanitizedMinorCats = existingCategories.minor.map((cat) =>
    sanitizeForPrompt(cat, AI_CONFIG.CATEGORY_MAX_LENGTH)
  );

  // 既存カテゴリのフォーマットを改善
  const existingMajorList =
    sanitizedMajorCats.length > 0
      ? `\n利用可能な大カテゴリ（このリストから選択してください）:\n${sanitizedMajorCats.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
      : "";
  const existingMinorList =
    sanitizedMinorCats.length > 0
      ? `\n利用可能な小カテゴリ（このリストから選択してください）:\n${sanitizedMinorCats.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
      : "";

  // プロンプトを改善：既存カテゴリの使用を強調
  const systemPrompt = `あなたはWebページを分類する専門家です。以下のルールに従ってJSON形式で出力してください：

【重要】既存カテゴリが提示されている場合、以下の方式としてください。ただし、カテゴリは広すぎてはならず、具体的で関連性の高いものを選んでください。
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
    // eslint-disable-next-line no-console
    console.log(
      `[AI] Starting metadata generation for URL: ${url.substring(0, 50)}...`
    );

    let response: unknown;
    try {
      // OpenAI GPT 120Bモデルを使用（input形式）
      response = await ai.run(AI_CONFIG.MODEL_NAME, {
        instructions: systemPrompt,
        input: userInput,
        max_tokens: AI_CONFIG.MAX_TOKENS,
      });
    } catch (aiError) {
      console.error(`[AI] API call failed:`, aiError);
      console.error(
        `[AI] Error details:`,
        aiError instanceof Error
          ? {
              message: aiError.message,
              stack: aiError.stack,
            }
          : String(aiError)
      );
      throw new Error(
        `AI APIの呼び出しに失敗しました: ${aiError instanceof Error ? aiError.message : String(aiError)}`
      );
    }

    // eslint-disable-next-line no-console
    console.log(`[AI] Raw response type:`, typeof response);
    // eslint-disable-next-line no-console
    console.log(`[AI] Raw response:`, response);

    // AI応答の検証
    const validation = validateAiResponse(response);
    if (!validation.valid) {
      console.error(`[AI] Validation failed:`, validation.error);
      console.error(`[AI] Response was:`, response);
      throw new Error(validation.error);
    }

    // レスポンスからテキストを抽出（新しいoutput形式に対応）
    let responseText = "";
    if (typeof response === "string") {
      responseText = response;
    } else if (response && typeof response === "object") {
      // output配列からstatus: "completed"のmessageタイプのオブジェクトを探す
      const output = (
        response as {
          output?: Array<{
            type?: string;
            status?: string;
            content?: Array<{ type?: string; text?: string } | string>;
          }>;
        }
      ).output;
      if (Array.isArray(output)) {
        const messageObj = output.find(
          (item) => item.type === "message" && item.status === "completed"
        );
        if (messageObj?.content && Array.isArray(messageObj.content)) {
          // content配列からtype: "output_text"のアイテムを取得
          const contentItem = messageObj.content.find(
            (item) =>
              (typeof item === "object" &&
                (item.type === "output_text" || item.type === "text")) ||
              typeof item === "string"
          );
          responseText =
            typeof contentItem === "string"
              ? contentItem
              : (
                  contentItem as {
                    text?: string;
                  }
                )?.text || "";
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

    // eslint-disable-next-line no-console
    console.log(`[AI] Extracted text:`, responseText.substring(0, 200));

    // JSONブロックを抽出（```json または { で始まるパターン）
    const jsonRegex1 = /```json\s*([\s\S]*?)\s*```/;
    const jsonRegex2 = /(\{[\s\S]*\})/;
    const jsonMatch =
      jsonRegex1.exec(responseText) || jsonRegex2.exec(responseText);

    if (!jsonMatch) {
      console.error(`[AI] Could not extract JSON from text:`, responseText);
      throw new Error("AI応答からJSONを抽出できませんでした");
    }

    let metadata: AIGeneratedMetadata;
    try {
      metadata = JSON.parse(jsonMatch[1]) as AIGeneratedMetadata;
      // eslint-disable-next-line no-console
      console.log(`[AI] Parsed metadata:`, metadata);
    } catch (parseError) {
      console.error(`[AI] JSON parse error:`, parseError);
      console.error(`[AI] Failed to parse:`, jsonMatch[1]);
      throw new Error(
        `JSONパースに失敗しました: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }

    // バリデーションとサニタイズ
    if (
      !metadata.majorCategory ||
      !metadata.minorCategory ||
      !metadata.description
    ) {
      console.error(`[AI] Missing required fields:`, metadata);
      throw new Error("必須フィールドが不足しています");
    }

    // XSS対策: 特殊文字をチェック（Reactがエスケープするが、追加の確認）
    const dangerousChars = /<|>|script|onerror|onclick/i;
    if (
      dangerousChars.test(metadata.majorCategory) ||
      dangerousChars.test(metadata.minorCategory) ||
      dangerousChars.test(metadata.description)
    ) {
      console.warn("Potential XSS attempt detected in AI response");
      throw new Error("不正な応答が検出されました");
    }

    // eslint-disable-next-line no-console
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
