import OpenAI from "openai";
import { config } from "../config/env";

declare module "openai/resources/chat/completions/completions" {
  interface ChatCompletionCreateParamsBase {
    thinking?: { type: "enabled" | "disabled" };
  }
}




export type Message = OpenAI.Chat.ChatCompletionMessageParam;
export type ToolDefinition = OpenAI.Chat.ChatCompletionFunctionTool;

// deepseek 为什么是 openai?  openai定义了一套 llm 的交互标准 然后 deepseek实现了这套标准
const client = new OpenAI({
  apiKey: config.deepseekApiKey,
  baseURL: "https://api.deepseek.com", // 是 deepseek 的地址
});

export async function callModel(
  messages: Message[],
  tools?: ToolDefinition[],
  onDelta?: (text: string) => void | Promise<void>,
) {
  const request = {
    model: "deepseek-flash", //调用的 llm 模型
    messages, // 刚刚那个数组 [{role: system, content: 提示词}, { role: user, content: 钟离的圣遗物搭配 }]
    tools,
    thinking: { type: "disabled" as const },
    stream: true as const,
    stream_options: { include_usage: true } // 在流式模式下统计对应的 token
  };
  // 就是在和 deepseek的 llm 交互
  const stream = await client.chat.completions.create(request); // 一条流 我们需要不断的去监听这个流送过来的内容块

  // 在单个请求中的变量存储信息
  // 一块一块的 content 交给调用方，拼进历史的必须是完整的一句话
  let currentFullContent = "" // 代表本次请求的 message 内容
  const currentFullToolsCall: { id: string; name: string; args: string }[] = []
  let finishReason: string | null = null

  for await (const streamContent of stream) {
    const choice = streamContent.choices[0]
    if (!choice) continue
    if (choice.finish_reason) finishReason = choice.finish_reason
    const delta = choice.delta
    if (!delta) continue

    if (delta.content) { // content必须有值， 没值的话就可能是 tool/call
      currentFullContent += delta.content
      // 等这条 token 写进 SSE 再读下一块，避免工具轮次多的时候正文被 done 冲掉
      await onDelta?.(delta.content)
    }

    // 我们还要考虑一个事情 就是 tools/call llm会指定调用某个 tool
    for (const toolcall of delta.tool_calls ?? []) {
      // get_characters get_char index 这个 index 表示是调用的哪个 tool
      const current = currentFullToolsCall[toolcall.index]
      if (current) { // 代表你不是第一块 get  _
        // 代表这一块已经在 toolcall 列表里存过了
        if (toolcall.id) current.id += toolcall.id
        if (toolcall.function?.name) current.name += toolcall.function.name
        if (toolcall.function?.arguments) current.args += toolcall.function.arguments
      } else {
        //如果是第一次遇到这一块呢？
        currentFullToolsCall[toolcall.index] = {
          id: toolcall.id ?? "",
          name: toolcall.function?.name ?? "",
          args: toolcall.function?.arguments ?? "",
        }
      }
    }

    // 拿到了完整 content 和完整 toolscalllist
  }

  // 返回的时候就要拼好整个结果对象
  const message = {
    role: "assistant" as const,
    content: currentFullContent || null,
    tool_calls: currentFullToolsCall.length ? currentFullToolsCall.map(cft => ({
      id: cft.id,
      type: "function" as const,
      function: { name: cft.name, arguments: cft.args }
    })) : undefined,
  }
  return { message, finishReason }
}