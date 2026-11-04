// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {HelpTip} from "./Help";
import {useEffect, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {CustomSelect, Toggle} from "./Select";
import {Mail} from "lucide-react";

type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const success = (detail: string) =>
    window.dispatchEvent(new CustomEvent("zct_slms:success", {detail}));

export function TicketMailSettings({api}: { api: Api }) {
    const q = useQuery({
            queryKey: ["ticket-mail-settings"],
            queryFn: () => api<any>("admin/ticket-mail"),
        }),
        [draft, setDraft] = useState<any>({}),
        [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    useEffect(() => {
        if (q.data)
            setDraft({
                ...q.data,
                smtp_port: q.data.smtp_port || 465,
                smtp_tls: q.data.smtp_tls || "implicit",
                smtp_password: "",
            });
    }, [q.data]);
    return (
        <section className="panel management-card">
            <h2>独立工单邮箱</h2>
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                        setBusy(true);
                        setError("");
                        await api("admin/ticket-mail", draft, "POST");
                        await q.refetch();
                        success("工单邮箱配置已保存");
                    } catch (x) {
                        setError((x as Error).message);
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <div className="setting-row">
                    <strong>启用工单邮件</strong>
                    <Toggle
                        label="启用工单邮件"
                        checked={!!draft.enabled}
                        onChange={(enabled) => setDraft((d: any) => ({...d, enabled}))}
                    />
                </div>
                <div className="form-row">
                    {[
                        ["smtp_host", "SMTP服务器"],
                        ["smtp_port", "端口"],
                        ["smtp_username", "SMTP账号"],
                        ["smtp_from", "发件邮箱"],
                    ].map(([key, label]) => (
                        <label key={key}>
                            {label}
                            <input
                                value={draft[key] ?? (key === "smtp_port" ? 465 : "")}
                                onChange={(e) =>
                                    setDraft((d: any) => ({
                                        ...d,
                                        [key]:
                                            key === "smtp_port"
                                                ? Number(e.target.value)
                                                : e.target.value,
                                    }))
                                }
                                type={key === "smtp_port" ? "number" : "text"}
                                min={key === "smtp_port" ? 1 : undefined}
                                max={key === "smtp_port" ? 65535 : undefined}
                                required={!!draft.enabled}
                            />
                        </label>
                    ))}
                </div>
                <label>
                    SMTP密码 / 授权码
                    <input
                        type="password"
                        value={draft.smtp_password || ""}
                        onChange={(e) =>
                            setDraft((d: any) => ({...d, smtp_password: e.target.value}))
                        }
                        autoComplete="new-password"
                        placeholder={
                            draft.password_configured
                                ? "已设置，留空保留"
                                : "请输入SMTP授权码"
                        }
                    />
                </label>
                <label>
                    传输安全
                    <CustomSelect
                        value={draft.smtp_tls || "implicit"}
                        options={[
                            {value: "implicit", label: "隐式TLS"},
                            {value: "starttls", label: "STARTTLS"},
                        ]}
                        onChange={(smtp_tls) => setDraft((d: any) => ({...d, smtp_tls}))}
                    />
                </label>
                <label>
                    SMTP 认证方式
                    <CustomSelect
                        value={draft.smtp_auth || "auto"}
                        options={[
                            {value: "auto", label: "自动"},
                            {value: "login", label: "LOGIN"},
                            {value: "plain", label: "PLAIN"},
                        ]}
                        onChange={(smtp_auth) =>
                            setDraft((d: any) => ({...d, smtp_auth}))
                        }
                    />
                </label>
                <HelpTip title="工单邮件说明">
                    <p>
                        QQ 邮箱使用 smtp.qq.com、端口 465、隐式 TLS。SMTP
                        账号和发件邮箱填写完整邮箱地址；密码填写 16 位授权码。修改 QQ
                        密码后请重新生成授权码并保存此处配置。
                    </p>
                    <p>
                        此账号与注册登录邮箱配置独立。仅向已验证邮箱且主动开启提醒的账号发送，邮件内容由模板控制，默认包含最新消息和完整对话。发送失败自动重试。
                    </p>
                </HelpTip>
                {(error || q.isError) && (
                    <p className="error">{error || (q.error as Error).message}</p>
                )}
                <div className="form-actions">
                    <button className="primary" disabled={busy || !q.data}>
                        保存配置
                    </button>
                </div>
            </form>
        </section>
    );
}

export function TicketNotifications({api}: { api: Api }) {
    const q = useQuery({
            queryKey: ["ticket-notifications"],
            queryFn: () => api<any>("tickets/notifications"),
        }),
        [email, setEmail] = useState(""),
        [challenge, setChallenge] = useState(""),
        [code, setCode] = useState(""),
        [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    return (
        <section className="panel management-card">
            <h2>
                <Mail size={18}/> 工单提醒
            </h2>
            <div className="setting-row">
                <div>
                    <strong>邮件提醒</strong>
                    <small>{q.data?.email || "尚未验证提醒邮箱"}</small>
                </div>
                <Toggle
                    label="接收工单邮件提醒"
                    disabled={busy || !q.data?.service_enabled || !q.data?.email}
                    checked={!!q.data?.enabled}
                    onChange={async (enabled) => {
                        try {
                            setBusy(true);
                            await api(
                                "tickets/notifications",
                                {enabled: enabled ? "1" : "0"},
                                "POST",
                            );
                            await q.refetch();
                            success("提醒设置已更新");
                        } catch (x) {
                            setError((x as Error).message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            </div>
            {q.data?.service_enabled ? (
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                            setBusy(true);
                            setError("");
                            if (!challenge) {
                                const d = await api<any>(
                                    "tickets/notifications/code",
                                    {email},
                                    "POST",
                                );
                                setChallenge(d.challenge_id);
                                success("验证邮件已发送");
                            } else {
                                await api(
                                    "tickets/notifications/verify",
                                    {challenge_id: challenge, code},
                                    "POST",
                                );
                                setChallenge("");
                                setCode("");
                                setEmail("");
                                await q.refetch();
                                success("提醒邮箱已验证");
                            }
                        } catch (x) {
                            setError((x as Error).message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <label>
                        提醒邮箱
                        <input
                            type="email"
                            value={email}
                            disabled={!!challenge}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="输入可接收提醒的邮箱"
                            required
                        />
                    </label>
                    {challenge && (
                        <label>
                            邮箱验证码
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
                    )}
                    <div className="form-actions">
                        {challenge && (
                            <button
                                type="button"
                                className="secondary"
                                disabled={busy}
                                onClick={() => {
                                    setChallenge("");
                                    setCode("");
                                }}
                            >
                                更换邮箱
                            </button>
                        )}
                        <button className="primary" disabled={busy}>
                            {challenge ? "确认绑定" : "发送验证码"}
                        </button>
                    </div>
                </form>
            ) : (
                <p className="muted">管理员尚未启用独立工单邮箱。</p>
            )}
            {(error || q.isError) && (
                <p className="error">{error || (q.error as Error).message}</p>
            )}
        </section>
    );
}
