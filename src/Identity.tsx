import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, CircleHelp } from "lucide-react";
import { CustomSelect, Toggle } from "./Select";
import { Dialog } from "./Extras";
import { authenticateFactors, useHuman } from "./Security";
import "./Identity.css";
import { InviteRegistration } from "./RecoveryPage";
type Api = <T>(
  path: string,
  params?: Record<string, any>,
  method?: string,
) => Promise<T>;
type Session = {
  token: string;
  username: string;
  user_type: string;
  user_id: number;
  force_setup?: boolean;
};
type Options = {
  registration_enabled: boolean;
  invite_registration_enabled?: boolean;
  phone_enabled: boolean;
  email_enabled: boolean;
  github_enabled: boolean;
  microsoft_enabled: boolean;
};
const labels: Record<string, string> = {
  phone: "手机号",
  email: "邮箱",
  microsoft: "微软账号",
  github: "GitHub",
};
const names: Record<string, string> = {
  public_url: "站点公开地址（如 https://verify.example.com）",
  smtp_host: "SMTP 主机",
  smtp_port: "SMTP 端口",
  smtp_username: "SMTP 用户名",
  smtp_password: "SMTP 密码或授权码",
  smtp_from: "发件人邮箱",
  aliyun_key: "AccessKey ID",
  aliyun_secret: "AccessKey Secret",
  aliyun_sign: "短信签名",
  aliyun_template: "验证码模板 Code（模板变量为 code）",
  aliyun_reset_template: "临时密码短信模板（变量为 password）",
  twilio_sid: "Account SID",
  twilio_token: "Auth Token",
  twilio_from: "发送号码（E.164）",
  github_client: "Client ID",
  github_secret: "Client Secret",
  microsoft_client: "Application Client ID",
  microsoft_secret: "Client Secret",
  microsoft_tenant: "Tenant（common / consumers / 租户 ID）",
};
export function rememberLogin(s: Session) {
  history.replaceState(null, "", "/");
  sessionStorage.setItem("tcv-session", JSON.stringify(s));
  let all: Session[] = [];
  try {
    all = JSON.parse(sessionStorage.getItem("tcv-accounts") || "[]");
  } catch {}
  sessionStorage.setItem(
    "tcv-accounts",
    JSON.stringify([
      ...all.filter(
        (a) => a.user_type !== s.user_type || a.user_id !== s.user_id,
      ),
      s,
    ]),
  );
}
export function IdentityAdmin({ api }: { api: Api }) {
  const [help, setHelp] = useState("");
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["identity-settings"],
    queryFn: () => api<Record<string, any>>("admin/identity/settings"),
  });
  const [draft, setDraft] = useState<Record<string, any>>({}),
    [dialog, setDialog] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState("");
  useEffect(() => {
    if (query.data) setDraft({ ...query.data });
  }, [query.data]);
  const close = () => {
    setDialog("");
    setPassword("");
    setError("");
    setDraft({ ...query.data });
  };
  const open = (v: string) => {
    setDialog(v);
    setPassword("");
    setError("");
  };
  const fields =
    dialog === "site"
      ? ["public_url"]
      : dialog === "email"
        ? [
            "smtp_host",
            "smtp_port",
            "smtp_username",
            "smtp_password",
            "smtp_from",
          ]
        : dialog === "phone"
          ? draft.sms_provider === "twilio"
            ? ["twilio_sid", "twilio_token", "twilio_from"]
            : [
                "aliyun_key",
                "aliyun_secret",
                "aliyun_sign",
                "aliyun_template",
                "aliyun_reset_template",
              ]
          : dialog === "github"
            ? ["public_url", "github_client", "github_secret"]
            : dialog === "microsoft"
              ? [
                  "public_url",
                  "microsoft_client",
                  "microsoft_secret",
                  "microsoft_tenant",
                ]
              : [];
  async function save() {
    try {
      setBusy(true);
      setError("");
      await api(
        "admin/identity/settings",
        { ...draft, current_password: password },
        "POST",
      );
      await qc.invalidateQueries({ queryKey: ["identity-settings"] });
      await qc.invalidateQueries({ queryKey: ["identity-options"] });
      close();
      window.dispatchEvent(
        new CustomEvent("tcv:success", { detail: "注册登录配置已保存" }),
      );
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel management-card identity-admin">
      <h2>注册登录</h2>
      <p className="muted">
        注册默认关闭。已绑定身份的用户可使用已开放的方式登录；新用户注册必须验证其中一种身份。
      </p>
      <div className="setting-row">
        <div>
          <strong>站点公开地址</strong>
          <small>
            {draft.public_url || "尚未配置；用于第三方登录和通行密钥"}
          </small>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="配置站点公开地址"
          onClick={() => open("site")}
        >
          <Settings size={17} />
        </button>
      </div>
      {query.isError && (
        <p className="error">{(query.error as Error).message}</p>
      )}
      <div className="setting-row">
        <div>
          <strong>开放用户注册</strong>
          <small>关闭时不创建新账号，保留已有账号登录。</small>
        </div>
        <Toggle
          label="开放用户注册"
          checked={!!draft.registration_enabled}
          disabled={!query.data}
          onChange={(v) => {
            setDraft((d) => ({ ...d, registration_enabled: v }));
            open("switches");
          }}
        />
      </div>
      <div className="setting-row">
        <div>
          <strong>邀请码注册</strong>
          <small>默认开放此注册方式，仍受上方注册总开关控制。</small>
        </div>
        <Toggle
          label="邀请码注册"
          checked={draft.invite_registration_enabled ?? true}
          disabled={!query.data}
          onChange={(v) => {
            setDraft((d) => ({ ...d, invite_registration_enabled: v }));
            open("switches");
          }}
        />
      </div>
      {Object.entries(labels).map(([method, label]) => (
        <div className="setting-row" key={method}>
          <div>
            <strong>{label}</strong>
            <small>
              {method === "phone"
                ? `短信服务：${draft.sms_provider === "twilio" ? "Twilio" : "阿里云"}`
                : method === "email"
                  ? "SMTP 验证码"
                  : `回调路径：/api/v1/auth/connect/callback/${method}`}
            </small>
          </div>
          <div className="inline-actions">
            <button
              className="icon-button"
              aria-label={"配置" + label}
              onClick={() => open(method)}
            >
              <Settings size={17} />
            </button>
            <Toggle
              label={"开放" + label}
              checked={!!draft[method + "_enabled"]}
              disabled={!query.data}
              onChange={(v) => {
                setDraft((d) => ({ ...d, [method + "_enabled"]: v }));
                open("switches");
              }}
            />
          </div>
        </div>
      ))}
      {dialog && (
        <Dialog
          title={
            dialog === "switches"
              ? "确认注册登录开关"
              : dialog === "site"
                ? "配置站点公开地址"
                : `配置${labels[dialog]}`
          }
          close={close}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {dialog === "phone" && (
              <label>
                短信平台
                <CustomSelect
                  value={draft.sms_provider || "aliyun"}
                  onChange={(v) => setDraft((d) => ({ ...d, sms_provider: v }))}
                  options={[
                    { value: "aliyun", label: "阿里云短信（+86）" },
                    { value: "twilio", label: "Twilio（国际短信）" },
                  ]}
                />
              </label>
            )}
            {dialog === "email" && (
              <label>
                TLS 模式
                <CustomSelect
                  value={draft.smtp_tls || "implicit"}
                  onChange={(v) => setDraft((d) => ({ ...d, smtp_tls: v }))}
                  options={[
                    { value: "implicit", label: "TLS（通常 465）" },
                    { value: "starttls", label: "STARTTLS（通常 587）" },
                  ]}
                />
              </label>
            )}
            {fields.map((k) => (
              <label key={k}>
                {names[k]}
                <input
                  name={k}
                  type={
                    k === "smtp_port"
                      ? "number"
                      : k.endsWith("secret") ||
                          k.endsWith("password") ||
                          k === "twilio_token"
                        ? "password"
                        : "text"
                  }
                  value={
                    draft[k] ??
                    (k === "smtp_port"
                      ? 465
                      : k === "microsoft_tenant"
                        ? "common"
                        : "")
                  }
                  placeholder={
                    draft[k + "_configured"] ? "已保存，留空保留原值" : ""
                  }
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      [k]:
                        k === "smtp_port"
                          ? Number(e.target.value)
                          : e.target.value,
                    }))
                  }
                />
              </label>
            ))}
            {(dialog === "microsoft" || dialog === "github") && (
              <button
                type="button"
                className="icon-button"
                onClick={() => setHelp(dialog)}
                aria-label="查看登录配置步骤"
                title="查看登录配置步骤"
              >
                <CircleHelp size={19} />
              </button>
            )}
            {error && <p className="error">{error}</p>}
            <div className="app-card-actions">
              {dialog !== "switches" && dialog !== "site" && (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      setError("");
                      const d = await api<Record<string, any>>(
                        "admin/identity/settings",
                        { action: "reveal", current_password: password },
                        "POST",
                      );
                      setDraft((old) => ({
                        ...d,
                        ...Object.fromEntries(
                          Object.entries(old).filter(
                            ([k]) =>
                              !k.endsWith("secret") &&
                              !k.endsWith("password") &&
                              k !== "twilio_token",
                          ),
                        ),
                        ...Object.fromEntries(
                          Object.entries(d).filter(
                            ([k]) =>
                              k.endsWith("secret") ||
                              k.endsWith("password") ||
                              k === "twilio_token",
                          ),
                        ),
                      }));
                    } catch (x) {
                      setError((x as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  验证密码后读取配置
                </button>
              )}
              <button className="primary" disabled={busy}>
                {busy ? "保存中…" : "确认保存"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {help && (
        <Dialog
          title={
            help === "microsoft" ? "微软登录配置步骤" : "GitHub 登录配置步骤"
          }
          close={() => setHelp("")}
        >
          <ol className="setup-steps">
            <li>先填写本站公开地址，生产环境使用 HTTPS。</li>
            <li>
              {help === "microsoft" ? (
                <>
                  打开{" "}
                  <a
                    href="https://entra.microsoft.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Microsoft Entra 管理中心
                  </a>
                  ，进入应用注册，新建应用并选择所需账号类型。
                </>
              ) : (
                <>
                  打开{" "}
                  <a
                    href="https://github.com/settings/developers"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub Developer settings
                  </a>
                  ，进入 OAuth Apps，新建 OAuth App。
                </>
              )}
            </li>
            <li>
              {help === "microsoft"
                ? "添加 Web 平台的重定向 URI："
                : "填写 Authorization callback URL："}
              <code style={{ display: "block", overflowWrap: "anywhere" }}>
                {draft.public_url || "https://你的域名"}
                /api/v1/auth/connect/callback/{help}
              </code>
            </li>
            <li>
              {help === "microsoft"
                ? "复制 Application (client) ID；在证书和密码中创建客户端密码，复制密码值，填入 Client Secret。选择匹配的 Tenant。"
                : "将 Client ID 和新生成的 Client Secret 填入配置。"}
            </li>
            <li>
              输入当前管理员密码保存，再打开该登录方式的开关。需要新用户注册时，同时打开开放用户注册。
            </li>
          </ol>
          <button className="primary" onClick={() => setHelp("")}>
            知道了
          </button>
        </Dialog>
      )}
    </section>
  );
}
function IdentityBindings({ api }: { api: Api }) {
  const state = useQuery({
    queryKey: ["identity-initial-password"],
    queryFn: () => api<{ required: boolean }>("auth/connect/initial-password"),
    retry: false,
  });
  const bindings = useQuery({
    queryKey: ["identity-bindings"],
    queryFn: () =>
      api<{ provider: string; label: string }[]>("auth/connect/bindings"),
    retry: false,
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      {bindings.data?.map((b) => (
        <p className="muted" key={b.provider}>
          {labels[b.provider]}：{b.label}
        </p>
      ))}
      {state.data?.required && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (f.get("password") !== f.get("confirm"))
              return setError("两次密码不一致");
            try {
              setBusy(true);
              setError("");
              await api(
                "auth/connect/initial-password",
                { new_password: String(f.get("password")) },
                "POST",
              );
              sessionStorage.removeItem("tcv-session");
              location.href = "/";
            } catch (x) {
              setError((x as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>设置初始密码</h3>
          <p className="muted">
            通过第三方创建的账号可以先设置密码，再绑定其他身份。
          </p>
          <label>
            新密码
            <input
              type="password"
              name="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            确认密码
            <input
              type="password"
              name="confirm"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={busy}>
            设置密码并重新登录
          </button>
        </form>
      )}
    </>
  );
}
export function IdentityAccess({
  api,
  onLogin,
  bind = false,
  sharedHuman,
}: {
  api: Api;
  onLogin?: (s: Session) => void;
  bind?: boolean;
  sharedHuman?: ReturnType<typeof useHuman>;
}) {
  const ownHuman = useHuman(api, !sharedHuman),
    human = sharedHuman || ownHuman;
  const qc = useQueryClient();
  const options = useQuery({
    queryKey: ["identity-options"],
    queryFn: () => api<Options>("auth/connect/options"),
    staleTime: 60000,
    retry: false,
  });
  const [registrationMode, setRegistrationMode] = useState("invite");
  const [registering, setRegistering] = useState(
      window.location.pathname === "/register",
    ),
    [method, setMethod] = useState("email"),
    [target, setTarget] = useState(""),
    [challenge, setChallenge] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cooldown, setCooldown] = useState(0),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState("");
  const available = ["email", "phone"].filter(
    (x) => options.data?.[(x + "_enabled") as keyof Options],
  );
  useEffect(() => {
    if (available.length && !available.includes(method))
      setMethod(available[0]);
  }, [options.data]);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  const action = bind ? "bind" : registering ? "register" : "login";
  const usingInvite =
    registering &&
    !bind &&
    options.data?.invite_registration_enabled !== false &&
    registrationMode === "invite";
  function changeMethod(v: string) {
    setMethod(v);
    setChallenge("");
    setError("");
  }
  async function oauth(provider: string) {
    try {
      setBusy(true);
      setError("");
      const data = await api<{ url: string }>(
        "auth/connect/start",
        {
          provider,
          action: bind ? "bind" : "login",
          password,
          ...human.fields,
        },
        "POST",
      );
      window.location.assign(data.url);
    } catch (x) {
      setError((x as Error).message);
      setBusy(false);
      human.reset();
    }
  }
  return (
    <div className="identity-access">
      {bind && <h3>绑定登录身份</h3>}
      {bind && <IdentityBindings api={api} />}
      {options.isError && (
        <p className="muted">无法获取其他登录方式，请检查后端服务版本。</p>
      )}
      {registering && !bind && !options.data?.registration_enabled ? (
        <p className="muted">管理员尚未开放用户注册。</p>
      ) : (
        <>
          {registering &&
            !bind &&
            options.data?.invite_registration_enabled !== false && (
              <label>
                注册方式
                <CustomSelect
                  value={registrationMode}
                  onChange={setRegistrationMode}
                  options={[
                    { value: "invite", label: "邀请码注册" },
                    ...(available.length
                      ? [{ value: "identity", label: "邮箱 / 手机号注册" }]
                      : []),
                  ]}
                />
              </label>
            )}
          {usingInvite && (
            <InviteRegistration api={api} human={human} onLogin={onLogin} />
          )}
          {available.length > 0 && !usingInvite && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  setBusy(true);
                  setError("");
                  setMessage("");
                  const data = await api<Session>(
                    "auth/connect/verify",
                    {
                      action,
                      challenge_id: challenge,
                      code: String(f.get("code")),
                      username: String(f.get("username") || ""),
                      nickname: String(f.get("nickname") || ""),
                      password: bind
                        ? password
                        : String(f.get("password") || ""),
                    },
                    "POST",
                  );
                  if (bind) {
                    window.dispatchEvent(
                      new CustomEvent("tcv:success", {
                        detail: "身份绑定成功",
                      }),
                    );
                    setChallenge("");
                    void qc.invalidateQueries({
                      queryKey: ["identity-bindings"],
                    });
                    void qc.invalidateQueries({ queryKey: ["factor-status"] });
                  } else {
                    const session = await authenticateFactors(api, data);
                    rememberLogin(session);
                    window.dispatchEvent(
                      new CustomEvent("tcv:success", {
                        detail: registering ? "注册成功" : "登录成功",
                      }),
                    );
                    onLogin?.(session);
                  }
                } catch (x) {
                  setError((x as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {bind ? "绑定方式" : "验证方式"}
                <CustomSelect
                  value={method}
                  onChange={changeMethod}
                  options={available.map((x) => ({
                    value: x,
                    label: labels[x],
                  }))}
                />
              </label>
              <label>
                {labels[method]}
                <input
                  type={method === "email" ? "email" : "tel"}
                  value={target}
                  placeholder={
                    method === "phone" ? "+8613800000000" : "name@example.com"
                  }
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setChallenge("");
                  }}
                  required
                />
              </label>
              <div className="code-row">
                <label>
                  验证码
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || cooldown > 0 || !target || !human.ready}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      setError("");
                      const result = await api<{ challenge_id: string }>(
                        "auth/connect/code",
                        { method, target, action, password, ...human.fields },
                        "POST",
                      );
                      setChallenge(result.challenge_id);
                      setCooldown(60);
                      window.dispatchEvent(
                        new CustomEvent("tcv:success", {
                          detail: "验证码已发送，5 分钟内有效",
                        }),
                      );
                    } catch (x) {
                      setError((x as Error).message);
                    } finally {
                      setBusy(false);
                      human.reset();
                    }
                  }}
                >
                  {cooldown ? `${cooldown} 秒后重发` : "发送验证码"}
                </button>
              </div>
              {registering && !bind && (
                <>
                  <label>
                    用户名
                    <input
                      name="username"
                      pattern="[A-Za-z0-9_.-]{3,64}"
                      required
                    />
                  </label>
                  <label>
                    昵称
                    <input name="nickname" maxLength={32} />
                  </label>
                  <label>
                    密码（至少 12 位）
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                </>
              )}
              <button className="primary" disabled={busy || !challenge}>
                {bind
                  ? "验证并绑定"
                  : registering
                    ? "注册并登录"
                    : "验证码登录"}
              </button>
            </form>
          )}
          <div className="oauth-actions">
            {(["microsoft", "github"] as const)
              .filter((p) => options.data?.[(p + "_enabled") as keyof Options])
              .map((p) => (
                <button
                  type="button"
                  key={p}
                  className="secondary"
                  disabled={busy || !human.ready}
                  onClick={() => oauth(p)}
                >
                  {bind ? "绑定" : "使用"}
                  {labels[p]}
                  {bind ? "" : "登录"}
                </button>
              ))}
          </div>
          {!usingInvite &&
            (!sharedHuman || registering) &&
            (available.length > 0 ||
              options.data?.github_enabled ||
              options.data?.microsoft_enabled) &&
            human.widget}
          {registering &&
            !bind &&
            (options.data?.github_enabled ||
              options.data?.microsoft_enabled) && (
              <p className="muted">第三方首次登录将创建独立用户账号。</p>
            )}
        </>
      )}
      {error && <p className="error">{error}</p>}
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
export function CompleteIdentityLogin({
  api,
  onLogin,
}: {
  api: Api;
  onLogin: (s: Session) => void;
}) {
  const [error, setError] = useState("");
  useEffect(() => {
    const url = new URL(location.href),
      ticket = url.searchParams.get("auth_ticket");
    if (!ticket) return;
    url.searchParams.delete("auth_ticket");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    api<Session & { bound?: boolean }>(
      "auth/connect/exchange",
      { ticket },
      "POST",
    )
      .then(async (data) => {
        if (data.bound) {
          window.dispatchEvent(
            new CustomEvent("tcv:success", { detail: "第三方身份已绑定" }),
          );
          return;
        }
        const session = await authenticateFactors(api, data);
        rememberLogin(session);
        onLogin(session);
      })
      .catch((e) => setError(e.message));
  }, []);
  return error ? <div className="error">{error}</div> : null;
}
