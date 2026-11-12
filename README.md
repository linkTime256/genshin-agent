# genshin-agent

Agent 开发课程基础篇 Demo：原神小助手。

课程视频：[Bilibili](https://www.bilibili.com/video/BV1MGnB63Eib/)

## 准备

1. 安装 [Bun](https://bun.sh)。
2. 安装依赖：

   ```bash
   bun install
   ```

3. 复制 `.env.example` 为 `.env`，填入 DeepSeek API Key 和 `BETTER_AUTH_SECRET`。

## 运行（网页版）

先构建一次前端，再启动服务；前后端同源，一个地址就够了：

```bash
bun run build:web
bun start
```

打开 `http://127.0.0.1:3000`。首次使用点「注册」（密码至少 8 位），登录后即可：

- **对话**：多会话切换、SSE 逐字流式回复、切换聊天自动加载历史。
- **角色图鉴**：按名字/元素/星级筛选，详情里看星级、元素、武器类型、推荐武器与圣遗物套装效果。
- **武器 / 圣遗物**：独立目录页，可从角色详情跳转。
- **联动**：图鉴里点「问一下助手」会自动把问题发进对话；对话中提到的角色会出现在右侧快捷入口，点一下回到图鉴。

改前端代码时用开发模式（后端 3000 + Vite 5173，Vite 自动代理 API）：

```bash
bun run dev
```

然后打开 `http://127.0.0.1:5180`。`bun run dev` 会同时起后端和 Vite，所以用它时不要再单独跑 `bun start`；也可以只跑 `bun run dev:web`，但要先在另一个终端跑 `bun start`。

类型检查与构建：

```bash
bun run typecheck        # 后端 + 共享契约
bun run typecheck:web    # 前端
bun run build:web        # 产物写到 web/dist
```

## 运行（控制台版）

服务端：

```bash
bun start
```

客户端另开一个终端：

```bash
bun run client
```

先输入 `login` 或 `register`。`register` 要 name、email、password。`login` 要 email、password。密码至少 8 位。

登录后直接说话会新建聊天。`/chats` 看已有聊天，`/use 聊天id` 接上，`/new` 换一个，`exit` 退出。

用户、登录 token 和聊天记录在项目根目录的 `agent.sqlite`。服务端重启后要重新登录，聊天还在。每一轮的用户消息、工具调用、查库结果和最终回复各占一行，追加到项目根目录的 `log.txt`。

## 手稿

第 1 节到目前最新一节的 Excalidraw 手稿在仓库根目录的 `drawings/`。

第 1 到第 5 节，以及生产缺口那一份，来自 Obsidian 库 `orbitproxy/Excalidraw`。最后一份服务端和客户端手稿在课程目录 `drafts/genshin-gap/server-client.excalidraw`。

| 文件 | 来源 | 内容 |
|---|---|---|
| `drawings/lesson-1.excalidraw` | `agent-dev-lesson-1.excalidraw` | 第 1 节 |
| `drawings/lesson-2.excalidraw` | `agent-dev-lesson-2.excalidraw` | 第 2 节 |
| `drawings/lesson-3.excalidraw` | `agent-dev-lesson-3.excalidraw` | 第 3 节。这一节只画了开场的「01 课程目标」 |
| `drawings/lesson-4.excalidraw` | `agent-dev-lesson-4 5.excalidraw` | 第 4 节 |
| `drawings/lesson-5.excalidraw` | `agent-dev-lesson-5 3.excalidraw` | 第 5 节 |
| `drawings/genshin-agent-gap.excalidraw` | `genshin-agent-gap 12.excalidraw` | 离生产闭环还差什么 |
| `drawings/server-client.excalidraw` | `drafts/genshin-gap/server-client.excalidraw` | 服务端和客户端。两种架构、SSE、一次对话怎么走、每个文件做什么 |
| `drawings/persistence.excalidraw` | `persistence 2.excalidraw` | 持久化。内存和硬盘、SQLite、Drizzle |
| `drawings/sampling.excalidraw` | `sampling 4.excalidraw` | 采样和思考。温度、草稿、档位 |

用 VS Code 的 Excalidraw 插件打开，步骤和截图见 [drawings/README.md](drawings/README.md)。

## 目录结构

```
shared/contracts.ts         # 前后端共享的 DTO 类型
src/
├── index.ts                # 启动 HTTP 服务
├── config/env.ts           # 环境变量集中读取与启动校验
├── client.ts               # 控制台测试客户端：注册、登录、发消息
├── domain/errors.ts        # 类型化领域错误
├── db/                     # SQLite 和 Drizzle 表；seed.ts 预置图鉴示例数据
├── http/
│   ├── server.ts           # 路由、SSE、静态托管、健康检查、优雅停机
│   ├── middleware.ts       # 请求 ID、结构化日志、安全头
│   ├── errors.ts           # 全局错误处理与规范化错误响应
│   └── routes/catalog.ts   # 图鉴 REST 控制器
├── services/               # 业务逻辑（不依赖 HTTP 类型）
├── repositories/           # 数据查询（避免 N+1）
├── auth/                   # Better Auth：用户和登录 token
├── chats/                  # 聊天、消息，以及一轮对话
├── agents/                 # 回答方式
│   ├── chat.ts             #   普通对话：调一次模型就结束
│   └── tool-agent.ts       #   Agent：模型要用工具就执行，直到它直接回答
├── models/
│   └── deepseek.ts         # 模型客户端：调用 DeepSeek
├── prompts/
│   └── system.ts           # 系统提示词
├── tools/
│   ├── index.ts            # 工具注册：汇总所有工具，按名字执行
│   └── get-character.ts    # 查角色资料
└── utils/
    └── logger.ts           # 写 log.txt
web/                        # React + Vite 前端
├── index.html
├── vite.config.ts          # 开发代理 + 构建到 web/dist
└── src/
    ├── api/client.ts       # 类型化 fetch 封装、错误映射、SSE 解析
    ├── components/         # 认证、对话、图鉴、武器与圣遗物页面
    └── constants.ts        # 元素 / 武器类型中文映射
```

新加工具：在 `tools/` 里加一个文件，导出 `definition` 和 `run`，再登记到 `tools/index.ts`。
