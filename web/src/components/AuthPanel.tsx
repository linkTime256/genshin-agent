import { useEffect, useState, type FormEvent } from "react";
import type { DemoAccountDto, SessionUser } from "../../../shared/contracts";
import { api } from "../api/client";

type Props = { onAuthenticated: (user: SessionUser) => void };

export default function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoAccountDto | null>(null);

  // 服务端启用默认演示用户时，登录页给出一键入口；关闭时这个卡片不出现。
  useEffect(() => {
    let alive = true;
    api.demoAccount()
      .then((result) => { if (alive) setDemo(result); })
      .catch(() => { /* 拿不到演示账号不影响正常登录 */ });
    return () => { alive = false; };
  }, []);

  async function signInWith(emailValue: string, passwordValue: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.signIn(emailValue, passwordValue);
      onAuthenticated(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (mode === "register" && name.trim().length === 0) {
      setError("请填写昵称");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (mode === "login") {
      await signInWith(email.trim(), password);
      return;
    }
    setBusy(true);
    try {
      const result = await api.signUp(name.trim(), email.trim(), password);
      onAuthenticated(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  function useDemoAccount() {
    if (!demo?.enabled || busy) return;
    setMode("login");
    setEmail(demo.email);
    setPassword(demo.password);
    void signInWith(demo.email, demo.password);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-mark">✦</span>
          <div>
            <h1>原神小助手</h1>
            <p>角色图鉴 · 装备资料 · AI 对话</p>
          </div>
        </div>

        <div className="segmented">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => { setMode("login"); setError(null); }}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => { setMode("register"); setError(null); }}
          >
            注册
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label>
              昵称
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="怎么称呼你"
                autoComplete="nickname"
              />
            </label>
          )}
          <label>
            邮箱
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}

          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "处理中…" : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </form>

        {demo?.enabled && (
          <div className="demo-account">
            <div>
              <strong>默认演示账号</strong>
              <span>{demo.email} / {demo.password}</span>
            </div>
            <button type="button" onClick={useDemoAccount} disabled={busy}>一键登录</button>
          </div>
        )}

        <p className="auth-hint">会话由服务端 Cookie 保存，页面不会把令牌写进本地存储。</p>
      </div>
    </div>
  );
}
