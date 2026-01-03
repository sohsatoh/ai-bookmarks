import type { AIGeneratedMetadata } from "~/types/bookmark";

/**
 * Workers AIを使用してURLからメタデータを生成
 * - 既存のカテゴリとの類似性を考慮してカテゴリを選択
 * - 短い説明文を生成
 */
export async function generateBookmarkMetadata(ai: Ai, url: string, pageTitle: string, pageContent: string, existingCategories: { major: string[]; minor: string[] }): Promise<AIGeneratedMetadata> {
  const prompt = `あなたはWebブックマーク管理システムのアシスタントです。以下のWebページの情報から、適切なカテゴリと説明文を生成してください。

URL: ${url}
ページタイトル: ${pageTitle}
ページ内容: ${pageContent.slice(0, 1000)}

既存の大カテゴリ: ${existingCategories.major.length > 0 ? existingCategories.major.join(", ") : "なし"}
既存の小カテゴリ: ${existingCategories.minor.length > 0 ? existingCategories.minor.join(", ") : "なし"}

以下のJSON形式で回答してください:
{
  "majorCategory": "大カテゴリ名（既存のカテゴリで適切なものがあればそれを使用、なければ新規作成）",
  "minorCategory": "小カテゴリ名（既存のカテゴリで適切なものがあればそれを使用、なければ新規作成）",
  "description": "50文字以内の短い説明文"
}

注意:
- 既存のカテゴリと類似している場合は、必ず既存のカテゴリ名をそのまま使用してください
- 大カテゴリは広い分野（例: プログラミング、デザイン、ニュース）
- 小カテゴリは具体的なトピック（例: React、UI/UX、テクノロジー）
- 説明文は簡潔で、ページの主な内容を表現してください`;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct" as any, {
      prompt,
      max_tokens: 300,
    });

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

    // バリデーション
    if (!metadata.majorCategory || !metadata.minorCategory || !metadata.description) {
      throw new Error("必須フィールドが不足しています");
    }

    return {
      majorCategory: metadata.majorCategory.trim(),
      minorCategory: metadata.minorCategory.trim(),
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
