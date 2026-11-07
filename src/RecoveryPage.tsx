// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {TicketEditor} from "./TicketMarkdown";
import {Dialog} from "./Dialog";
import {BackLink} from "./BackLink";
import {securityNames} from "./SecurityTickets";
import {useEffect, useState} from "react";
import {CustomSelect} from "./Select";
import {authenticateFactors, performPasskey, useHuman} from "./Security";
import {storeSession} from "./AuthFlows";
import {TicketView} from "./Portal";

type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const names: Record<string, string> = {
    email: "邮箱验证码",
    phone: "手机验证码",
    passkey: "通行密钥",
    ticket: "人工工单",
    security_ticket: "解绑工单（解绑或重置登录方式）",
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
                            ...(await human.getFields()),
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
                <input name="nickname" maxLength={48} required/>
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

export function RecoveryPage({api}: { api: Api }) {
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
    const [adminConfirm, setAdminConfirm] = useState(false);
    const [adminReceipt, setAdminReceipt] = useState<any>(null);
    const [adminTokenOpen, setAdminTokenOpen] = useState(false);
    const [clock, setClock] = useState(() => Date.now());
    const [serverOffset, setServerOffset] = useState(0);
    const [adminWindow, setAdminWindow] = useState<any>(null);
    useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
    const secondsLeft = Math.max(0, (adminReceipt?.expires_at || adminWindow?.expires_at || (Math.floor((clock + serverOffset) / 3600000) + 1) * 3600) - Math.floor((clock + serverOffset) / 1000));
    const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, "0")}秒`;
    const account = {username, role},
        ticket = method === "ticket" || method === "security_ticket",
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
            const result = await api<any>(
                p,
                {...account, ...body, ...(humanCheck ? await human.getFields() : {})},
                "POST",
            );
            return result ?? {success: true};
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
        ...(info?.security_ticket_allowed ? ["security_ticket"] : []),
    ];
    return (
        <div className="login-page">
            <section className="login-card recovery-card">
                <BackLink href="/">返回登录</BackLink>
                <h1>找回密码</h1>
                {adminReceipt ? (
                    <div>
                        <p>凭证已生成，请按照提示配置后端环境变量并重启。</p>
                        <p>生成者 IP：{adminReceipt.ip}</p>
                        <p>剩余时间：{formatTime(secondsLeft)}{secondsLeft === 0 && "（凭证已过期）"}</p>
                        <p className="muted">除非重启服务端，否则此 IP 在 24 小时内无法重新生成。重启后从后端日志读取临时密码，并立即移除环境变量。</p>
                        {adminTokenOpen && <Dialog title="保存恢复凭证" close={() => {setAdminTokenOpen(false); setAdminReceipt((value: any) => ({...value, credential: undefined}));}}>
                            <p>凭证只显示这一次。请保存并配置到 <code>ZCT_SLMS_CORE_ADMIN_RECOVERY_TOKEN</code>。</p>
                            <pre className="result">{adminReceipt.credential}</pre>
                            <p>关闭弹窗后无法再次查看。除非重启服务端，否则此 IP 在 24 小时内无法重新生成。</p>
                            <div className="form-actions"><button type="button" className="primary" onClick={() => {setAdminTokenOpen(false); setAdminReceipt((value: any) => ({...value, credential: undefined}));}}>我已保存</button></div>
                        </Dialog>}
                    </div>
                ) : receipt ? (
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
                                    new CustomEvent("zct_slms:success", {
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
                                    category:
                                        method === "security_ticket" ? "SECURITY" : "FORGOT",
                                    security_method: String(f.get("security_method") || ""),
                                    security_action: "RESET",
                                    contact_token: contactToken,
                                    title:
                                        (method === "security_ticket"
                                            ? "账号安全恢复："
                                            : "找回密码：") + username,
                                    body: String(f.get("body")),
                                });
                            if (r) setReceipt(r);
                        }}
                    >
                        <p className="muted">
                            {method === "security_ticket"
                                ? "新联系方式已验证。请提供账号归属材料，工作人员核验后仅移除申请中的登录方式。新绑定由您重新登录后设置，工单不会展示密钥或恢复码。"
                                : "新联系方式已验证。请提供账号归属材料，核验后会向您发送临时密码，首次登录后需设置新密码。"}
                        </p>
                        {method === "security_ticket" && (
                            <label>
                                需要重置的登录方式
                                <CustomSelect
                                    name="security_method"
                                    defaultValue="totp"
                                    options={Object.entries(securityNames).map(
                                        ([value, label]) => ({value, label}),
                                    )}
                                />
                            </label>
                        )}
                        <label>
                            申诉材料
                            <TicketEditor contactToken={contactToken}
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
                                {method === "security_ticket" ? "提交解绑工单" : "提交忘记密码工单"}
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        {!info ? (
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (role === "ADMIN") { const w = await call("auth/recovery/admin-token", {action:"window"}); if (w) { setServerOffset(w.server_time * 1000 - Date.now()); setAdminWindow(w); setAdminConfirm(true); } return; }
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
                                        onChange={(value) => {setRole(value); setAdminConfirm(false);}}
                                        options={[
                                            {value: "USER", label: "用户"},
                                            {value: "SUBUSER", label: "子用户"},
                                            {value: "ADMIN", label: "管理员"},
                                            {value: "SUPPORT", label: "支持"},
                                        ]}
                                    />
                                </label>
                                <label>
                                    用户名
                                    <input
                                        value={username}
                                        onChange={(e) => {setUsername(e.target.value); setAdminConfirm(false);}}
                                        autoComplete="username"
                                        required
                                    />
                                </label>
                                <div className="form-actions">
                                    <button className="primary" disabled={busy}>{role === "ADMIN" ? "继续" : "查看恢复方式"}</button>
                                </div>
                                {role === "ADMIN" && adminConfirm && (
                                    <Dialog title="生成管理员恢复凭证" close={() => { if (!busy) setAdminConfirm(false); }}>
                                        <div className="notice recovery-notice">
                                            <p>凭证只会显示一次。生成后除非重启服务端，否则该 IP 在 24 小时内不能再次生成。</p>
                                            <p>{secondsLeft <= 600 ? "当前小时剩余时间较短，请确认有足够时间修改环境变量并重启。" : "凭证仅在当前小时内有效。"}</p>
                                            <p>剩余 {formatTime(secondsLeft)}。</p>
                                        </div>
                                        {error && <p className="error">{error}</p>}
                                        <div className="form-actions">
                                            <button type="button" className="secondary" disabled={busy} onClick={() => setAdminConfirm(false)}>取消</button>
                                            <button type="button" className="primary" disabled={busy} onClick={async () => {
                                                const r = await call("auth/recovery/admin-token", {});
                                                if (r) { setServerOffset(r.server_time * 1000 - Date.now()); setAdminReceipt(r); setAdminTokenOpen(true); setAdminConfirm(false); }
                                            }}>{busy ? "生成中…" : "生成凭证"}</button>
                                        </div>
                                    </Dialog>
                                )}
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
                                                    请先验证一个可用的手机号或邮箱，再提交归属证明；验证联系方式不代表账号审核已通过。
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
                                                            {value: "email", label: "新邮箱"},
                                                            {value: "phone", label: "新手机号"},
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
                                                                    kind:
                                                                        method === "security_ticket"
                                                                            ? "security-ticket"
                                                                            : ticket
                                                                                ? "ticket"
                                                                                : "reset",
                                                                    target: recipient,
                                                                },
                                                                true,
                                                            );
                                                            if (r) {
                                                                setChallenge(r.challenge_id);
                                                                setSent(true);
                                                                window.dispatchEvent(
                                                                    new CustomEvent("zct_slms:success", {
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
                                        {method === "passkey" && (
                                            <>
                                                {human.config?.captcha_for_passkey && human.widget}
                                                <div className="form-actions">
                                                    <button
                                                        className="primary"
                                                        disabled={busy || (human.config?.captcha_for_passkey && !human.ready)}
                                                        onClick={async () => {
                                                            const start = await call(
                                                                "auth/recovery/passkey/start",
                                                                {},
                                                                !!human.config?.captcha_for_passkey,
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
                {!adminReceipt && !receipt && !info && !resetToken && !contactToken && (
                    <details className="guest-ticket">
                        <summary>查询已有工单</summary>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const f = new FormData(e.currentTarget);
                                setReceipt({
                                    id: String(f.get("id")),
                                    access_token: String(f.get("token")),
                                });
                            }}
                        >
                            <label>
                                工单号
                                <input name="id" minLength={32} maxLength={32} required/>
                            </label>
                            <label>
                                查询令牌
                                <input
                                    name="token"
                                    minLength={64}
                                    maxLength={64}
                                    autoComplete="off"
                                    required
                                />
                            </label>
                            <div className="form-actions">
                                <button className="secondary">查询工单</button>
                            </div>
                        </form>
                    </details>
                )}
                {error && !adminConfirm && <p className="error">{error}</p>}
            </section>
        </div>
    );
}
