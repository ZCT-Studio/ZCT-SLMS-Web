import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "./Extras";
import { CustomSelect } from "./Select";
import { authenticateFactors, performPasskey, useHuman } from "./Security";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
type Session = {
  token: string;
  username: string;
  user_type: string;
  user_id: number;
};
const labels: Record<string, string> = {
  password: "密码",
  totp: "动态令牌",
  passkey: "通行密钥",
  email: "邮箱验证码",
  phone: "手机验证码",
  github: "GitHub",
  microsoft: "微软账号",
  recovery: "恢复码",
};
export function storeSession(s: Session) {
  sessionStorage.setItem("tcv-session", JSON.stringify(s));
  let accounts: Session[] = [];
  try {
    accounts = JSON.parse(sessionStorage.getItem("tcv-accounts") || "[]");
  } catch {}
  sessionStorage.setItem(
    "tcv-accounts",
    JSON.stringify([
      ...accounts.filter(
        (a) => a.user_type !== s.user_type || a.user_id !== s.user_id,
      ),
      s,
    ]),
  );
}
export function PrimaryLogin({
  api,
  role,
  human,
  onLogin,
}: {
  api: Api;
  role: string;
  human: ReturnType<typeof useHuman>;
  onLogin: (s: Session) => void;
}) {
  const [method, setMethod] = useState("password"),
    [username, setUsername] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          setBusy(true);
          setError("");
          let result: Session;
          if (method === "password")
            result = await api<Session>(
              `auth/${role}/login`,
              {
                username,
                password: String(f.get("password")),
                ...human.fields,
              },
              "POST",
            );
          else if (method === "totp")
            result = await api<Session>(
              "auth/factors/primary",
              {
                username,
                role,
                method,
                code: String(f.get("code")),
                ...human.fields,
              },
              "POST",
            );
          else {
            const start = await api<any>(
              "auth/factors/passkey/start",
              { username, role, ...human.fields },
              "POST",
            );
            const credential = await performPasskey(start.public_key);
            result = await api<Session>(
              "auth/factors/primary",
              { method, challenge_id: start.challenge_id, credential },
              "POST",
            );
          }
          const session = await authenticateFactors(api, result);
          storeSession(session);
          onLogin(session);
        } catch (x) {
          setError((x as Error).message);
        } finally {
          setBusy(false);
          human.reset();
        }
      }}
    >
      <div className="login-methods">
        {["password", "passkey", "totp"].map((k) => (
          <button
            type="button"
            key={k}
            className={method === k ? "active" : ""}
            onClick={() => {
              setMethod(k);
              setError("");
            }}
          >
            {labels[k]}登录
          </button>
        ))}
      </div>
      <label>
        用户名
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          placeholder="输入用户名"
          required
        />
      </label>
      {method === "password" && (
        <label>
          密码
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="输入密码"
            required
          />
        </label>
      )}
      {method === "totp" && (
        <label>
          动态验证码
          <input
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
          />
        </label>
      )}
      {method === "passkey" && (
        <p className="muted">使用已绑定的通行密钥确认身份，无需输入密码。</p>
      )}
      {human.widget}
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button
          className="primary login-button"
          disabled={busy || !human.ready}
        >
          {busy ? "验证中…" : `使用${labels[method]}登录`}
        </button>
      </div>
      <a className="forgot-link" href="/forgot-password">
        忘记密码？
      </a>
    </form>
  );
}
type MfaRequest = {
  api: Api;
  data: any;
  resolve: (s: any) => void;
  reject: (e: Error) => void;
};
export function MfaDialog() {
  const [flow, setFlow] = useState<MfaRequest | null>(null),
    [method, setMethod] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [challenge, setChallenge] = useState(""),
    [cooldown, setCooldown] = useState(0),
    active = useRef<MfaRequest | null>(null);
  useEffect(() => {
    const f = (e: Event) => {
      const next = (e as CustomEvent<MfaRequest>).detail;
      active.current?.reject(new Error("验证已取消"));
      active.current = next;
      setFlow(next);
      setMethod(next.data.methods?.[0] || "recovery");
      setError("");
      setChallenge("");
      setCooldown(0);
      setBusy(false);
    };
    window.addEventListener("tcv:mfa", f);
    return () => window.removeEventListener("tcv:mfa", f);
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  if (!flow) return null;
  const close = () => {
    if (busy) return;
    flow.reject(new Error("验证已取消"));
    active.current = null;
    setFlow(null);
  };
  return (
    <Dialog title="验证第二种登录方式" close={close}>
      <p className="muted">
        已通过{labels[flow.data.primary_method] || "一种方式"}
        验证，请再选择另一种已绑定的方式。
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            setBusy(true);
            setError("");
            if (method === "github" || method === "microsoft") {
              const start = await flow.api<any>(
                "auth/factors/oauth/start",
                {
                  action: "mfa",
                  challenge_id: flow.data.challenge_id,
                  provider: method,
                },
                "POST",
              );
              window.location.assign(start.url);
              return;
            }
            const credential =
              method === "passkey"
                ? await performPasskey(flow.data.public_key)
                : undefined;
            const result = await flow.api<Session>(
              "auth/factors/verify",
              {
                method,
                challenge_id: flow.data.challenge_id,
                credential,
                code_challenge_id: challenge,
                code: String(f.get("code") || ""),
                recovery_code: String(f.get("recovery") || ""),
              },
              "POST",
            );
            if (active.current !== flow) return;
            flow.resolve(result);
            active.current = null;
            setFlow(null);
          } catch (x) {
            if (active.current === flow) setError((x as Error).message);
          } finally {
            if (active.current === flow) setBusy(false);
          }
        }}
      >
        <label>
          验证方式
          <CustomSelect
            value={method}
            onChange={(v) => {
              setMethod(v);
              setChallenge("");
              setError("");
            }}
            options={[
              ...(flow.data.methods || []),
              ...(flow.data.recovery_available ? ["recovery"] : []),
            ].map((value) => ({ value, label: labels[value] || value }))}
          />
        </label>
        {["totp", "email", "phone"].includes(method) && (
          <label>
            验证码
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
          </label>
        )}
        {["email", "phone"].includes(method) && (
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy || cooldown > 0}
              onClick={async () => {
                try {
                  setBusy(true);
                  setError("");
                  const r = await flow.api<any>(
                    "auth/factors/code",
                    { challenge_id: flow.data.challenge_id, method },
                    "POST",
                  );
                  setChallenge(r.code_challenge_id);
                  setCooldown(60);
                } catch (x) {
                  setError((x as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {cooldown ? `${cooldown} 秒后重发` : "发送验证码"}
            </button>
          </div>
        )}
        {method === "recovery" && (
          <label>
            一次性恢复码
            <input name="recovery" autoComplete="off" required />
          </label>
        )}
        {method === "password" && (
          <p className="muted">点击验证后输入当前账号密码。</p>
        )}
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button
            className="secondary"
            type="button"
            onClick={close}
            disabled={busy}
          >
            取消
          </button>
          <button
            className="primary"
            disabled={
              busy || (["email", "phone"].includes(method) && !challenge)
            }
          >
            {busy ? "验证中…" : "验证并登录"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function OnboardingGate({
  api,
  session,
  onLogout,
  children,
}: {
  api: Api;
  session: Session;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const qc = useQueryClient(),
    q = useQuery({
      queryKey: ["onboarding", session.user_type, session.user_id],
      queryFn: () =>
        api<{ required: boolean; initial_admin: boolean }>("auth/onboarding"),
      retry: false,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.data?.required) history.replaceState(null, "", "/set-password");
    else if (
      q.data &&
      !q.data.required &&
      location.pathname === "/set-password"
    )
      history.replaceState(null, "", "/");
  }, [q.data]);
  if (q.isPending || q.isError)
    return (
      <div className="login-page">
        <section className="login-card">
          <h2>账号安全检查</h2>
          <p className="muted">
            {q.isPending ? "正在检查账号状态…" : (q.error as Error).message}
          </p>
          {q.isError && (
            <div className="form-actions">
              <button className="secondary" onClick={() => q.refetch()}>
                重试
              </button>
              <button
                className="primary"
                onClick={() => {
                  sessionStorage.removeItem("tcv-session");
                  onLogout();
                }}
              >
                返回登录
              </button>
            </div>
          )}
        </section>
      </div>
    );
  if (!q.data?.required) return <>{children}</>;
  return (
    <div className="login-page">
      <section className="login-card">
        <h1>为了您的账号安全请设置新的密码</h1>
        <p className="muted">
          临时密码仅用于恢复访问，设置新密码后再进入控制台。
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              password = String(f.get("password"));
            if (password !== String(f.get("confirm"))) {
              setError("两次输入的密码不一致");
              return;
            }
            try {
              setBusy(true);
              setError("");
              await api(
                "auth/onboarding",
                {
                  new_password: password,
                  username: String(f.get("username") || ""),
                  nickname: String(f.get("nickname") || ""),
                },
                "POST",
              );
              sessionStorage.removeItem("tcv-session");
              let all: Session[] = [];
              try {
                all = JSON.parse(
                  sessionStorage.getItem("tcv-accounts") || "[]",
                );
              } catch {}
              sessionStorage.setItem(
                "tcv-accounts",
                JSON.stringify(
                  all.filter(
                    (s) =>
                      s.user_type !== session.user_type ||
                      s.user_id !== session.user_id,
                  ),
                ),
              );
              qc.clear();
              history.replaceState(null, "", "/");
              window.dispatchEvent(
                new CustomEvent("tcv:success", {
                  detail: "新密码已设置，请重新登录",
                }),
              );
              onLogout();
            } catch (x) {
              setError((x as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {q.data.initial_admin && (
            <>
              <label>
                新用户名
                <input
                  name="username"
                  minLength={3}
                  maxLength={64}
                  pattern="[A-Za-z0-9_.-]{3,64}"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                昵称
                <input name="nickname" maxLength={48} required />
              </label>
            </>
          )}
          <label>
            新密码
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={256}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            确认新密码
            <input
              name="confirm"
              type="password"
              minLength={12}
              maxLength={256}
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="primary" disabled={busy}>
              {busy ? "保存中…" : "保存新密码"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export function SecondMethodBanner({ api }: { api: Api }) {
  const q = useQuery({
    queryKey: ["factor-status"],
    queryFn: () => api<{ needs_second_method: boolean }>("auth/factors/status"),
  });
  return q.data?.needs_second_method ? (
    <div className="security-banner">
      <strong>请添加第二种登录方式</strong>
      <span>
        平台已开启
        2FA，你目前仅有一种可用方式。请绑定动态令牌、通行密钥或其他身份。
      </span>
      <a className="secondary" href="/account">
        前往账号设置
      </a>
    </div>
  ) : null;
}
