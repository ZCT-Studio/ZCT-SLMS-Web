// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {WorkspaceBrand} from "./ProductUI";
import {TicketContent, TicketEditor} from "./TicketMarkdown";
import {ResponsiveTable} from "./ResponsiveTable";
import {BackLink} from "./BackLink";
import {securityNames} from "./SecurityTickets";
import {ReviewPage, ViolationActions} from "./Review";
import {useEffect, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Dialog, ProfileControl} from "./Extras";
import {AccountSettings} from "./AccountSettings";
import {SecondMethodBanner} from "./AuthFlows";
import {MobileNavigation} from "./Navigation";
import {AccountActions, ClosureReview} from "./AccountActions";
import {HelpTip} from "./Help";
import {CheckCheck, ClipboardList, LayoutDashboard, Plus, RefreshCw, Settings, ShieldCheck,} from "lucide-react";
import {CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,} from "recharts";
import {CustomSelect, MultiSelect, Toggle} from "./Select";

export {ReviewPage} from "./Review";

type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const success = (detail: string) =>
    window.dispatchEvent(new CustomEvent("zct_slms:success", {detail}));
const date = (value: number) =>
    value === -1 ? "永久" : value ? new Date(value * 1000).toLocaleString() : "—";
const errorText = (e: any) => (e instanceof Error ? e.message : String(e));

export function RecoveryPolicy({api}: { api: Api }) {
    const q = useQuery({
            queryKey: ["factor-settings"],
            queryFn: () => api<any>("admin/factors/settings"),
        }),
        [draft, setDraft] = useState<Record<string, boolean>>({}),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    const fields = [
        ["email", "邮箱验证码"],
        ["phone", "手机验证码"],
        ["passkey", "通行密钥"],
        ["ticket", "人工工单"],
    ];
    return (
        <section className="panel management-card">
            <h2>账号恢复方式</h2>
            <p className="muted">
                已绑定邮箱或手机号的账号通过原绑定身份自助重置；未绑定的账号可验证新的邮箱或手机号后提交忘记密码工单。
            </p>
            {q.isError && <p className="error">{errorText(q.error)}</p>}
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                        setBusy(true);
                        setError("");
                        await api(
                            "admin/factors/settings",
                            Object.fromEntries(
                                fields.map(([k]) => {
                                    const key = `recovery_${k}_enabled`;
                                    return [key, draft[key] ?? q.data?.[key] ?? true];
                                }),
                            ),
                            "POST",
                        );
                        await q.refetch();
                        success("恢复策略已保存");
                    } catch (x) {
                        setError(errorText(x));
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {fields.map(([key, label]) => {
                    const k = `recovery_${key}_enabled`;
                    return (
                        <div className="setting-row" key={k}>
                            <strong>{label}</strong>
                            <Toggle
                                label={label}
                                checked={draft[k] ?? q.data?.[k] ?? true}
                                onChange={(v) => setDraft((d) => ({...d, [k]: v}))}
                            />
                        </div>
                    );
                })}
                {error && <p className="error">{error}</p>}
                <div className="form-actions">
                    <button className="primary" disabled={busy || !q.data}>
                        保存策略
                    </button>
                </div>
            </form>
        </section>
    );
}

export {VoucherPage} from "./Vouchers";
export {ModerationPage} from "./ModerationRules";

