// 前后端共享的接口契约。只放类型，不产生运行时代码。
// 后端 src/ 与前端 web/src/ 都从这里 import，保证字段改动能同时被两端类型检查发现。

export type ElementCode = "Fire" | "Water" | "Wind" | "Electric" | "Grass" | "Ice" | "Rock";
export type WeaponTypeCode =
  | "WEAPON_SWORD_ONE_HAND"
  | "WEAPON_CLAYMORE"
  | "WEAPON_POLE"
  | "WEAPON_CATALYST"
  | "WEAPON_BOW";

export type CharacterSummary = {
  name: string;
  rank: number;
  element: string;
  weaponType: string;
  weaponCount: number;
  artifactCount: number;
};

export type WeaponDto = {
  name: string;
  rank: number;
  type: string;
};

export type ArtifactDto = {
  name: string;
  effects: string[];
};

export type CharacterDetail = CharacterSummary & {
  weapons: WeaponDto[];
  artifacts: ArtifactDto[];
};

export type ListResponse<T> = {
  items: T[];
  total: number;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};

// 默认演示账号。仅本地开发启用，关闭时不返回任何凭据。
export type DemoAccountDto =
  | { enabled: false }
  | { enabled: true; email: string; password: string };

export type HealthDto = {
  status: "ok";
  uptimeSec: number;
  version: string;
};

export type ReadyDto = {
  status: "ready" | "starting";
  checks: { database: "ok" | "fail" };
};

export type ChatListItem = {
  id: string;
  preview: string;
};

// 网页端加载历史时只取需要展示的角色与正文，tool 调用过程不在界面呈现。
export type ChatMessageDto = {
  role: "user" | "assistant";
  content: string;
};

export type ChatHistoryDto = {
  chatId: string;
  messages: ChatMessageDto[];
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

// SSE 事件负载。token 是增量文本，done 给出可直接落库的完整回复。
export type StreamEvent =
  | { event: "chat"; data: { chatId: string } }
  | { event: "token"; data: { seq: number; text: string } }
  | { event: "summarize"; data: { text: string } }
  | { event: "done"; data: { seq: number; text: string } }
  | { event: "error"; data: { seq: number; message: string } };
