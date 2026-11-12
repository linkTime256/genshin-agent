import { join } from "node:path";

// 所有配置只在这里读取和校验。启动时缺任何一项就立刻失败，而不是等第一次调模型才报错。
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量 ${name}，请参考 .env.example`);
  return value;
}

const port = Number(process.env.PORT ?? "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT 必须是 1-65535 的整数");
}

export const config = {
  port,
  hostname: process.env.HOST?.trim() || "127.0.0.1",
  deepseekApiKey: required("DEEPSEEK_API_KEY"),
  betterAuthSecret: required("BETTER_AUTH_SECRET"),
  betterAuthUrl: process.env.BETTER_AUTH_URL?.trim() || `http://127.0.0.1:${port}`,
  // 同源部署不需要 CORS。只有显式配置 CORS_ORIGIN 时才开放指定来源，禁止通配符。
  corsOrigin: process.env.CORS_ORIGIN?.trim() || null,
  webRoot: join(import.meta.dir, "../../web/dist"),
} as const;
