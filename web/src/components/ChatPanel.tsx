import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CharacterSummary,
  ChatListItem,
  ChatMessageDto,
  StreamEvent,
} from "../../../shared/contracts";
import { api, streamMessage } from "../api/client";
import { elementColor, elementLabel, stars } from "../constants";

type Props = {
  characters: CharacterSummary[];
  pendingQuestion: { text: string; nonce: number } | null;
  onQuestionConsumed: () => void;
  onOpenCharacter: (name: string) => void;
};

function appendDelta(list: ChatMessageDto[], delta: string): ChatMessageDto[] {
  const last = list[list.length - 1];
  if (last?.role === "assistant") {
    return [...list.slice(0, -1), { role: "assistant", content: last.content + delta }];
  }
  return [...list, { role: "assistant", content: delta }];
}

// done 事件带的是完整回复，用它覆盖增量拼接结果，避免流式结束后重复。
function finalize(list: ChatMessageDto[], full: string): ChatMessageDto[] {
  const last = list[list.length - 1];
  if (last?.role !== "assistant") return list;
  if (!full.trim()) return list.slice(0, -1);
  return [...list.slice(0, -1), { role: "assistant", content: full }];
}

export default function ChatPanel({ characters, pendingQuestion, onQuestionConsumed, onOpenCharacter }: Props) {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const refreshChats = useCallback(async () => {
    try {
      const result = await api.chats();
      setChats(result.chats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "会话列表加载失败");
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => { void refreshChats(); }, [refreshChats]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages]);

  async function selectChat(id: string) {
    if (streaming) return;
    setActiveId(id);
    setError(null);
    setNotice(null);
    try {
      const history = await api.history(id);
      setMessages(history.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "聊天记录加载失败");
      setMessages([]);
    }
  }

  function newChat() {
    if (streaming) return;
    setActiveId(null);
    setMessages([]);
    setInput("");
    setError(null);
    setNotice(null);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);
    setNotice(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamMessage(trimmed, activeId ?? undefined, (event: StreamEvent) => {
        switch (event.event) {
          case "chat": {
            const id = event.data.chatId;
            setActiveId(id);
            setChats((prev) => prev.some((item) => item.id === id)
              ? prev
              : [...prev, { id, preview: trimmed }]);
            break;
          }
          case "token":
            setMessages((prev) => appendDelta(prev, event.data.text));
            break;
          case "done":
            setMessages((prev) => finalize(prev, event.data.text));
            break;
          case "summarize":
            setNotice("对话较长，服务端已自动压缩历史上下文");
            break;
          case "error":
            setError(event.data.message || "这一轮回复出错了");
            break;
        }
      }, controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "发送失败");
        setMessages((prev) => finalize(prev, ""));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  // 图鉴里点「问一下助手」后自动发送一次；消费后清空，避免切换 Tab 时重复发。
  useEffect(() => {
    if (!pendingQuestion) return;
    void send(pendingQuestion.text);
    onQuestionConsumed();
    // send 是组件内函数，这里只按 nonce 触发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion?.nonce]);

  const mentioned = useMemo(() => {
    const text = messages.map((item) => item.content).join("\n");
    return characters.filter((item) => text.includes(item.name)).slice(0, 6);
  }, [messages, characters]);

  return (
    <div className="chat-layout">
      <aside className="side-panel">
        <div className="panel-title">会话</div>
        <button className="new-chat-button" onClick={newChat} disabled={streaming}>＋ 新建对话</button>
        {loadingChats && <p className="empty-hint">加载中…</p>}
        {!loadingChats && chats.length === 0 && <p className="empty-hint">还没有聊天，在下面直接说话就会新建一个。</p>}
        <div className="chat-list">
          {chats.map((item) => (
            <button
              key={item.id}
              className={`chat-item ${activeId === item.id ? "active" : ""}`}
              onClick={() => void selectChat(item.id)}
              disabled={streaming}
            >
              <span className="chat-preview">{item.preview || "（空对话）"}</span>
              <span className="chat-id">{item.id.slice(0, 8)}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-main">
        <div className="message-list">
          {messages.length === 0 && (
            <p className="empty-hint" style={{ textAlign: "center", marginTop: 40 }}>
              问点什么吧，比如「胡桃适合什么武器」。<br />回复会逐字流式显示。
            </p>
          )}
          {messages.map((item, index) => (
            <div key={index} className={`message ${item.role}`}>
              <span className="message-role">{item.role === "user" ? "你" : "原神小助手"}</span>
              <div className={`bubble ${streaming && index === messages.length - 1 && item.role === "assistant" ? "typing-dot" : ""}`}>
                {item.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="chat-error" role="alert">{error}</div>}

        <div className="composer">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="输入问题，Enter 发送，Shift + Enter 换行"
            maxLength={2000}
            disabled={streaming}
          />
          {streaming ? (
            <button className="stop-button" onClick={() => abortRef.current?.abort()}>停止</button>
          ) : (
            <button className="send-button" onClick={() => void send(input)} disabled={!input.trim()}>发送</button>
          )}
        </div>
      </section>

      <aside className="context-panel">
        <div className="panel-title">对话里提到的角色</div>
        {mentioned.length > 0 ? (
          mentioned.map((item) => (
            <button key={item.name} className="mini-character" onClick={() => onOpenCharacter(item.name)}>
              <span className="element-badge" style={{ background: elementColor(item.element) }}>
                {elementLabel(item.element)}
              </span>
              <span style={{ flex: 1 }}>
                <strong style={{ display: "block", fontSize: 13 }}>{item.name}</strong>
                <span className="rank-stars">{stars(item.rank)}</span>
              </span>
            </button>
          ))
        ) : (
          <>
            <p className="empty-hint">对话中提到角色名时，这里会出现快捷入口；也可以在图鉴里点「问一下助手」。</p>
            <div style={{ marginTop: 12 }}>
              {characters.slice(0, 4).map((item) => (
                <button key={item.name} className="mini-character" onClick={() => onOpenCharacter(item.name)}>
                  <span className="element-badge" style={{ background: elementColor(item.element) }}>
                    {elementLabel(item.element)}
                  </span>
                  <span style={{ flex: 1, fontSize: 13 }}>{item.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
