import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");
  let statusCode = responseStatusCode;

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error: unknown) {
        statusCode = 500;
        // Log streaming rendering errors from inside the shell.  Don't log
        // errors encountered during initial shell rendering since they'll
        // reject and get logged in handleDocumentRequest.
        if (shellRendered) {
          console.error(error);
        }
      },
    }
  );
  shellRendered = true;

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  // セキュリティヘッダーの設定（強化版）
  responseHeaders.set("Content-Type", "text/html; charset=utf-8");

  // CSP: XSS対策を強化
  responseHeaders.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self'; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'; " +
      "upgrade-insecure-requests; " +
      "block-all-mixed-content;"
  );

  // その他のセキュリティヘッダー
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("X-Frame-Options", "DENY");
  responseHeaders.set("X-XSS-Protection", "1; mode=block");
  responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  responseHeaders.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  // HSTS（HTTP Strict Transport Security）
  // HTTPS接続を強制し、中間者攻撃（MITM）を防止
  // 本番環境でHTTPSが有効な場合にのみ設定
  const url = new URL(request.url);
  if (url.protocol === "https:") {
    responseHeaders.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return new Response(body, {
    headers: responseHeaders,
    status: statusCode,
  });
}
