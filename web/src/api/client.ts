import type {
  ArtifactDto,
  CharacterDetail,
  CharacterSummary,
  ChatHistoryDto,
  ChatListItem,
  HealthDto,
  ListResponse,
  SessionUser,
  StreamEvent,
  WeaponDto,
} from "../../../shared/contracts";

// 前后端同源部署，Base URL 不需要写死；Vite 开发模式下由代理转发。
const BASE = "";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const FRIENDLY_CODES: Record<string, string> = {
  USER_ALREADY_EXISTS: "这个邮箱已经注册过了，直接登录即可",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "这个邮箱已经注册过了，换一个试试",
  INVALID_EMAIL_OR_PASSWORD: "邮箱或密码不对",
  INVALID_EMAIL: "邮箱格式不对",
  PASSWORD_TOO_SHORT: "密码太短，至少 8 位",
  PASSWORD_TOO_LONG: "密码太长",
  UNAUTHORIZED: "登录已失效，请重新登录",
  OFFLINE: "无法连接服务，请确认后端已启动",
};

function httpMessage(status: number): string {
  if (status === 401) return "请先登录";
  if (status === 403) return "没有权限执行这个操作";
  if (status === 404) return "没有找到对应的内容";
  if (status === 409) return "上一轮还没结束，请稍等";
  if (status >= 500) return "服务暂时不可用，请稍后再试";
  return `请求失败（${status}）`;
}

type ErrorPayload = {
  error?: string | { code?: string; message?: string };
  code?: string;
  message?: string;
};

async function parseError(resp: Response): Promise<ApiError> {
  const payload = (await resp.json().catch(() => null)) as ErrorPayload | null;
  const raw = payload?.error;
  const message = typeof raw === "string"
    ? raw
    : raw?.message ?? payload?.message ?? httpMessage(resp.status);
  const code = (typeof raw === "object" ? raw?.code : undefined) ?? payload?.code ?? `HTTP_${resp.status}`;
  return new ApiError(resp.status, code, FRIENDLY_CODES[code] ?? message);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 统一请求封装：4xx 不重试，5xx 仅对幂等的 GET 最多重试 3 次；网络失败显示离线提示。
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const maxRetries = method === "GET" ? 3 : 0;
  let attempt = 0;

  while (true) {
    let resp: Response;
    try {
      resp = await fetch(`${BASE}${path}`, {
        credentials: "include",
        ...init,
        headers: {
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...(init.headers as Record<string, string> | undefined),
        },
      });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (attempt < maxRetries) {
        attempt += 1;
        await wait(300 * attempt);
        continue;
      }
      throw new ApiError(0, "OFFLINE", FRIENDLY_CODES.OFFLINE);
    }

    if (!resp.ok) {
      const apiError = await parseError(resp);
      if (resp.status >= 500 && attempt < maxRetries) {
        attempt += 1;
        await wait(300 * attempt);
        continue;
      }
      throw apiError;
    }
    if (resp.status === 204) return undefined as T;
    return (await resp.json()) as T;
  }
}

type AuthResult = { user: SessionUser };

export const api = {
  async session(): Promise<AuthResult | null> {
    // Better Auth 未登录时返回 null，不是错误；这里单独处理，不走通用 request。
    const resp = await fetch(`${BASE}/api/auth/get-session`, { credentials: "include" });
    if (!resp.ok) return null;
    return (await resp.json()) as AuthResult | null;
  },
  signIn: (email: string, password: string) =>
    request<AuthResult>("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signUp: (name: string, email: string, password: string) =>
    request<AuthResult>("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  signOut: () => request<{ success: boolean }>("/api/auth/sign-out", { method: "POST" }),
  health: () => request<HealthDto>("/health"),
  chats: () => request<{ chats: ChatListItem[] }>("/chats"),
  history: (chatId: string) =>
    request<ChatHistoryDto>(`/chats/${encodeURIComponent(chatId)}/messages`),
  characters: () => request<ListResponse<CharacterSummary>>("/api/catalog/characters"),
  character: (name: string) =>
    request<CharacterDetail>(`/api/catalog/characters/${encodeURIComponent(name)}`),
  weapons: () => request<ListResponse<WeaponDto>>("/api/catalog/weapons"),
  artifacts: () => request<ListResponse<ArtifactDto>>("/api/catalog/artifacts"),
};

function parseSseBlock(block: string): StreamEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) } as StreamEvent;
  } catch {
    return null;
  }
}

// SSE 不走 request()：响应是流，需要边读边派发事件。
export async function streamMessage(
  text: string,
  chatId: string | undefined,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const path = chatId ? `/chats/${encodeURIComponent(chatId)}/messages` : "/messages";
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!resp.ok) throw await parseError(resp);
  if (!resp.body) throw new ApiError(0, "NO_STREAM", "服务没有返回流式响应");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let split = buffer.indexOf("\n\n");
      while (split >= 0) {
        const parsed = parseSseBlock(buffer.slice(0, split));
        buffer = buffer.slice(split + 2);
        if (parsed) onEvent(parsed);
        split = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
