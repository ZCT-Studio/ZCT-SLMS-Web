// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {apiFetch} from "./Network";
import {HelpTip} from "./Help";
import {useEffect, useRef, useState} from "react";
import {Dialog} from "./Extras";
import {CustomSelect} from "./Select";
import {performPasskey, useHuman} from "./Security";
import {ShieldCheck} from "lucide-react";

type Request = {
    title: string;
    purpose?: string;
    run: (proof: string) => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
};
const labels: Record<string, string> = {
    password: "密码",
    passkey: "通行密钥",
    totp: "动态令牌",
    email: "邮箱验证码",
    phone: "手机验证码",
    github: "GitHub",
    google: "Google",
    telegram: "Telegram",
    gitlab: "GitLab",
    discord: "Discord",
    microsoft: "Microsoft",
    recovery: "恢复码",
};

async function call(path: string, body: Record<string, any> = {}) {
    const session = JSON.parse(localStorage.getItem("zct_slms-session") || "null");
    const r = await apiFetch("/api/v1/" + path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(session?.token ? {Authorization: "Bearer " + session.token} : {}),
        },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("授权服务不可用，请检查后端连接");
    const result = await r.json();
    if (result.code !== 0) throw new Error(result.message || "验证失败");
    return result.data;
}

async function captchaApi<T>(path: string): Promise<T> {
    const response = await apiFetch("/api/v1/" + path);
    if (!response.ok) throw new Error("无法获取人机验证配置");
    const body = await response.json();
    if (body.code !== 0) throw new Error(body.message || "无法获取人机验证配置");
    return body.data;
}

