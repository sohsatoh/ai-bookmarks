/**
 * robots.txt生成
 *
 * 検索エンジンクローラー向けのルール定義
 */

import type { LoaderFunctionArgs } from "react-router";

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const robotsTxt = `# AI Bookmarks - robots.txt
User-agent: *
Allow: /
Disallow: /home
Disallow: /settings
Disallow: /files
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
