import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./env";

// 请求 ID 贯穿日志与错误响应；同时下发基础安全头。
// 只记录方法与路径，不记录 query、body、Cookie、令牌等敏感数据。
export function requestContext(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    c.header("x-content-type-options", "nosniff");
    c.header("x-frame-options", "DENY");
    c.header("referrer-policy", "strict-origin-when-cross-origin");
    c.header("permissions-policy", "camera=(), microphone=(), geolocation=()");

    const startedAt = performance.now();
    try {
      await next();
    } finally {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: "info",
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: c.res?.status ?? 500,
        durationMs: Math.round(performance.now() - startedAt),
      }));
    }
  };
}
