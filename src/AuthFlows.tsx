// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {LoginMethodTabs} from "./ProductUI";
import {BackLink} from "./BackLink";
import {useEffect, useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Dialog} from "./Extras";
import {CustomSelect} from "./Select";
import {authenticateFactors, performPasskey, useHuman} from "./Security";

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
    google: "Google",
    telegram: "Telegram",
    gitlab: "GitLab",
    discord: "Discord",
    microsoft: "微软账号",
    recovery: "恢复码",
};

export function storeSession(s: Session) {
    localStorage.setItem("zct_slms-session", JSON.stringify(s));
    let accounts: Session[] = [];
    try {
        accounts = JSON.parse(localStorage.getItem("zct_slms-accounts") || "[]");
    } catch {
    }
    localStorage.setItem(
        "zct_slms-accounts",
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
                                ...(await human.getFields()),
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
                                ...(await human.getFields()),
                            },
                            "POST",
                        );
                    else {
                        const start = await api<any>(
                            "auth/factors/passkey/start",
                            {username, role, ...(human.config?.captcha_for_passkey ? await human.getFields() : {})},
                            "POST",
                        );
                        const credential = await performPasskey(start.public_key);
                        result = await api<Session>(
                            "auth/factors/primary",
                            {method, challenge_id: start.challenge_id, credential},
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
            <LoginMethodTabs value={method} onChange={(k) => {
                setMethod(k);
                setError("");
            }}/>
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
            {(method !== "passkey" || human.config?.captcha_for_passkey) && human.widget}
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
                <button
                    className="primary login-button"
                    disabled={busy || ((method !== "passkey" || human.config?.captcha_for_passkey) && !human.ready)}
                >
                    {busy ? "验证中…" : `使用${labels[method]}登录`}
                </button>
            </div>
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
    const human = useHuman((p, b, m) => flow ? flow.api(p, b, m) : Promise.reject(new Error("验证未开始")), !!flow);
    const [humanVerified, setHumanVerified] = useState(false);
    useEffect(() => {
        const f = (e: Event) => {
            const next = (e as CustomEvent<MfaRequest>).detail;
            active.current?.reject(new Error("验证已取消"));
            active.current = next;
            setFlow(next);
            setHumanVerified(false);
            setMethod(next.data.methods?.[0] || "recovery");
            setError("");
            setChallenge("");
            setCooldown(0);
            setBusy(false);
        };
        window.addEventListener("zct_slms:mfa", f);
        return () => window.removeEventListener("zct_slms:mfa", f);
    }, []);
    useEffect(() => {
        if (!cooldown) return;
        const t = setTimeout(() => setCooldown((v) => v - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);
    if (!flow) return null;
    const needHuman = !!human.config?.captcha_for_2fa && !humanVerified && (method !== "passkey" || !!human.config?.captcha_for_passkey);
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
                        if (["github", "microsoft", "google", "telegram", "gitlab", "discord"].includes(method)) {
                            const start = await flow.api<any>(
                                "auth/factors/oauth/start",
                                {
                                    action: "mfa",
                                    challenge_id: flow.data.challenge_id,
                                    provider: method,
                                    ...(needHuman ? await human.getFields() : {}),
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
                                ...(needHuman ? await human.getFields() : {}),
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
                        ].map((value) => ({value, label: labels[value] || value}))}
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
                            disabled={busy || cooldown > 0 || !human.config || (needHuman && !human.ready)}
                            onClick={async () => {
                                try {
                                    setBusy(true);
                                    setError("");
                                    const r = await flow.api<any>(
                                        "auth/factors/code",
                                        {
                                            challenge_id: flow.data.challenge_id,
                                            method, ...(needHuman ? await human.getFields() : {})
                                        },
                                        "POST",
                                    );
                                    if (needHuman) setHumanVerified(true);
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
                        <input name="recovery" autoComplete="off" required/>
                    </label>
                )}
                {method === "password" && (
                    <p className="muted">点击验证后输入当前账号密码。</p>
                )}
                {needHuman && human.widget}
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
                            busy || (!human.config && method !== "passkey") || (needHuman && !human.ready) || (["email", "phone"].includes(method) && !challenge)
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
                api<{
                    required: boolean;
                    initial_admin: boolean;
                    profile_setup?: boolean;
                    username?: string;
                    nickname?: string;
                    avatar?: string;
                    max_avatar_bytes?: number
                }>("auth/onboarding"),
            retry: false,
        }),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    const [profileAvatar, setProfileAvatar] = useState("");
    useEffect(() => {
        if (q.data?.profile_setup) setProfileAvatar(q.data.avatar || "");
    }, [q.data]);

    function returnToLogin() {
        void api("auth/logout", {}, "POST").catch(() => {
        });
        localStorage.removeItem("zct_slms-session");
        try {
            const accounts = JSON.parse(localStorage.getItem("zct_slms-accounts") || "[]");
            localStorage.setItem("zct_slms-accounts", JSON.stringify(accounts.filter((a: Session) => a.token !== session.token)));
        } catch {
        }
        qc.clear();
        window.location.assign("/?accounts=1&add=1");
    }

    useEffect(() => {
        if (q.data?.required) history.replaceState(null, "", q.data.profile_setup ? "/set-profile" : "/set-password");
        else if (
            q.data &&
            !q.data.required &&
            ["/set-password", "/set-profile"].includes(location.pathname)
        )
            history.replaceState(null, "", "/");
    }, [q.data]);
    useEffect(() => {
        if (
            !q.isError ||
            !/(请先登录|未登录|登录已过期)/.test((q.error as Error).message)
        )
            return;
        localStorage.removeItem("zct_slms-session");
        try {
            const accounts = JSON.parse(localStorage.getItem("zct_slms-accounts") || "[]");
            localStorage.setItem(
                "zct_slms-accounts",
                JSON.stringify(
                    accounts.filter((a: Session) => a.token !== session.token),
                ),
            );
        } catch {
        }
        qc.clear();
        onLogout();
    }, [q.isError, q.error, session.token]);
    if (q.isPending || q.isError)
        return (
            <div className="login-page">
                <section className="login-card">
                    <h2>账号安全检查</h2>
                    <p className="muted">
                        {q.isPending ? "正在检查账号状态…" : (q.error as Error).message}
                    </p>
                    {q.isError && (
                        <div className="form-actions security-check-actions">
                            <button className="secondary" onClick={() => q.refetch()}>
                                重试
                            </button>
                            <BackLink
                                onClick={returnToLogin}
                            >
                                返回登录
                            </BackLink>
                        </div>
                    )}
                </section>
            </div>
        );
    if (!q.data?.required) return <>{children}</>;
    return (
        <div className="login-page">
            <section className="login-card">
                <h1>{q.data.profile_setup ? "完善账号资料" : "为了您的账号安全请设置新的密码"}</h1>
                <p className="muted">
                    {q.data.profile_setup ? "已尽量从第三方预填资料，请确认用户名、昵称和头像。密码可选，留空继续使用已绑定的登录方式。" : "临时密码仅用于恢复访问，设置新密码后再进入控制台。"}
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
                            const result = await api<{ username?: string; nickname?: string }>(
                                "auth/onboarding",
                                {
                                    new_password: password,
                                    username: String(f.get("username") || ""),
                                    nickname: String(f.get("nickname") || ""),
                                    ...(q.data.profile_setup ? {avatar: profileAvatar} : {}),
                                },
                                "POST",
                            );
                            if (q.data.profile_setup) {
                                storeSession({
                                    ...session,
                                    username: result.username || session.username, ...({nickname: result.nickname})
                                });
                                qc.clear();
                                window.location.assign("/");
                                return;
                            }
                            localStorage.removeItem("zct_slms-session");
                            let all: Session[] = [];
                            try {
                                all = JSON.parse(localStorage.getItem("zct_slms-accounts") || "[]");
                            } catch {
                            }
                            localStorage.setItem(
                                "zct_slms-accounts",
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
                                new CustomEvent("zct_slms:success", {
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
                    {q.data.profile_setup && <>
                        <label>头像
                            <span className="avatar-upload"><span className="avatar">{profileAvatar ?
                                <img src={profileAvatar} referrerPolicy="no-referrer"
                                     alt="预填头像"/> : "用"}</span><span>选择图片<small>PNG、JPEG、WebP</small></span>
                <input className="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp"
                       onChange={e => {
                           const file = e.target.files?.[0];
                           if (!file) return;
                           if (file.size > (q.data.max_avatar_bytes || 1048576)) {
                               setError("头像超过大小限制");
                               return;
                           }
                           if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                               setError("请选择 PNG、JPEG 或 WebP 图片");
                               return;
                           }
                           const reader = new FileReader();
                           reader.onload = () => setProfileAvatar(String(reader.result));
                           reader.readAsDataURL(file);
                       }}/>
              </span>
                        </label>
                        {profileAvatar && <div className="form-actions">
                            <button type="button" className="secondary" onClick={() => setProfileAvatar("")}>移除头像
                            </button>
                        </div>}
                    </>}
                    {(q.data.initial_admin || q.data.profile_setup) && (
                        <>
                            <label>
                                新用户名
                                <input
                                    name="username"
                                    minLength={3}
                                    maxLength={64}
                                    pattern="[A-Za-z0-9_.-]{3,64}"
                                    autoComplete="username"
                                    defaultValue={q.data.profile_setup ? q.data.username : ""}
                                    required
                                />
                            </label>
                            <label>
                                昵称
                                <input name="nickname" maxLength={48} defaultValue={q.data.nickname || ""} required/>
                            </label>
                        </>
                    )}
                    <label>
                        {q.data.profile_setup ? "密码（可选）" : "新密码"}
                        <input
                            name="password"
                            type="password"
                            minLength={12}
                            maxLength={256}
                            autoComplete="new-password"
                            required={!q.data.profile_setup}
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
                            required={!q.data.profile_setup}
                        />
                    </label>
                    {error && <p className="error">{error}</p>}
                    <div className="form-actions">
                        <button className="primary" disabled={busy}>
                            {busy ? "保存中…" : q.data.profile_setup ? "保存并继续" : "保存新密码"}
                        </button>
                    </div>
                </form>
                <div className="login-secondary-links"><BackLink onClick={returnToLogin}>返回登录</BackLink></div>
            </section>
        </div>
    );
}

export function SecondMethodBanner({api}: { api: Api }) {
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
