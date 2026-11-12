import { useCallback, useEffect, useState } from "react";
import type { ArtifactDto, CharacterSummary, SessionUser, WeaponDto } from "../../shared/contracts";
import { api } from "./api/client";
import AuthPanel from "./components/AuthPanel";
import CatalogLists from "./components/CatalogLists";
import CharacterGallery from "./components/CharacterGallery";
import ChatPanel from "./components/ChatPanel";

type Tab = "chat" | "characters" | "weapons" | "artifacts";
type PendingQuestion = { text: string; nonce: number };

const TABS: { key: Tab; label: string }[] = [
  { key: "chat", label: "💬 对话" },
  { key: "characters", label: "✦ 角色图鉴" },
  { key: "weapons", label: "⚔ 武器" },
  { key: "artifacts", label: "◈ 圣遗物" },
];

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [weapons, setWeapons] = useState<WeaponDto[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactDto[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);

  // 刷新页面时靠服务端 Cookie 恢复会话，令牌不写入 localStorage。
  useEffect(() => {
    let alive = true;
    api.session()
      .then((result) => { if (alive) { setUser(result?.user ?? null); setChecking(false); } })
      .catch(() => { if (alive) { setUser(null); setChecking(false); } });
    return () => { alive = false; };
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const [c, w, a] = await Promise.all([api.characters(), api.weapons(), api.artifacts()]);
      setCharacters(c.items);
      setWeapons(w.items);
      setArtifacts(a.items);
      setSelectedCharacter((current) => current ?? c.items[0]?.name ?? null);
      setCatalogError(null);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "图鉴加载失败");
    }
  }, []);

  useEffect(() => { if (user) void loadCatalog(); }, [user, loadCatalog]);

  async function logout() {
    try { await api.signOut(); } catch { /* 退出失败也清掉本地视图 */ }
    setUser(null);
    setCharacters([]);
    setWeapons([]);
    setArtifacts([]);
    setSelectedCharacter(null);
    setPendingQuestion(null);
    setTab("chat");
  }

  function askAbout(name: string) {
    setPendingQuestion({
      text: `介绍一下${name}的星级、元素、武器类型，以及推荐的武器和圣遗物`,
      nonce: Date.now() + Math.random(),
    });
    setTab("chat");
  }

  function openCharacter(name: string) {
    setSelectedCharacter(name);
    setTab("characters");
  }

  if (checking) return <div className="loading-screen">正在连接服务…</div>;
  if (!user) return <AuthPanel onAuthenticated={setUser} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✦</span>原神小助手</div>
        <nav className="tabs">
          {TABS.map((item) => (
            <button
              key={item.key}
              className={`tab-button ${tab === item.key ? "active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="user-area">
          <span className="user-name">{user.name}</span>
          <button className="ghost-button" onClick={() => void logout()}>退出</button>
        </div>
      </header>

      <main className="content">
        {catalogError && (
          <div className="alert">
            <span>图鉴数据加载失败：{catalogError}</span>
            <button onClick={() => void loadCatalog()}>重试</button>
          </div>
        )}

        {tab === "chat" && (
          <ChatPanel
            characters={characters}
            pendingQuestion={pendingQuestion}
            onQuestionConsumed={() => setPendingQuestion(null)}
            onOpenCharacter={openCharacter}
          />
        )}
        {tab === "characters" && (
          <CharacterGallery
            characters={characters}
            selected={selectedCharacter}
            onSelect={setSelectedCharacter}
            onAsk={askAbout}
            onOpenWeapons={() => setTab("weapons")}
            onOpenArtifacts={() => setTab("artifacts")}
          />
        )}
        {tab === "weapons" && <CatalogLists kind="weapons" weapons={weapons} artifacts={artifacts} />}
        {tab === "artifacts" && <CatalogLists kind="artifacts" weapons={weapons} artifacts={artifacts} />}

        <p className="footer-note">图鉴为演示用示例数据，装备效果描述仅供界面展示，实际配装请以游戏内为准。</p>
      </main>
    </div>
  );
}
