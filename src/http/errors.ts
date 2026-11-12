import type { Context } from "hono";
import type { ApiErrorBody } from "../../shared/contracts";
import { AppError } from "../domain/errors";
import type { AppEnv } from "./env";

function body(code: string, message: string, requestId: string): ApiErrorBody {
  return { error: { code, message, requestId } };
}

// 全局错误处理器：客户端永远拿到规范化结构，不会看到堆栈或内部细节。
// 参数顺序与 Hono 的 onError(err, c) 一致，可直接注册为全局错误处理器。
export function errorResponse(error: unknown, c: Context<AppEnv>) {
  const requestId = c.get("requestId") ?? "unknown";
  if (error instanceof AppError) {
    return c.json(body(error.code, error.message, requestId), error.status as 400);
  }
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: "error",
    requestId,
    message: error instanceof Error ? error.message : String(error),
  }));
  return c.json(body("INTERNAL", "服务内部错误，请稍后再试", requestId), 500);
}

export function notFoundResponse(c: Context<AppEnv>) {
  const requestId = c.get("requestId") ?? "unknown";
  return c.json(body("NOT_FOUND", "接口不存在", requestId), 404);
}
