import { useState } from "react";
import { CustomSelect } from "./Select";
import { useHuman, performPasskey, authenticateFactors } from "./Security";
import { storeSession } from "./AuthFlows";
import { TicketView } from "./Portal";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const names: Record<string, string> = {
  email: "邮箱验证码",
  phone: "手机验证码",
  totp: "动态令牌",
  passkey: "通行密钥",
  ticket: "人工工单",
};
export function InviteRegistration({
  api,
  human,
  onLogin,
}: {
  api: Api;
  human: ReturnType<typeof useHuman>;
  onLogin?: (s: any) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          setBusy(true);
          setError("");
          const result = await api<any>(
            "auth/invite/register",
            {
              username: String(f.get("username")),
              nickname: String(f.get("nickname")),
              password: String(f.get("password")),
              invite_code: String(f.get("invite")),
              ...human.fields,
            },
            "POST",
          );
          const session = await authenticateFactors(api, result);
          storeSession(session);
          history.replaceState(null, "", "/");
          onLogin?.(session);
        } catch (x) {
          setError((x as Error).message);
        } finally {
          setBusy(false);
          human.reset();
        }
      }}
    >
      <label>
        用户名
        <input
          name="username"
          pattern="[A-Za-z0-9_.-]{3,64}"
          autoComplete="username"
          required
        />
      </label>
      <label>
        昵称
        <input name="nickname" maxLength={48} required />
      </label>
      <label>
        密码
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
        邀请码
        <input
          name="invite"
          minLength={64}
          maxLength={64}
          autoComplete="off"
          placeholder="64 位邀请码"
          required
        />
      </label>
      {human.widget}
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button className="primary" disabled={busy || !human.ready}>
          {busy ? "注册中…" : "注册并登录"}
        </button>
      </div>
    </form>
  );
}
export function RecoveryPage({ api }: { api: Api }) {
  const human = useHuman(api),
    [role, setRole] = useState("USER"),
    [username, setUsername] = useState(""),
    [info, setInfo] = useState<any>(null),
    [method, setMethod] = useState(""),
    [contactMethod, setContactMethod] = useState("email"),
    [target, setTarget] = useState(""),
    [challenge, setChallenge] = useState(""),
    [code, setCode] = useState(""),
    [resetToken, setResetToken] = useState(""),
    [contactToken, setContactToken] = useState(""),
    [receipt, setReceipt] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  const account = { username, role },
    ticket = method === "ticket",
    delivery = ticket ? contactMethod : method;
  const recipient =
    delivery === "email" && !ticket && !target.includes("@")
      ? target + "@" + info?.email_domain
      : target;
  async function call(
    p: string,
    body: Record<string, any>,
    humanCheck = false,
  ) {
    setBusy(true);
    setError("");
    try {
      const result=await api<any>(
        p,
        { ...account, ...body, ...(humanCheck ? human.fields : {}) },
        "POST",
      );
      return result??{success:true};
    } catch (x) {
      setError((x as Error).message);
      return null;
    } finally {
      setBusy(false);
      if (humanCheck) human.reset();
    }
  }
  const methodOptions = [
    ...(info?.methods || []),
    ...(info?.ticket_allowed ? ["ticket"] : []),
  ];
  return (
    <div className="login-page">
      <section className="login-card recovery-card">
        <a className="details-back" href="/">
          ← 返回登录
        </a>
        <h1>找回密码</h1>
        {receipt ? (
          <>
            <p className="muted">
              工单已创建。请保存以下查询凭据，关闭页面后可凭工单号和查询令牌查询进度。
            </p>
            <pre className="result">
              {receipt.id + "\n" + receipt.access_token}
            </pre>
            <TicketView
              api={api}
              id={receipt.id}
              accessToken={receipt.access_token}
              back={() => setReceipt(null)}
            />
          </>
        ) : resetToken ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (f.get("password") !== f.get("confirm")) {
                setError("两次输入的新密码不一致");
                return;
              }
              const r = await call("auth/recovery/reset", {
                reset_token: resetToken,
                new_password: String(f.get("password")),
              });
              if (r !== null) {
                window.dispatchEvent(
                  new CustomEvent("tcv:success", {
                    detail: "密码已重置，请重新登录",
                  }),
                );
                window.location.assign("/");
              }
            }}
          >
            <p className="muted">身份验证通过，请设置新的密码。</p>
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
            <div className="form-actions">
              <button className="primary" disabled={busy}>
                保存新密码
              </button>
            </div>
          </form>
        ) : contactToken ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                r = await call("tickets/create", {
                  category: "FORGOT",
                  contact_token: contactToken,
                  title: "找回密码：" + username,
                  body: String(f.get("body")),
                });
              if (r) setReceipt(r);
            }}
          >
            <p className="muted">
              新联系方式已验证。请提供能说明账号归属的申诉材料，支持人员核验后会将临时密码发送给你，首次使用后需设置新密码。
            </p>
            <label>
              申诉材料
              <textarea
                name="body"
                rows={8}
                minLength={10}
                maxLength={8000}
                placeholder="例如注册时间、使用过的应用信息及其他能够核验归属的信息。不要填写任何密码。"
                required
              />
            </label>
            <div className="form-actions">
              <button className="primary" disabled={busy}>
                提交忘记密码工单
              </button>
            </div>
          </form>
        ) : (
          <>
            {!info ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await call("auth/recovery/options", {}, true);
                  if (r) {
                    setInfo(r);
                    setMethod(
                      r.methods?.[0] || (r.ticket_allowed ? "ticket" : ""),
                    );
                  }
                }}
              >
                <label>
                  账号类型
                  <CustomSelect
                    value={role}
                    onChange={setRole}
                    options={[
                      { value: "USER", label: "用户" },
                      { value: "SUBUSER", label: "子用户" },
                      { value: "ADMIN", label: "管理员 / 支持" },
                    ]}
                  />
                </label>
                <label>
                  用户名
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </label>
                {human.widget}
                <div className="form-actions">
                  <button className="primary" disabled={busy || !human.ready}>
                    查看恢复方式
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="muted">
                  正在恢复账号 {username}。
                  <button
                    className="text-button"
                    onClick={() => {
                      setInfo(null);
                      setChallenge("");
                      setCode("");
                      setTarget("");
                      setSent(false);
                    }}
                  >
                    更换账号
                  </button>
                </p>
                {methodOptions.length === 0 ? (
                  <p className="muted">
                    当前没有可用的恢复方式，请联系平台管理员。
                  </p>
                ) : (
                  <>
                    <label>
                      恢复方式
                      <CustomSelect
                        value={method}
                        onChange={(v) => {
                          setMethod(v);
                          setChallenge("");
                          setSent(false);
                          setTarget("");
                          setError("");
                        }}
                        options={methodOptions.map((value) => ({
                          value,
                          label: names[value] || value,
                        }))}
                      />
                    </label>
                    {ticket && (
                      <>
                        <p className="muted">
                          此账号尚未绑定邮箱或手机号。请先验证一个新的手机号或邮箱，然后提交工单。
                        </p>
                        <label>
                          接收临时密码的方式
                          <CustomSelect
                            value={contactMethod}
                            onChange={(v) => {
                              setContactMethod(v);
                              setTarget("");
                              setChallenge("");
                              setSent(false);
                            }}
                            options={[
                              { value: "email", label: "新邮箱" },
                              { value: "phone", label: "新手机号" },
                            ]}
                          />
                        </label>
                      </>
                    )}
                    {(["email", "phone"].includes(method) || ticket) && (
                      <>
                        <label>
                          {delivery === "email"
                            ? ticket
                              ? "新的邮箱"
                              : "补全已绑定的邮箱"
                            : ticket
                              ? "新的完整手机号"
                              : "已绑定的完整手机号"}
                          <div className="email-completion">
                            <input
                              value={target}
                              onChange={(e) => {
                                setTarget(e.target.value);
                                setChallenge("");
                                setSent(false);
                              }}
                              placeholder={
                                delivery === "phone"
                                  ? "+8613800000000"
                                  : ticket
                                    ? "name@example.com"
                                    : "邮箱前缀"
                              }
                              autoComplete="off"
                            />
                            {delivery === "email" && !ticket && (
                              <span>@{info.email_domain}</span>
                            )}
                          </div>
                        </label>
                        {human.widget}
                        <div className="form-actions">
                          <button
                            className="secondary"
                            disabled={busy || !human.ready || !target || sent}
                            onClick={async () => {
                              const r = await call(
                                "auth/recovery/code",
                                {
                                  method: delivery,
                                  kind: ticket ? "ticket" : "reset",
                                  target: recipient,
                                },
                                true,
                              );
                              if (r) {
                                setChallenge(r.challenge_id);
                                setSent(true);
                                window.dispatchEvent(
                                  new CustomEvent("tcv:success", {
                                    detail: "验证码已发送",
                                  }),
                                );
                              }
                            }}
                          >
                            {sent ? "验证码已发送（5 分钟有效）" : "发送验证码"}
                          </button>
                        </div>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const r = await call("auth/recovery/verify", {
                              challenge_id: challenge,
                              code,
                            });
                            if (r) {
                              if (r.reset_token) setResetToken(r.reset_token);
                              if (r.contact_token)
                                setContactToken(r.contact_token);
                            }
                          }}
                        >
                          <label>
                            验证码
                            <input
                              value={code}
                              onChange={(e) => setCode(e.target.value)}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              pattern="[0-9]{6}"
                              maxLength={6}
                              required
                            />
                          </label>
                          <div className="form-actions">
                            <button
                              className="primary"
                              disabled={busy || !challenge}
                            >
                              验证并继续
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                    {method === "totp" && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const r = await call(
                            "auth/recovery/totp",
                            { code },
                            true,
                          );
                          if (r) setResetToken(r.reset_token);
                        }}
                      >
                        <label>
                          动态验证码
                          <input
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            autoComplete="one-time-code"
                            required
                          />
                        </label>
                        {human.widget}
                        <div className="form-actions">
                          <button
                            className="primary"
                            disabled={busy || !human.ready}
                          >
                            验证动态令牌
                          </button>
                        </div>
                      </form>
                    )}
                    {method === "passkey" && (
                      <>
                        {human.widget}
                        <div className="form-actions">
                          <button
                            className="primary"
                            disabled={busy || !human.ready}
                            onClick={async () => {
                              const start = await call(
                                "auth/recovery/passkey/start",
                                {},
                                true,
                              );
                              if (!start) return;
                              try {
                                setBusy(true);
                                const credential = await performPasskey(
                                  start.public_key,
                                );
                                const r = await call(
                                  "auth/recovery/passkey/finish",
                                  {
                                    challenge_id: start.challenge_id,
                                    credential,
                                  },
                                );
                                if (r) setResetToken(r.reset_token);
                              } catch (x) {
                                setError((x as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            使用通行密钥验证
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
        {!receipt&&!info&&!resetToken&&!contactToken&&<details className="guest-ticket"><summary>查询已有工单</summary><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setReceipt({id:String(f.get("id")),access_token:String(f.get("token"))})}}><label>工单号<input name="id" minLength={32} maxLength={32} required/></label><label>查询令牌<input name="token" minLength={64} maxLength={64} autoComplete="off" required/></label><div className="form-actions"><button className="secondary">查询工单</button></div></form></details>}
        {error && <p className="error">{error}</p>}
      </section>
    </div>
  );
}
