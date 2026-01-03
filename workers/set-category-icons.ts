// 既存カテゴリにアイコンを設定するスクリプト
import { generateCategoryIcon } from "./app/services/ai.server";

interface Category {
  id: number;
  name: string;
  type: "major" | "minor";
  icon: string | null;
}

// Cloudflare Workers環境でこのスクリプトを実行する必要があります
export default {
  async fetch(request: Request, env: { AI: Ai; DB: D1Database }): Promise<Response> {
    try {
      // 既存のアイコンがないカテゴリを取得
      const categories = await env.DB.prepare("SELECT id, name, type FROM categories WHERE icon IS NULL").all<Category>();

      if (!categories.results || categories.results.length === 0) {
        return new Response("すべてのカテゴリにアイコンが設定されています", { status: 200 });
      }

      console.log(`Processing ${categories.results.length} categories...`);

      // 各カテゴリのアイコンを生成して保存
      for (const category of categories.results) {
        console.log(`Generating icon for: ${category.name} (${category.type})`);

        const icon = await generateCategoryIcon(env.AI, category.name, category.type as "major" | "minor");

        await env.DB.prepare("UPDATE categories SET icon = ? WHERE id = ?").bind(icon, category.id).run();

        console.log(`✓ Icon set for: ${category.name}`);
      }

      return new Response(`アイコンを${categories.results.length}個のカテゴリに設定しました`, { status: 200 });
    } catch (error) {
      console.error("Error setting category icons:", error);
      return new Response(`エラー: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
    }
  },
};
