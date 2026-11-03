import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "./Extras";
import { CustomSelect, Toggle } from "./Select";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import "./styles/Security.css";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const success = (detail: string) =>
  window.dispatchEvent(new CustomEvent("zct_slms:success", { detail }));
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
      new CustomEvent("zct_slms:mfa", { detail: { api, data, resolve, reject } }),
    ),
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
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button
          className="primary"
          disabled={!q.data || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await api(
                "admin/factors/settings",
                {
                  ...draft,
                  ...(tab === "captcha" && draft.captcha_provider === "static"
                    ? { static_mode: "image" }
                    : {}),
                },
                "POST",
              );
              await qc.invalidateQueries({ queryKey: ["factor-settings"] });
              success("安全配置已保存");
            } catch (x) {
              if ((x as Error).message !== "操作已取消")
                setError((x as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "保存中…" : "保存设置"}
        </button>
      </div>
    </section>
  );
}
