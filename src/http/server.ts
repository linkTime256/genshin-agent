import { join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { auth } from "../auth/auth";
import { listChats, load, startChatTurn } from "../chats/store";
import { runTurn } from "../chats/turn";
import { config } from "../config/env";
import { db } from "../db";
import { characters } from "../db/schema";
import type { ChatHistoryDto, ChatMessageDto, HealthDto, ReadyDto } from "../../shared/contracts";
import { errorResponse, notFoundResponse } from "./errors";
import type { AppEnv } from "./env";
import { requestContext } from "./middleware";
import { catalogRoutes } from "./routes/catalog";

export const app = new Hono<AppEnv>();

app.onError(errorResponse);
app.use("*", requestContext());

// 同源部署不开放跨域；只有显式配置 CORS_ORIGIN 时才允许指定来源。
if (config.corsOrigin) {
  app.use("/api/*", cors({
    origin: config.corsOrigin,
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  }));
}

// 健康检查不需要登录，放在鉴权之前。
const startedAt = Date.now();
app.get("/health", (c) => c.json({
  status: "ok",
  uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  version: "1.0.0-web",
} satisfies HealthDto));

app.get("/ready", (c) => {
  try {
    db.select().from(characters).limit(1).all();
    return c.json({ status: "ready", checks: { database: "ok" } } satisfies ReadyDto);
  } catch {
    return c.json({ status: "starting", checks: { database: "fail" } } satisfies ReadyDto, 503);
  }
});

// 注册和登录走 Better Auth，会下发同源会话 Cookie。
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

// 只保护 API 路径；静态资源和页面本身公开，未登录由前端引导去登录。
app.use("*", async (c, next) => {
  if (!isProtectedApiPath(c.req.path)) return next();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    // 新增的 /api/catalog 一律返回规范化错误；旧的聊天端点保持原格式，避免打断控制台客户端。
    if (c.req.path.startsWith("/api/catalog")) {
      return c.json({
        error: { code: "UNAUTHORIZED", message: "请先登录", requestId: c.get("requestId") },
      }, 401);
    }
    return c.json({ error: "未登录" }, 401);
  }
  c.set("userId", session.user.id);
  await next();
});

app.route("/api/catalog", catalogRoutes);

app.get("/chats", (c) => {
  const userId = c.get("userId");
  const items = listChats(userId);
  console.log(`用户 ${userId} 查看聊天，共 ${items.length} 个`);
  return c.json({ chats: items });
});

// 网页端切换聊天时读历史。只回显 user / assistant 正文，工具调用过程留在 log.txt。
app.get("/chats/:id/messages", (c) => {
  const chatId = c.req.param("id");
  const history = load(c.get("userId"), chatId);
  if (history === "forbidden") return c.json({ error: "这个聊天不属于当前用户" }, 403);
  if (history === null) return c.json({ error: "没有这个聊天" }, 404);
  const messages: ChatMessageDto[] = [];
  for (const message of history) {
    if ((message.role === "user" || message.role === "assistant") && typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
    }
  }
  return c.json({ chatId, messages } satisfies ChatHistoryDto);
});

app.post("/messages", (c) => messageTurn(c));
app.post("/chats/:id/messages", (c) => messageTurn(c, c.req.param("id")));

// 两条发消息的路由都进这里。没有 chatId 就是第一条消息，顺手建聊天；有 chatId 就接着这个聊天说。
// 响应不是一次性 JSON，而是 SSE：先推 chat，再推 token，最后 done。
// case 1：POST /messages { text: "胡桃是什么元素" } → 新建聊天，客户端从第一条事件拿到 chatId。
// case 2：POST /chats/fb80…/messages { text: "那武器呢" } → 还是这个聊天，历史会一起带上。
const MAX_MESSAGE_LENGTH = 2000;

async function messageTurn(c: Context<AppEnv>, chatId?: string) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "请求体不是 JSON" }, 400);
  }
  const text = typeof body === "object" && body !== null && "text" in body ? body.text : undefined;
  if (typeof text !== "string" || text.trim().length === 0) return c.json({ error: "缺少 text" }, 400);
  if (text.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: `消息不能超过 ${MAX_MESSAGE_LENGTH} 字` }, 400);
  }

  const userId = c.get("userId");
  const started = startChatTurn(userId, chatId);
  if (!started.ok) {
    if (started.error === "forbidden") {
      console.log(`用户 ${userId} 拒绝访问聊天 ${chatId ?? ""}`);
      return c.json({ error: "这个聊天不属于当前用户" }, 403);
    }
    if (started.error === "busy") return c.json({ error: "这一轮还没结束" }, 409);
    return c.json({ error: "没有这个聊天" }, 404);
  }

  if (started.created) console.log(`用户 ${userId} 创建聊天 ${started.chat.id}`);
  console.log(`用户 ${userId} 聊天 ${started.chat.id} 收到消息：${text}`);
  const id = started.chat.id;
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: "chat", data: JSON.stringify({ chatId: id }) });
    await runTurn(userId, id, text, (event, data) => stream.writeSSE({ event, data: JSON.stringify(data) }));
  });
}

// 发消息走 SSE。查工具的那几秒没有 token，连接是静的。
function isMessagePost(req: Request) {
  if (req.method !== "POST") return false;
  const pathname = new URL(req.url).pathname;
  if (pathname === "/messages") return true;
  const parts = pathname.split("/");
  return parts.length === 4 && parts[1] === "chats" && parts[3] === "messages";
}

function isProtectedApiPath(path: string) {
  if (path.startsWith("/api/auth/")) return false;
  if (path === "/health" || path === "/ready") return false;
  if (path.startsWith("/api/catalog")) return true;
  if (path === "/chats" || path === "/messages") return true;
  return /^\/chats\/[^/]+\/messages$/.test(path);
}

function isApiPath(path: string) {
  return path.startsWith("/api/") || isProtectedApiPath(path);
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

// Vite 构建产物由同一个 Hono 服务托管，前后端同源，无需在前端写死后端地址。
app.get("/*", async (c) => {
  const path = c.req.path;
  if (isApiPath(path)) return notFoundResponse(c);
  const rel = path === "/" ? "index.html" : path.slice(1);
  if (rel.includes("..")) return notFoundResponse(c);

  const file = Bun.file(join(config.webRoot, rel));
  if (await file.exists()) {
    const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
    const immutable = rel.startsWith("assets/");
    return new Response(file, {
      headers: {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      },
    });
  }

  // 带扩展名的静态资源不存在就是 404，其余路径交给 SPA 路由。
  if (/\.[a-z0-9]+$/i.test(rel)) return c.text("Not found", 404);
  const index = Bun.file(join(config.webRoot, "index.html"));
  if (!(await index.exists())) {
    return c.text("前端尚未构建，请先运行 bun run build:web", 503);
  }
  return new Response(index, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
  });
});

app.notFound(notFoundResponse);

export function listen(port = config.port) {
  const server = Bun.serve({
    port,
    hostname: config.hostname,
    fetch(req, server) {
      // Bun 默认 10 秒没有字节就掐掉连接。客户端这条连接是登录留下来的，
      // fetch 会把同一个 POST 再发一次，服务端就新建第二个聊天，整轮再跑一遍。
      if (isMessagePost(req)) server.timeout(req, 0);
      return app.fetch(req);
    },
  });
  console.log(`http://${config.hostname}:${port}`);

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", message: "graceful shutdown", signal }));
    server.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  return server;
}
