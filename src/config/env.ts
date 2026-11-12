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

// 默认演示用户：本地开发开箱即用。生产或公网部署务必设 DEMO_USER_ENABLED=false。
// 凭据可用环境变量覆盖，代码里的只是本地演示值，不要当作真实密钥。
const demoEnabled = (process.env.DEMO_USER_ENABLED ?? "true").trim().toLowerCase() !== "false";
const demoUser = demoEnabled
  ? {
      name: process.env.DEMO_USER_NAME?.trim() || "演示用户",
      email: process.env.DEMO_USER_EMAIL?.trim() || "demo@genshin.local",
      password: process.env.DEMO_USER_PASSWORD?.trim() || "demo12345",
    }
  : null;

export const config = {
  port,
  hostname: process.env.HOST?.trim() || "127.0.0.1",
  deepseekApiKey: required("DEEPSEEK_API_KEY"),
  betterAuthSecret: required("BETTER_AUTH_SECRET"),
  betterAuthUrl: process.env.BETTER_AUTH_URL?.trim() || `http://127.0.0.1:${port}`,
  // 同源部署不需要 CORS。只有显式配置 CORS_ORIGIN 时才开放指定来源，禁止通配符。
  corsOrigin: process.env.CORS_ORIGIN?.trim() || null,
  webRoot: join(import.meta.dir, "../../web/dist"),
  databasePath: process.env.DATABASE_PATH?.trim() || join(import.meta.dir, "../../agent.sqlite"),
  demoUser,
} as const;