export function AuthorizationPromptHost() {
    const [request, setRequest] = useState<Request | null>(null),
        [flow, setFlow] = useState<any>(null),
        [method, setMethod] = useState(""),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [codeChallenge, setCodeChallenge] = useState(""),
        [cooldown, setCooldown] = useState(0);
    const human = useHuman(captchaApi, !!request);
    const [humanVerified, setHumanVerified] = useState(false);
    const active = useRef<Request | null>(null),
        popup = useRef<Window | null>(null);

    function clear() {
        popup.current?.close();
        popup.current = null;
        active.current = null;
        setRequest(null);
        setFlow(null);
        setError("");
        setBusy(false);
    }

    function availableMethods(data: any): string[] {
        const priority = ["passkey", "microsoft", "github", "google", "telegram", "gitlab", "discord", "password", "email", "phone", "totp", "recovery"];
        return [...new Set<string>([...(data.methods || []), ...(data.recovery_available ? ["recovery"] : [])])]
            .sort((a, b) => (priority.indexOf(a) < 0 ? 99 : priority.indexOf(a)) - (priority.indexOf(b) < 0 ? 99 : priority.indexOf(b)));
    }

    function update(data: any) {
        setFlow(data);
        setMethod(availableMethods(data)[0] || "");
        setCodeChallenge("");
        setCooldown(0);
        setError("");
    }

    async function accepted(data: any) {
        if (!active.current) return;
        if (data.authorization_required) {
            update(data);
            setBusy(false);
            return;
        }
        if (!data.authorization_token) throw new Error("授权响应无效");
        const task = active.current;
        setBusy(true);
        try {
            const result = await task.run("zct_slms-auth:" + data.authorization_token);
            task.resolve(result);
        } catch (x) {
            task.reject(x as Error);
        } finally {
            clear();
        }
    }

    useEffect(() => {
        const listener = (e: Event) => {
            const task = (e as CustomEvent<Request>).detail;
            if (active.current) {
                task.reject(new Error("请先完成当前授权"));
                return;
            }
            active.current = task;
            setRequest(task);
            setHumanVerified(false);
            setFlow(null);
            setError("");
            setBusy(false);
            call("auth/authorize/start", {purpose: task.purpose || ""})
                .then((data) => {
                    if (active.current === task) update(data);
                })
                .catch((x) => {
                    if (active.current === task) setError(x.message);
                });
        };
        const oauth = (e: MessageEvent) => {
            if (
                e.origin !== location.origin ||
                e.source !== popup.current ||
                e.data?.type !== "zct_slms:authorization-result"
            )
                return;
            popup.current?.close();
            popup.current = null;
            accepted(e.data.data).catch((x) => {
                setError(x.message);
                setBusy(false);
            });
        };
        window.addEventListener("zct_slms:password", listener);
        window.addEventListener("message", oauth);
        return () => {
            window.removeEventListener("zct_slms:password", listener);
            window.removeEventListener("message", oauth);
            active.current?.reject(new Error("授权已取消"));
            popup.current?.close();
        };
    }, []);
    useEffect(() => {
        if (!cooldown) return;
        const timer = setTimeout(() => setCooldown((v) => v - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);
    if (!request) return null;
    const needHuman = !humanVerified && (method === "passkey" ? !!human.config?.captcha_for_passkey : !!human.config?.captcha_for_authorization);
    const close = () => {
        if (busy) return;
        request.reject(new Error("操作已取消"));
        clear();
    };
    return (
        <Dialog title="授权确认" close={close}>
            <div className="authorization-heading">
                <ShieldCheck size={23}/>
                <strong>{request.title.replaceAll("验证密码", "验证身份")}</strong>
            </div>
            {flow?.primary_method && (
                <p className="muted">
                    已通过{labels[flow.primary_method]}，请选择另一种方式。
                </p>
            )}
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    if (!flow) return;
                    const f = new FormData(e.currentTarget);
                    try {
                        setBusy(true);
                        setError("");
                        if (["github", "microsoft", "google", "telegram", "gitlab", "discord"].includes(method)) {
                            popup.current = window.open(
                                "about:blank",
                                "zct_slms-authorization",
                                "width=600,height=720",
                            );
                            if (!popup.current) throw new Error("请允许本站弹出授权窗口");
                            const result = await call("auth/factors/oauth/start", {
                                action: "mfa",
                                provider: method,
                                challenge_id: flow.challenge_id,
                                ...(needHuman ? await human.getFields() : {}),
                            });
                            if (needHuman) setHumanVerified(true);
                            popup.current.location.href = result.url;
                            setBusy(false);
                            return;
                        }
                        const credential =
                            method === "passkey"
                                ? await performPasskey(flow.public_key)
                                : undefined;
                        const data = await call("auth/factors/verify", {
                            challenge_id: flow.challenge_id,
                            method,
                            ...(needHuman ? await human.getFields() : {}),
                            password: String(f.get("password") || ""),
                            code: String(f.get("code") || ""),
                            recovery_code: String(f.get("recovery") || ""),
                            code_challenge_id: codeChallenge,
                            credential,
                        });
                        if (needHuman) setHumanVerified(true);
                        await accepted(data);
                    } catch (x) {
                        setError((x as Error).message);
                        setBusy(false);
                    }
                }}
            >
                {flow ? (
                    <>
                        <label>
                            验证方式
                            <CustomSelect
                                value={method}
                                disabled={busy}
                                onChange={(v) => {
                                    setMethod(v);
                                    setCodeChallenge("");
                                    setError("");
                                }}
                                options={availableMethods(flow).map((value) => ({
                                    value,
                                    label: labels[value] || value
                                }))}
                            />
                        </label>
                        {method === "password" && (
                            <label>
                                当前密码
                                <input
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    autoFocus
                                />
                            </label>
                        )}
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
                        {method === "recovery" && (
                            <label>
                                一次性恢复码
                                <input name="recovery" autoComplete="off" required/>
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
                                            const sent = await call("auth/factors/code", {
                                                challenge_id: flow.challenge_id,
                                                method,
                                                ...(needHuman ? await human.getFields() : {}),
                                            });
                                            if (needHuman) setHumanVerified(true);
                                            setCodeChallenge(sent.code_challenge_id);
                                            setCooldown(60);
                                        } catch (x) {
                                            setError((x as Error).message);
                                        } finally {
                                            setBusy(false);
                                        }
                                    }}
                                >
                                    {cooldown ? `${cooldown}秒后重发` : "发送验证码"}
                                </button>
                            </div>
                        )}
                        <HelpTip title="授权规则">
                            <p>
                                {request?.purpose === "closure"
                                    ? "注销账号必须在本次验证两种不同的登录方式，恢复码和一小时内的授权记录不能替代；验证后提交工单，由管理员审核。"
                                    : flow.two_factor_required
                                        ? "平台已开启 2FA，本次需要验证第二因素。通过后，同一会话一小时内无需重复双重验证。"
                                        : "本次操作验证一种已绑定方式即可。安全设置变化、退出登录或会话失效后需要重新验证。"}
                            </p>
                        </HelpTip>
                    </>
                ) : (
                    <p className="muted">
                        {error ? "授权暂不可用" : "正在读取可用验证方式…"}
                    </p>
                )}
                {needHuman && human.widget}
                {error && <p className="error">{error}</p>}
                <div className="form-actions">
                    <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={close}
                    >
                        取消
                    </button>
                    {!flow && error ? (
                        <button
                            type="button"
                            className="primary"
                            onClick={() => {
                                setError("");
                                call("auth/authorize/start")
                                    .then(update)
                                    .catch((x) => setError(x.message));
                            }}
                        >
                            重试
                        </button>
                    ) : (
                        <button
                            className="primary"
                            disabled={
                                busy ||
                                !flow || (!human.config && method !== "passkey") || (needHuman && !human.ready) ||
                                ((method === "email" || method === "phone") && !codeChallenge)
                            }
                        >
                            {busy
                                ? "验证中…"
                                : flow?.primary_method
                                    ? "完成授权"
                                    : "验证并继续"}
                        </button>
                    )}
                </div>
            </form>
        </Dialog>
    );
}
