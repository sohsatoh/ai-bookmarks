import type { AIGeneratedMetadata } from "~/types/bookmark";
import { sanitizeForPrompt, validateAiResponse } from "./security.server";

/**
 * Workers AIを使用してURLからメタデータを生成
 * - 既存のカテゴリとの類似性を考慮してカテゴリを選択
 * - 短い説明文を生成
 * - Prompt Injection対策済み
 */
export async function generateBookmarkMetadata(ai: Ai, url: string, pageTitle: string, pageContent: string, existingCategories: { major: string[]; minor: string[] }): Promise<AIGeneratedMetadata> {
  // Prompt Injection対策: ユーザー入力をサニタイズ
  const sanitizedUrl = sanitizeForPrompt(url, 500);
  const sanitizedTitle = sanitizeForPrompt(pageTitle, 200);
  const sanitizedContent = sanitizeForPrompt(pageContent, 1000);
  const sanitizedMajorCats = existingCategories.major.map((cat) => sanitizeForPrompt(cat, 50));
  const sanitizedMinorCats = existingCategories.minor.map((cat) => sanitizeForPrompt(cat, 50));

  // システムプロンプトとユーザー入力を明確に分離
  const systemPrompt = `あなたはWebブックマーク管理システムのアシスタントです。以下のWebページの情報から、適切なカテゴリと説明文を生成してください。

以下のJSON形式で回答してください:
\{\{\{
  "majorCategory": "大カテゴリ名（既存のカテゴリで適切なものがあればそれを使用、なければ新規作成）",
  "minorCategory": "小カテゴリ名（既存のカテゴリで適切なものがあればそれを使用、なければ新規作成）",
  "description": "50文字以内の短い説明文"
\}\}\}

注意:
- 既存のカテゴリと類似している場合は、必ず既存のカテゴリ名をそのまま使用してください
- 大カテゴリは広い分野（例: プログラミング、デザイン、ニュース）
- 小カテゴリは具体的なトピック（例: React、UI/UX、テクノロジー）
- 説明文は簡潔で、ページの主な内容を表現してください
- JSON以外のテキストは出力しないでください`;

  const userInput = `
--- ユーザー入力開始 ---
URL: ${sanitizedUrl}
ページタイトル: ${sanitizedTitle}
ページ内容: ${sanitizedContent}

既存の大カテゴリ: ${sanitizedMajorCats.length > 0 ? sanitizedMajorCats.join(", ") : "なし"}
既存の小カテゴリ: ${sanitizedMinorCats.length > 0 ? sanitizedMinorCats.join(", ") : "なし"}
--- ユーザー入力終了 ---`;

  const prompt = systemPrompt + userInput;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct" as any, {
      prompt,
      max_tokens: 300,
    });

    // AI応答の検証
    const validation = validateAiResponse(response);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // レスポンスからJSONを抽出
    const responseText = typeof response === "string" ? response : (response as { response?: string }).response || "";

    // JSONブロックを抽出（```json または { で始まるパターン）
    const jsonRegex1 = /```json\s*([\s\S]*?)\s*```/;
    const jsonRegex2 = /(\{[\s\S]*\})/;
    const jsonMatch = jsonRegex1.exec(responseText) || jsonRegex2.exec(responseText);

    if (!jsonMatch) {
      throw new Error("AI応答からJSONを抽出できませんでした");
    }

    const metadata = JSON.parse(jsonMatch[1]) as AIGeneratedMetadata;

    // バリデーションとサニタイズ
    if (!metadata.majorCategory || !metadata.minorCategory || !metadata.description) {
      throw new Error("必須フィールドが不足しています");
    }

    // XSS対策: 特殊文字をチェック（Reactがエスケープするが、追加の確認）
    const dangerousChars = /<|>|script|onerror|onclick/i;
    if (dangerousChars.test(metadata.majorCategory) || dangerousChars.test(metadata.minorCategory) || dangerousChars.test(metadata.description)) {
      console.warn("Potential XSS attempt detected in AI response");
      throw new Error("不正な応答が検出されました");
    }

    return {
      majorCategory: metadata.majorCategory.trim().slice(0, 100),
      minorCategory: metadata.minorCategory.trim().slice(0, 100),
      description: metadata.description.trim().slice(0, 200), // 最大200文字に制限
    };
  } catch (error) {
    console.error("AI metadata generation failed:", error);
    // フォールバック: URLベースのシンプルなカテゴリ分類
    const domain = new URL(url).hostname;
    return {
      majorCategory: "未分類",
      minorCategory: domain,
      description: pageTitle.slice(0, 50),
    };
  }
}
