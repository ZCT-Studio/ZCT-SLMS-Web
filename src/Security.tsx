import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "./Extras";
import { CustomSelect, Toggle } from "./Select";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import "./Security.css";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const success = (detail: string) =>
  window.dispatchEvent(new CustomEvent("tcv:success", { detail }));
const decode = (s: string): ArrayBuffer =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  ).buffer;
const encode = (b: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
function options(pk: any, create = false) {
  const out = { ...pk, challenge: decode(pk.challenge) };
  if (create) out.user = { ...pk.user, id: decode(pk.user.id) };
  for (const k of ["allowCredentials", "excludeCredentials"])
    if (pk[k]) out[k] = pk[k].map((v: any) => ({ ...v, id: decode(v.id) }));
  return out;
}
function credential(c: PublicKeyCredential) {
  const r = c.response as AuthenticatorAttestationResponse &
    AuthenticatorAssertionResponse;
  return {
    id: c.id,
    type: c.type,
    response: {
      clientDataJSON: encode(r.clientDataJSON),
      ...(r.attestationObject
        ? { attestationObject: encode(r.attestationObject) }
        : {
            authenticatorData: encode(r.authenticatorData),
            signature: encode(r.signature),
            userHandle: r.userHandle ? encode(r.userHandle) : null,
          }),
    },
  };
}
export async function performPasskey(pk: any, create = false) {
  const c = (
    create
      ? await navigator.credentials.create({ publicKey: options(pk, true) })
      : await navigator.credentials.get({ publicKey: options(pk) })
  ) as PublicKeyCredential | null;
  if (!c) throw new Error("通行密钥验证已取消");
  return credential(c);
}
export function authenticateFactors<T>(api: Api, data: T): Promise<T> {
  if (!(data as any)?.mfa_required) return Promise.resolve(data);
  return new Promise((resolve, reject) =>
    window.dispatchEvent(
      new CustomEvent("tcv:mfa", { detail: { api, data, resolve, reject } }),
    ),
  );
}
export function MfaHost() {
  const generation = useRef(0);
  const [flow, setFlow] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [recover, setRecover] = useState(false);
  useEffect(() => {
    const f = (event: Event) => {
      generation.current++;
      const next = (event as CustomEvent).detail;
      setFlow((old: any) => {
        old?.reject(new Error("验证已取消"));
        return next;
      });
      setError("");
      setRecover(false);
      setBusy(false);
    };
    window.addEventListener("tcv:mfa", f);
    return () => window.removeEventListener("tcv:mfa", f);
  }, []);
  if (!flow) return null;
  const close = () => {
    generation.current++;
    flow.reject(new Error("验证已取消"));
    setFlow(null);
  };
  return (
    <Dialog title="双重验证" close={close}>
      <p className="muted">
        验证已绑定的安全方式后继续登录。挑战 3 分钟内有效。
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const version = generation.current;
          const f = new FormData(e.currentTarget);
          try {
            setBusy(true);
            setError("");
            let assertion;
            if (!recover && flow.data.passkey_required) {
              const c = (await navigator.credentials.get({
                publicKey: options(flow.data.public_key),
              })) as PublicKeyCredential | null;
              if (!c) throw new Error("通行密钥验证已取消");
              assertion = credential(c);
            }
            if (version !== generation.current) return;
            const result = await flow.api(
              "auth/factors/verify",
              {
                challenge_id: flow.data.challenge_id,
                code: String(f.get("code") || ""),
                recovery_code: recover ? String(f.get("recovery") || "") : "",
                credential: assertion,
              },
              "POST",
            );
            if (version !== generation.current) return;
            flow.resolve(result);
            setFlow(null);
          } catch (x) {
            if (version === generation.current) setError((x as Error).message);
          } finally {
            if (version === generation.current) setBusy(false);
          }
        }}
      >
        {recover ? (
          <label>
            一次性恢复码
            <input name="recovery" autoComplete="off" required />
          </label>
        ) : (
          <>
            {flow.data.totp_required && (
              <label>
                动态令牌验证码
                <input
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  required
                  autoFocus
                />
              </label>
            )}
            {flow.data.passkey_required && (
              <p className="muted">
                点击验证后，使用设备上的通行密钥确认身份。
              </p>
            )}
          </>
        )}
        {error && <p className="error">{error}</p>}
        <div className="app-card-actions">
          <button
            className="secondary"
            type="button"
            disabled={busy}
            onClick={() => setRecover(!recover)}
          >
            {recover ? "返回双重验证" : "使用恢复码"}
          </button>
          <button className="primary" disabled={busy}>
            <ShieldCheck size={16} />
            {busy ? "验证中…" : "验证并登录"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
let scripts: Record<string, Promise<void> | undefined> = {};
function widgetScript(provider: string) {
  if (scripts[provider]) return scripts[provider];
  const url =
    provider === "recaptcha"
      ? "https://www.google.com/recaptcha/api.js?render=explicit"
      : provider === "hcaptcha"
        ? "https://js.hcaptcha.com/1/api.js?render=explicit"
        : "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  scripts[provider] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      delete scripts[provider];
      reject(new Error("人机验证加载失败，请检查网络后刷新"));
    };
    document.head.appendChild(s);
  });
  return scripts[provider];
}
function ProviderWidget({
  provider,
  siteKey,
  onToken,
}: {
  provider: string;
  siteKey: string;
  onToken: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    callback = useRef(onToken);
  callback.current = onToken;
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      id: any,
      api: any;
    setError("");
    widgetScript(provider)
      .then(() => {
        if (!active || !ref.current) return;
        api = (window as any)[
          provider === "recaptcha"
            ? "grecaptcha"
            : provider === "hcaptcha"
              ? "hcaptcha"
              : "turnstile"
        ];
        const render = () => {
          if (!active || !ref.current) return;
          id = api.render(ref.current, {
            sitekey: siteKey,
            callback: (token: string) => callback.current(token),
            "expired-callback": () => callback.current(""),
            "error-callback": () => {
              callback.current("");
              setError("验证失败，请刷新重试");
            },
            theme: "light",
          });
        };
        if (api.ready) api.ready(render);
        else render();
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
      callback.current("");
      if (id !== undefined) {
        try {
          if (api.remove) api.remove(id);
          else api.reset(id);
        } catch {}
      }
    };
  }, [provider, siteKey]);
  return (
    <>
      <div ref={ref} />
      {error && <p className="error">{error}</p>}
    </>
  );
}
export function useHuman(api: Api, enabled = true) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [answer, setAnswer] = useState(""),
    [token, setToken] = useState("");
  const reset = () => {
    setAnswer("");
    setToken("");
    setRevision((v) => v + 1);
  };
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setData(null);
    setError("");
    api<any>("auth/captcha")
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [revision, enabled]);
  const fields = {
    captcha_id: data?.challenge_id || "",
    captcha_answer: answer,
    captcha_token: token,
  };
  const widget = error ? (
    <div className="human-check">
      <p className="error">{error}</p>
      <button type="button" className="secondary" onClick={reset}>
        重试
      </button>
    </div>
  ) : !data ? (
    <p className="muted">正在加载验证配置…</p>
  ) : data.provider === "none" ? null : (
    <div className="human-check">
      <div className="inline-actions">
        <strong>人机验证</strong>
        <button
          className="icon-button"
          type="button"
          aria-label="刷新人机验证"
          onClick={reset}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {data.provider === "static" ? (
        <label>
          {data.image ? (
            <img
              className="captcha-image"
              src={data.image}
              alt="请输入图片中的字符"
            />
          ) : (
            <span className="captcha-question">{data.question}</span>
          )}
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="输入答案（区分大小写）"
            autoComplete="off"
          />
        </label>
      ) : (
        <ProviderWidget
          key={revision}
          provider={data.provider}
          siteKey={data.site_key}
          onToken={setToken}
        />
      )}
    </div>
  );
  return {
    fields,
    widget,
    reset,
    ready:
      !!data &&
      !error &&
      (data.provider === "none" ||
        (data.provider === "static" ? !!answer : !!token)),
  };
}
export function FactorAdmin({ api, tab }: { api: Api; tab: string }) {
  const qc = useQueryClient(),
    q = useQuery({
      queryKey: ["factor-settings"],
      queryFn: () => api<any>("admin/factors/settings"),
    });
  const [draft, setDraft] = useState<any>({}),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.data) setDraft({ ...q.data });
  }, [q.data]);
  const set = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));
  return (
    <section className="panel management-card">
      <h2>{tab === "2fa" ? "双重验证" : "人机验证"}</h2>
      {q.isError && <p className="error">{(q.error as Error).message}</p>}
      {tab === "2fa" ? (
        <>
          <p className="muted">
            开启 2FA
            后，已绑定至少两种方式的账号每次需验证两种；只有一种方式的账号可先登录，并提示添加第二种。下方开关控制新绑定入口。
          </p>
          {[
            ["two_factor_enabled", "开启 2FA（每次至少验证两种登录方式）"],
            ["totp_enabled", "允许绑定动态令牌"],
            ["passkey_enabled", "允许绑定通行密钥"],
          ].map(([k, label]) => (
            <div className="setting-row" key={k}>
              <strong>{label}</strong>
              <Toggle
                label={label}
                checked={!!draft[k]}
                onChange={(v) => set(k, v)}
              />
            </div>
          ))}
          <p className="muted">
            通行密钥需要先在注册登录配置中填写本站公开地址，生产环境使用
            HTTPS。动态令牌兼容常见 TOTP 验证器。
          </p>
        </>
      ) : (
        <>
          <label>
            验证方式
            <CustomSelect
              value={draft.captcha_provider || "none"}
              onChange={(v) => set("captcha_provider", v)}
              options={[
                { value: "none", label: "不启用（默认）" },
                { value: "static", label: "静态题" },
                { value: "recaptcha", label: "reCAPTCHA v2" },
                { value: "hcaptcha", label: "hCaptcha" },
                { value: "turnstile", label: "Cloudflare Turnstile" },
              ]}
            />
          </label>
          {draft.captcha_provider === "static" ? (
            <>
              <p className="muted">
                题目图片可以是算术题、字符题或其他内容，答案由你决定。图片放在
                Core 工作目录 captcha/static/，同目录 answer.json 格式为{" "}
                {`{"example.png":"你的答案"}`}
                。答案区分大小写，答案文件禁止公开访问。
              </p>
            </>
          ) : draft.captcha_provider && draft.captcha_provider !== "none" ? (
            <>
              {[
                ["captcha_site_key", "Site Key"],
                ["captcha_secret", "Secret Key"],
                ["captcha_hostname", "本站主机名（不含协议和端口）"],
              ].map(([k, label]) => (
                <label key={k}>
                  {label}
                  <input
                    type={k === "captcha_secret" ? "password" : "text"}
                    value={draft[k] || ""}
                    placeholder={
                      k === "captcha_secret" && draft.captcha_secret_configured
                        ? "已保存，留空保留"
                        : ""
                    }
                    onChange={(e) => set(k, e.target.value)}
                  />
                </label>
              ))}
            </>
          ) : null}
          <p className="muted">
            应用于用户、管理员、子用户密码登录，以及验证码发送和第三方登录入口。
          </p>
        </>
      )}
      <button
        className="primary"
        disabled={!q.data}
        onClick={() => {
          setError("");
          setConfirm(true);
        }}
      >
        保存设置
      </button>
      {confirm && (
        <Dialog title="验证管理员身份" close={() => setConfirm(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api(
                  "admin/factors/settings",
                  {
                    ...draft,
                    ...(tab==="captcha"&&draft.captcha_provider==="static"?{static_mode:"image"}:{}),
                    current_password: String(
                      new FormData(e.currentTarget).get("password"),
                    ),
                  },
                  "POST",
                );
                await qc.invalidateQueries({ queryKey: ["factor-settings"] });
                setConfirm(false);
                success("安全配置已保存");
              } catch (x) {
                setError((x as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              当前管理员密码
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={busy}>
              {busy ? "保存中…" : "确认保存"}
            </button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
export function AccountFactors({ api }: { api: Api }) {
  const qc = useQueryClient(),
    q = useQuery({
      queryKey: ["account-factors"],
      queryFn: () => api<any>("auth/factors"),
    });
  const [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [recovery, setRecovery] = useState(""),
    [setup, setSetup] = useState<any>(null),
    [codes, setCodes] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState("");
  async function act(action: string, extra: Record<string, any> = {}) {
    setBusy(true);
    setError("");
    try {
      const result = await api<any>(
        "auth/factors",
        { action, password, code, recovery_code: recovery, ...extra },
        "POST",
      );
      if (result.recovery_codes) setCodes(result.recovery_codes);
      setCode("");
      setRecovery("");
      await qc.invalidateQueries({ queryKey: ["account-factors"] });
      if (
        [
          "totp-disable",
          "passkey-require",
          "passkey-remove",
          "recovery-regenerate",
        ].includes(action)
      )
        success("账号安全设置已更新");
      return result;
    } catch (x) {
      setError((x as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-security">
      <h3>
        <ShieldCheck size={17} /> 账号安全
      </h3>
      {q.isError && <p className="error">{(q.error as Error).message}</p>}
      {q.data && (
        <>
          <p className="muted">
            动态令牌和通行密钥都启用时，登录需要同时验证。恢复码可用于一次紧急登录，请离线保存。
          </p>
          <label>
            当前账号密码
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            动态验证码
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
            />
          </label>
          <label>
            恢复码（紧急恢复或解除通行密钥时使用）
            <input
              value={recovery}
              onChange={(e) => setRecovery(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="setting-row">
            <strong>动态令牌</strong>
            <span>{q.data.totp_enabled ? "已开启" : "未开启"}</span>
          </div>
          <div className="app-card-actions">
            {q.data.totp_enabled ? (
              <button
                className="secondary"
                disabled={busy || !password}
                onClick={() => act("totp-disable")}
              >
                解除动态令牌
              </button>
            ) : (
              q.data.totp_available && (
                <button
                  className="secondary"
                  disabled={busy || !password}
                  onClick={async () => {
                    const d = await act("totp-start");
                    if (d) setSetup(d);
                  }}
                >
                  绑定动态令牌
                </button>
              )
            )}
          </div>
          {setup && (
            <div className="factor-enrollment">
              <p>在验证器中手动添加账号，输入以下密钥（TOTP，6 位，30 秒）：</p>
              <code className="sensitive-value">{setup.secret}</code>
              <p className="muted">输入验证器生成的验证码，5 分钟内确认。</p>
              <button
                className="primary"
                disabled={busy || !code || !password}
                onClick={async () => {
                  const d = await act("totp-confirm");
                  if (d) {
                    setSetup(null);
                    success("动态令牌已启用");
                  }
                }}
              >
                确认绑定
              </button>
            </div>
          )}
          <div className="setting-row">
            <strong>登录时要求通行密钥</strong>
            <Toggle
              label="要求通行密钥"
              checked={!!q.data.passkey_required}
              disabled={
                busy ||
                !password ||
                (!q.data.passkey_required && !q.data.keys?.length)
              }
              onChange={(v) =>
                act("passkey-require", { enabled: v ? "1" : "0" })
              }
            />
          </div>
          <div className="passkey-list">
            {q.data.keys?.map((k: any) => (
              <div className="setting-row" key={k.id}>
                <span>
                  <KeyRound size={15} /> {k.name}
                </span>
                <button
                  className="secondary"
                  disabled={busy || !password || !recovery}
                  onClick={() => act("passkey-remove", { id: k.id })}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
          {q.data.passkey_available && (
            <>
              <label>
                通行密钥名称
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：我的电脑"
                  maxLength={48}
                />
              </label>
              <button
                className="secondary"
                disabled={busy || !password || !window.PublicKeyCredential}
                onClick={async () => {
                  const start = await act("passkey-start");
                  if (!start) return;
                  setBusy(true);
                  try {
                    const c = (await navigator.credentials.create({
                      publicKey: options(start.public_key, true),
                    })) as PublicKeyCredential | null;
                    if (!c) throw new Error("通行密钥创建已取消");
                    const d = await act("passkey-confirm", {
                      challenge_id: start.challenge_id,
                      credential: credential(c),
                      name: name || "我的通行密钥",
                    });
                    if (d) success("通行密钥已绑定");
                  } catch (x) {
                    setError((x as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                添加通行密钥
              </button>
              {!window.PublicKeyCredential && (
                <p className="muted">
                  当前浏览器环境不支持通行密钥，请使用 HTTPS 或 localhost。
                </p>
              )}
            </>
          )}
          <div className="setting-row">
            <span>剩余恢复码：{q.data.recovery_remaining}</span>
            <button
              className="secondary"
              disabled={busy || !password || (!code && !recovery)}
              onClick={() => act("recovery-regenerate")}
            >
              重新生成恢复码
            </button>
          </div>
        </>
      )}
      {error && <p className="error">{error}</p>}
      {codes.length > 0 && (
        <Dialog title="请保存一次性恢复码" close={() => setCodes([])}>
          <p className="muted">
            关闭后不再展示。这次生成会替换旧恢复码，每个只能使用一次。
          </p>
          <pre className="result">{codes.join("\n")}</pre>
          <button className="primary" onClick={() => setCodes([])}>
            我已妥善保存
          </button>
        </Dialog>
      )}
    </section>
  );
}