export function StaffUsers({api}: { api: Api }) {
    const [search, setSearch] = useState("");
    const q = useQuery({
            queryKey: ["support-users"],
            queryFn: () => api<any[]>("admin/support/users"),
        }),
        [open, setOpen] = useState(false),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    return (
        <div className="portal-page staff-users-page">
            <div className="page-heading portal-list-heading">
                <div>
                    <h1>支持账号</h1>
                    <p>管理支持人员的账号、状态与访问权限。</p>
                </div>
                {" "}
                <div className="heading-actions">
                    <button className="secondary" onClick={() => void q.refetch()}>
                        <RefreshCw size={15}/>
                        刷新
                    </button>
                    <button className="primary" onClick={() => setOpen(true)}>
                        <Plus size={15}/>
                        新建支持账号
                    </button>
                </div>
            </div>
            <section className="panel management-card">
                <div className="table-toolbar">
                    <h2>
                        支持账号{" "}
                        <HelpTip title="支持账号权限">
                            权限仅限工单、用户名与公开应用内容审查。不能控制应用、查看密钥或修改服务器设置。
                        </HelpTip>
                    </h2>
                </div>
                <label className="search">
                    <input
                        placeholder="搜索 ID、用户名或昵称"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
                <div className="table-scroll">
                    <ResponsiveTable>
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>用户名</th>
                            <th>昵称</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(q.data || [])
                            .filter((s) =>
                                `${s.id} ${s.username} ${s.nickname}`
                                    .toLowerCase()
                                    .includes(search.toLowerCase()),
                            )
                            .map((s) => (
                                <tr key={s.id}>
                                    <td>{s.id}</td>
                                    <td>{s.username}</td>
                                    <td>{s.nickname || "—"}</td>
                                    <td>{s.status === 1 ? "正常" : "已封禁"}</td>
                                    <td>
                                        <AccountActions api={api} user={s} role="SUPPORT"/>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </ResponsiveTable>
                </div>
                {q.isError && <p className="error">{errorText(q.error)}</p>}
                {open && (
                    <Dialog title="新建支持账号" close={() => setOpen(false)}>
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const f = new FormData(e.currentTarget);
                                try {
                                    setBusy(true);
                                    setError("");
                                    await api(
                                        "admin/support/users",
                                        {
                                            username: String(f.get("username")),
                                            nickname: String(f.get("nickname")),
                                            initial_password: String(f.get("password")),
                                        },
                                        "POST",
                                    );
                                    await q.refetch();
                                    setOpen(false);
                                    success("支持账号已创建，首次登录须修改密码");
                                } catch (x) {
                                    setError(errorText(x));
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
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
                                <input name="nickname" maxLength={48} required/>
                            </label>
                            <label>
                                初始密码
                                <input
                                    name="password"
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
                                    创建账号
                                </button>
                            </div>
                        </form>
                    </Dialog>
                )}
            </section>
        </div>
    );
}

export function TicketsPage({api, role}: { api: Api; role: string }) {
    return <TicketList key={role} api={api} role={role}/>;
}

function TicketList({api, role}: { api: Api; role: string }) {
    const qc = useQueryClient();
    const [filter, setFilter] = useState<string[]>(() =>
            role === "ADMIN" || role === "SUPPORT" ? ["OPEN"] : [],
        ),
        [categories, setCategories] = useState<string[]>(() => {
            const value = new URLSearchParams(window.location.search).get("category");
            return value ? [value] : [];
        }),
        [query, setQuery] = useState("");
    const q = useQuery({
            queryKey: ["tickets", filter, categories],
            queryFn: () =>
                api<any[]>("tickets/list", {
                    status: filter.length ? filter.join(",") : "ALL",
                    category: categories.length ? categories.join(",") : "ALL",
                }),
            refetchInterval: 30000,
        }),
        [open, setOpen] = useState(false),
        [selected, setSelected] = useState(
            () => new URLSearchParams(window.location.search).get("ticket") || "",
        ),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    if (selected)
        return <TicketView api={api} id={selected} back={() => setSelected("")}/>;
    return (
        <div className="portal-page ticket-page">
            <div className="page-heading portal-list-heading">
                <div>
                    <h1>工单系统</h1>
                    <p>查看进度、回复消息和处理支持请求。</p>
                </div>
                <div className="heading-actions">
                    <button className="secondary" onClick={() => void q.refetch()}>
                        <RefreshCw size={15}/>
                        刷新
                    </button>
                    <button
                        className="secondary"
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                                await api("tickets/mark-all-read", {}, "POST");
                                qc.setQueriesData<any[]>({queryKey: ["tickets"]}, (old) =>
                                    old?.map((t) => ({...t, unread_messages: 0})),
                                );
                                await Promise.all([
                                    qc.invalidateQueries({queryKey: ["tickets"]}),
                                    qc.invalidateQueries({queryKey: ["ticket-dashboard"]}),
                                ]);
                                success("工单已全部标为已读");
                            } catch (x) {
                                setError(errorText(x));
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        <CheckCheck size={15}/>
                        一键已读
                    </button>
                    <button className="primary" onClick={() => setOpen(true)}>
                        <Plus size={15}/>
                        新建工单
                    </button>
                </div>
            </div>
            <section className="panel list-panel">
                <div className="table-toolbar">
                    <h2>工单记录</h2>
                    <span className="muted">{q.data?.length || 0} 条记录</span>
                </div>
                <div className="voucher-filters">
                    <label className="search">
                        <input
                            placeholder="搜索工单标题、账号或编号"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </label>
                    <MultiSelect
                        ariaLabel="工单状态"
                        values={filter}
                        onChange={setFilter}
                        options={[
                            {value: "OPEN", label: "待处理"},
                            {value: "RESOLVED", label: "已处理"},
                            {value: "UNABLE", label: "无法处理"},
                            {value: "REJECTED", label: "已拒绝"},
                        ]}
                    />
                    <MultiSelect
                        ariaLabel="工单类型"
                        placeholder="全部类型"
                        values={categories}
                        onChange={setCategories}
                        options={[
                            {value: "FORGOT", label: "找回密码"},
                            {value: "ACCOUNT", label: "账号支持"},
                            {value: "GENERAL", label: "常规支持"},
                            {value: "UNBIND", label: "解绑工单"},
                            {value: "VIOLATION", label: "违规审查"},
                            {value: "CLOSURE", label: "账号注销"},
                        ]}
                    />
                </div>
                {q.isError && <p className="error">{errorText(q.error)}</p>}
                <div className="table-scroll">
                    <ResponsiveTable>
                        <thead>
                        <tr>
                            {["标题", "类型", "账号", "状态", "优先级", "更新时间"].map(
                                (v) => (
                                    <th key={v}>{v}</th>
                                ),
                            )}
                        </tr>
                        </thead>
                        <tbody>
                        {!q.isError &&
                            !(q.data || []).some((t) =>
                                `${t.title} ${t.username} ${t.id}`
                                    .toLowerCase()
                                    .includes(query.toLowerCase()),
                            ) && (
                                <tr>
                                    <td colSpan={6} className="empty-cell">
                                        {q.isPending
                                            ? "正在加载工单…"
                                            : query
                                                ? "没有符合条件的工单"
                                                : filter.length === 1 && filter[0] === "OPEN"
                                                    ? "暂无待处理工单"
                                                    : "此状态下暂无工单"}
                                    </td>
                                </tr>
                            )}
                        {q.data
                            ?.filter((t) =>
                                `${t.title} ${t.username} ${t.id}`
                                    .toLowerCase()
                                    .includes(query.toLowerCase()),
                            )
                            .map((t) => (
                                <tr
                                    key={t.id}
                                    className="clickable-row"
                                    onClick={() => setSelected(t.id)}
                                >
                                    <td>
                                        <button
                                            className="text-button"
                                            onClick={() => setSelected(t.id)}
                                        >
                                            {t.title}
                                            {t.unread_messages > 0 && (
                                                <span className="unread-badge">
                            {t.unread_messages}
                          </span>
                                            )}
                                        </button>
                                    </td>
                                    <td>{ticketType(t.category)}</td>
                                    <td>{t.username}</td>
                                    <td>{ticketStatus(t.status)}</td>
                                    <td>{priorityLabel(t.priority)}</td>
                                    <td>{date(t.updated_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </ResponsiveTable>
                </div>
            </section>
            {open && (
                <Dialog title="新建工单" close={() => setOpen(false)}>
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            try {
                                setBusy(true);
                                setError("");
                                const r = await api<any>(
                                    "tickets/create",
                                    {
                                        category: String(f.get("category")),
                                        title: String(f.get("title")),
                                        body: String(f.get("body")),
                                    },
                                    "POST",
                                );
                                await q.refetch();
                                setOpen(false);
                                setSelected(r.id);
                                success("工单已创建");
                            } catch (x) {
                                setError(errorText(x));
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        <label>
                            工单类型
                            <CustomSelect
                                name="category"
                                defaultValue="GENERAL"
                                options={[
                                    {value: "GENERAL", label: "常规支持"},
                                    {value: "ACCOUNT", label: "账号支持"},
                                ]}
                            />
                        </label>
                        <label>
                            标题
                            <input name="title" maxLength={90} required/>
                        </label>
                        <label>
                            问题描述
                            <TicketEditor
                                name="body"
                                minLength={10}
                                maxLength={8000}
                                rows={7}
                                required
                            />
                        </label>
                        {error && <p className="error">{error}</p>}
                        <div className="form-actions">
                            <button className="primary" disabled={busy}>
                                提交工单
                            </button>
                        </div>
                    </form>
                </Dialog>
            )}
        </div>
    );
}

const ticketType = (v: string) =>
        ({
            FORGOT: "忘记密码",
            ACCOUNT: "账号支持",
            GENERAL: "常规支持",
            VIOLATION: "违规审查",
            PASSKEY: "解绑工单",
            SECURITY: "解绑工单",
            UNBIND: "解绑工单",
            CLOSURE: "账号注销",
        })[v] || v,
    ticketStatus = (v: string) =>
        ({
            OPEN: "待处理",
            PROCESSING: "处理中",
            RESOLVED: "已处理",
            UNABLE: "无法处理",
            REJECTED: "已拒绝",
            CLOSED: "已拒绝",
        })[v] || v;
const priorityLabel = (p: number) => ["极低", "低", "中", "高", "极高"][p ?? 2];

export function TicketView({
                               api,
                               id,
                               accessToken = "",
                               back,
                           }: {
    api: Api;
    id: string;
    accessToken?: string;
    back: () => void;
}) {
    const qc = useQueryClient();
    const q = useQuery({
            queryKey: ["ticket", id, accessToken],
            queryFn: () =>
                api<any>("tickets/read", {id, access_token: accessToken}, "POST"),
            refetchInterval: 30000,
        }),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [reviewed, setReviewed] = useState(false);
    useEffect(() => {
        if (q.data) {
            qc.setQueriesData<any[]>({queryKey: ["tickets"]}, (old) =>
                old?.map((t) => (t.id === id ? {...t, unread_messages: 0} : t)),
            );
            void qc.invalidateQueries({queryKey: ["ticket-dashboard"]});
            void qc.invalidateQueries({queryKey: ["tickets"]});
        }
    }, [q.dataUpdatedAt]);
    return (
        <section className="panel management-card">
            <BackLink onClick={back}>返回工单</BackLink>
            <h2>{q.data?.title || "工单详情"}</h2>
            <p className="muted">
                {id} · {ticketType(q.data?.category)} · {ticketStatus(q.data?.status)} ·
                优先级：{priorityLabel(q.data?.priority)}
            </p>
            {q.data?.can_manage && (
                <div className="ticket-management-controls">
                    <label>
                        工单状态
                        <CustomSelect
                            value={q.data.status}
                            disabled={
                                busy ||
                                !q.data.can_change_status ||
                                q.data.status === "PROCESSING"
                            }
                            options={[
                                {value: "OPEN", label: "待处理"},
                                {
                                    value: "RESOLVED",
                                    label: "已处理",
                                    disabled: q.data.category === "CLOSURE",
                                },
                                {value: "UNABLE", label: "无法处理"},
                                {value: "REJECTED", label: "已拒绝"},
                            ]}
                            onChange={async (value) => {
                                try {
                                    setBusy(true);
                                    await api("tickets/status", {id, status: value}, "POST");
                                    await q.refetch();
                                    success("工单状态已更新");
                                } catch (x) {
                                    setError(errorText(x));
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        />
                    </label>
                    <label>
                        优先级
                        <CustomSelect
                            value={String(q.data.priority ?? 2)}
                            disabled={busy}
                            options={[4, 3, 2, 1, 0].map((value) => ({
                                value: String(value),
                                label: priorityLabel(value),
                            }))}
                            onChange={async (value) => {
                                try {
                                    setBusy(true);
                                    await api(
                                        "tickets/priority",
                                        {id, priority: Number(value)},
                                        "POST",
                                    );
                                    await q.refetch();
                                    success("优先级已更新");
                                } catch (x) {
                                    setError(errorText(x));
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        />
                    </label>
                </div>
            )}
            {q.data?.can_reopen && (
                <div className="form-actions">
                    <button
                        className="secondary"
                        disabled={busy}
                        onClick={async () => {
                            try {
                                setBusy(true);
                                await api(
                                    "tickets/status",
                                    {id, status: "OPEN", access_token: accessToken},
                                    "POST",
                                );
                                await q.refetch();
                                success("已重新标记为待处理");
                            } catch (x) {
                                setError(errorText(x));
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        重新标记为待处理（仅一次）
                    </button>
                </div>
            )}
            {q.isError && <p className="error">{errorText(q.error)}</p>}
            <div className="ticket-thread">
                {q.data?.messages?.map((m: any, i: number) => (
                    <article key={i}>
                        <header>
                            <strong>
                                {m.sender_role === "ADMIN"
                                    ? "管理员"
                                    : m.sender_role === "SUPPORT"
                                        ? "支持"
                                        : m.sender_role === "SUBUSER" ? "子用户" : "用户"}
                                {m.sender_nickname && <> · {m.sender_nickname}</>}
                                {m.sender_username &&
                                    <span className="ticket-sender-username">@{m.sender_username}</span>}
                            </strong>
                            <small>{date(m.created_at)}</small>
                        </header>
                        <TicketContent ticketId={id} accessToken={accessToken}>{m.body}</TicketContent>
                    </article>
                ))}
            </div>
            {q.data?.status === "OPEN" && (
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        try {
                            setBusy(true);
                            setError("");
                            await api(
                                "tickets/reply",
                                {
                                    id,
                                    access_token: accessToken,
                                    body: String(new FormData(form).get("body")),
                                },
                                "POST",
                            );
                            form.reset();
                            await q.refetch();
                            success("回复已发送");
                        } catch (x) {
                            setError(errorText(x));
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    <label>
                        回复
                        <TicketEditor ticketId={id} accessToken={accessToken} name="body" rows={5} maxLength={8000}
                                      required/>
                    </label>
                    <div className="form-actions">
                        <button className="primary" disabled={busy}>
                            发送回复
                        </button>
                    </div>
                </form>
            )}
            {q.data?.passkey_name && (
                <p className="muted">申请删除的通行密钥：{q.data.passkey_name}</p>
            )}
            {q.data?.can_remove_passkey && (
                <div className="ticket-reset">
                    <p className="muted">
                        请核验申请材料和账号归属。仅删除本工单指定的通行密钥，随后撤销申请账号全部登录会话。不能处理自己的删除申请；支持人员不能处理管理员或支持账号的申请。
                    </p>
                    <div className="setting-row">
                        <strong>已核验账号归属与删除申请</strong>
                        <Toggle
                            label="已核验账号归属与删除申请"
                            checked={reviewed}
                            onChange={setReviewed}
                        />
                    </div>
                    <div className="form-actions">
                        <button
                            className="danger-button"
                            disabled={busy || !reviewed}
                            onClick={async () => {
                                try {
                                    setBusy(true);
                                    setError("");
                                    await api(
                                        "tickets/remove-passkey",
                                        {id, reviewed: "1"},
                                        "POST",
                                    );
                                    await q.refetch();
                                    success("指定通行密钥已删除，申请账号会话已撤销");
                                } catch (x) {
                                    setError(errorText(x));
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            审核通过并删除通行密钥
                        </button>
                    </div>
                </div>
            )}
            {q.data?.security_method && (
                <p className="muted">
                    申请处理：
                    {securityNames[q.data.security_method] ||
                        q.data.security_method} ·{" "}
                    {q.data.security_action === "RESET" ? "重置" : "解绑"}
                </p>
            )}
            {q.data?.can_reset_security && (
                <section className="panel management-card ticket-reset">
                    <h3>审核安全申请</h3>
                    <p className="muted">
                        核验账号归属后，仅移除申请中的登录方式并撤销旧会话。新绑定由用户本人完成，工作人员不会获取新密钥或恢复码。
                    </p>
                    <div className="setting-row">
                        <strong>已核验账号归属和申请</strong>
                        <Toggle
                            label="已核验账号归属和申请"
                            checked={reviewed}
                            onChange={setReviewed}
                        />
                    </div>
                    <div className="form-actions">
                        <button
                            className="danger-button"
                            disabled={busy || !reviewed}
                            onClick={async () => {
                                setBusy(true);
                                setError("");
                                try {
                                    await api(
                                        "tickets/reset-security",
                                        {id, reviewed: "1"},
                                        "POST",
                                    );
                                    await q.refetch();
                                    success("申请已处理，原会话已撤销");
                                } catch (x) {
                                    setError(errorText(x));
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            审核通过并执行
                        </button>
                    </div>
                </section>
            )}
            {q.data?.can_moderate && (
                <ViolationActions
                    api={api}
                    id={id}
                    username={q.data.username}
                    ownerRole={q.data.owner_role}
                    refetch={() => q.refetch()}
                />
            )}
            {q.data?.can_reset_password && (
                <div className="ticket-reset">
                    <p className="muted">
                        请核验申诉材料及账号归属。临时密码仅发送至用户已验证的新联系方式；支持与管理员不可见。不能通过此入口重置管理员或支持账号。
                    </p>
                    <div className="setting-row">
                        <strong>已核验申诉材料与账号归属</strong>
                        <Toggle
                            label="已核验申诉材料与账号归属"
                            checked={reviewed}
                            onChange={setReviewed}
                        />
                    </div>
                    <div className="form-actions">
                        <button
                            className="danger-button"
                            disabled={busy || !reviewed}
                            onClick={async () => {
                                try {
                                    setBusy(true);
                                    setError("");
                                    await api(
                                        "tickets/reset-password",
                                        {id, reviewed: "1"},
                                        "POST",
                                    );
                                    await q.refetch();
                                    success("临时密码已定向发送给用户");
                                } catch (x) {
                                    setError(errorText(x));
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            发送临时密码并重置
                        </button>
                    </div>
                </div>
            )}
            {q.data?.can_approve_closure && (
                <ClosureReview api={api} ticket={q.data} refresh={() => q.refetch()}/>
            )}
            {error && <p className="error">{error}</p>}
        </section>
    );
}

export function SupportShell({
                                 api,
                                 session,
                                 onLogout,
                             }: {
    api: Api;
    session: any;
    onLogout: () => void;
}) {
    const qc = useQueryClient(),
        path = window.location.pathname,
        [position, setPosition] = useState(
            localStorage.getItem("zct_slms-nav-position") || "left",
        ),
        [navigationOpen, setNavigationOpen] = useState(false);
    const logout = async () => {
        try {
            await api("auth/logout", {}, "POST");
        } catch {
        }
        localStorage.removeItem("zct_slms-session");
        let all: any[] = [];
        try {
            all = JSON.parse(localStorage.getItem("zct_slms-accounts") || "[]");
        } catch {
        }
        localStorage.setItem(
            "zct_slms-accounts",
            JSON.stringify(all.filter((a) => a.token !== session.token)),
        );
        qc.clear();
        onLogout();
    };
    return (
        <div
            className={
                "layout nav-" + position + (navigationOpen ? " navigation-open" : "")
            }
        >
            <MobileNavigation open={navigationOpen} setOpen={setNavigationOpen}/>
            <aside className="sidebar">
                <WorkspaceBrand/>
                <nav>
                    {[
                        ["/", "支持工作台", LayoutDashboard],
                        ["/tickets", "工单系统", ClipboardList],
                        ["/review", "内容审查", ShieldCheck],
                        ["/account", "账号设置", Settings],
                    ].map(([href, label, Icon]: any) => (
                        <a
                            className={
                                (href === "/" ? path === "/" : path.startsWith(href))
                                    ? "active"
                                    : ""
                            }
                            href={href}
                            key={href}
                        >
                            <Icon size={18}/>
                            {label}
                            {href === "/tickets" && <TicketBadge api={api}/>}
                        </a>
                    ))}
                </nav>
                <div className="sidebar-bottom">
                    <ProfileControl
                        api={api}
                        session={session}
                        position={position}
                        setPosition={(v) => {
                            setPosition(v);
                            localStorage.setItem("zct_slms-nav-position", v);
                        }}
                        onAdd={() => {
                            window.location.assign("/?accounts=1&add=1");
                        }}
                        onSwitch={(s) => {
                            localStorage.setItem("zct_slms-session", JSON.stringify(s));
                            window.location.assign("/");
                        }}
                        onLogout={logout}
                    />
                </div>
            </aside>
            <main>
                <div className="content">
                    <SecondMethodBanner api={api}/>
                    {path.startsWith("/account") ? (
                        <AccountSettings api={api} session={session} onLogout={onLogout}/>
                    ) : path === "/review" ? (
                        <ReviewPage api={api}/>
                    ) : path === "/tickets" ? (
                        <TicketsPage api={api} role="SUPPORT"/>
                    ) : (
                        <SupportDashboard api={api}/>
                    )}
                </div>
                <div className="footer fixed-footer">© ZCT-SLMS</div>
            </main>
        </div>
    );
}

export function TicketBadge({api}: { api: Api }) {
    const q = useQuery({
        queryKey: ["ticket-dashboard"],
        queryFn: () => api<any>("tickets/dashboard"),
        refetchInterval: 30000,
    });
    return q.data?.unread_messages > 0 ? (
        <span className="unread-badge">
      {q.data.unread_messages > 99 ? "99+" : q.data.unread_messages}
    </span>
    ) : null;
}

function SupportDashboard({api}: { api: Api }) {
    const q = useQuery({
        queryKey: ["ticket-dashboard"],
        queryFn: () => api<any>("tickets/dashboard"),
        refetchInterval: 30000,
    });
    return (
        <div className="portal-page support-dashboard">
            <div className="page-heading">
                <div>
                    <h1>支持工作台</h1>
                    <p>待处理工单与服务情况</p>
                </div>
                <button className="secondary" onClick={() => void q.refetch()}>
                    <RefreshCw size={15}/>
                    刷新
                </button>
            </div>
            {q.isError && <p className="error">{errorText(q.error)}</p>}
            <div className="stats">
                {["FORGOT", "ACCOUNT", "GENERAL", "UNBIND", "VIOLATION", "CLOSURE"].map(
                    (type) => (
                        <a
                            className="stat panel"
                            href={"/tickets?category=" + type}
                            key={type}
                        >
                            <span>{ticketType(type)}</span>
                            <strong>
                                {type === "UNBIND"
                                    ? (q.data?.pending_types?.PASSKEY || 0) +
                                    (q.data?.pending_types?.SECURITY || 0)
                                    : q.data?.pending_types?.[type] || 0}
                            </strong>
                            <small>待处理</small>
                        </a>
                    ),
                )}
            </div>
            <section className="panel management-card">
                <h2>近14天工单</h2>
                <div style={{height: 300, width: "100%", minWidth: 0}}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={(q.data?.days || []).map((d: any) => ({
                                ...d,
                                label: new Date(d.day * 1000).toLocaleDateString("zh-CN", {
                                    month: "numeric",
                                    day: "numeric",
                                }),
                            }))}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#edf0f6"/>
                            <XAxis dataKey="label"/>
                            <YAxis allowDecimals={false}/>
                            <Tooltip/>
                            <Legend/>
                            <Line
                                name="累计总工单"
                                animationDuration={300}
                                dataKey="total"
                                stroke="#7869e9"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                name="已处理工单"
                                animationDuration={300}
                                dataKey="resolved"
                                stroke="#39ae96"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </section>
        </div>
    );
}
