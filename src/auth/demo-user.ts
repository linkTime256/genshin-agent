import { eq } from "drizzle-orm";
import { config } from "../config/env";
import { db } from "../db";
import { user } from "../db/schema";
import { auth } from "./auth";

// 启动时幂等地补一个默认演示用户。
// 密码交给 Better Auth 走标准注册流程做哈希，不自己拼 password 字段。
// 只记录邮箱，绝不把密码或令牌写进日志。
export async function ensureDemoUser() {
  if (!config.demoUser) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", message: "demo user disabled" }));
    return;
  }
  const { email } = config.demoUser;
  if (db.select().from(user).where(eq(user.email, email)).get()) return;

  try {
    await auth.api.signUpEmail({ body: config.demoUser });
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      message: "demo user created",
      email,
    }));
  } catch (error) {
    // 两个进程同时启动时可能撞车，再查一次即可。
    if (db.select().from(user).where(eq(user.email, email)).get()) return;
    throw error;
  }
}
