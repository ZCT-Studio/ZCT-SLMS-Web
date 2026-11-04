// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {ResponsiveTable} from "./ResponsiveTable";
import {ModerationPage} from "./ModerationRules";
import {BackLink} from "./BackLink";
import {HelpTip} from "./Help";
import {useEffect, useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Highlighter, RefreshCw, Search, X,} from "lucide-react";
import {CustomSelect, MultiSelect, Toggle} from "./Select";
import {Dialog} from "./Extras";

type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const success = (detail: string) =>
    window.dispatchEvent(new CustomEvent("zct_slms:success", {detail}));

export function ReviewPage({
                               api,
                               canManageRules = false,
                               initialTab = "APP",
                           }: {
    api: Api;
    canManageRules?: boolean;
    initialTab?: string;
}) {
    const [states, setStates] = useState<string[]>(["PENDING"]),
        [kind, setKind] = useState(initialTab),
        [search, setSearch] = useState(""),
        [selected, setSelected] = useState<any>(null),
        [loading, setLoading] = useState(false),
        [error, setError] = useState("");
    const q = useQuery({
        queryKey: ["support-review", states],
        queryFn: () =>
            api<any>("support/review", {
                status: states.length ? states.join(",") : "ALL",
            }),
    });
    const rows = (kind === "APP" ? q.data?.apps : q.data?.users) || [],
        filtered = rows.filter((a: any) =>
            `${a.name} ${a.username} ${a.nickname || ""} ${a.description || ""}`
                .toLowerCase()
                .includes(search.toLowerCase()),
        );
    if (selected)
        return (
            <ReviewDetail
                api={api}
                app={selected}
                close={() => {
                    setSelected(null);
                    void q.refetch();
                }}
            />
        );
    return (
        <div className="portal-page review-page">
            <div className="page-heading portal-list-heading">
                <div>
                    <h1>内容审查</h1>
                    <p>核验用户资料和应用内容，跟进审查状态。</p>
                </div>
                <button className="secondary" onClick={() => void q.refetch()}>
                    <RefreshCw size={15}/>
                    刷新
                </button>
            </div>
            <div className="settings-tabs" role="tablist" aria-label="审查对象">
                {[
                    ["APP", "应用"],
                    ["USER", "用户"],
                    ...(canManageRules ? [["FILTER", "屏蔽词过滤"]] : []),
                ].map(([v, l]) => (
                    <button
                        role="tab"
                        aria-selected={kind === v}
                        className={kind === v ? "active" : ""}
                        key={v}
                        onClick={() => setKind(v)}
                    >
                        {l}
                    </button>
                ))}
            </div>
            {kind === "FILTER" && canManageRules ? (
                <ModerationPage api={api}/>
            ) : (
                <section className="panel list-panel">
                    <div className="table-toolbar">
                        <h2>{kind === "APP" ? "应用内容" : "用户资料"}</h2>
                        <span className="muted">{filtered.length} 条记录</span>
                    </div>
                    <div className="review-filters">
                        <label className="search">
                            <Search size={16}/>
                            <input
                                aria-label="搜索审查内容"
                                placeholder={
                                    kind === "APP"
                                        ? "搜索所有者、应用名称或介绍"
                                        : "搜索用户名或昵称"
                                }
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </label>
                        <MultiSelect
                            ariaLabel="审查状态"
                            values={states}
                            onChange={setStates}
                            placeholder="全部审查状态"
                            options={[
                                {value: "PENDING", label: "待审查"},
                                {value: "REVIEWED", label: "已审查"},
                            ]}
                        />
                    </div>
                    {(error || q.isError) && (
                        <p className="error">{error || (q.error as Error).message}</p>
                    )}
                    <div className="table-scroll">
                        <ResponsiveTable>
                            <thead>
                            <tr>
                                <th>{kind === "APP" ? "应用名称" : "昵称"}</th>
                                <th>{kind === "APP" ? "所有者" : "用户名"}</th>
                                <th>审查状态</th>
                                <th>操作</th>
                            </tr>
                            </thead>
                            <tbody>
                            {!q.isError && !filtered.length && (
                                <tr>
                                    <td colSpan={4} className="empty-cell">
                                        {q.isPending
                                            ? "正在加载审查内容…"
                                            : "暂无符合条件的审查内容"}
                                    </td>
                                </tr>
                            )}
                            {filtered.map((a: any) => (
                                <tr key={`${a.type}:${a.role}:${a.id}`}>
                                    <td>
                                        <strong>
                                            {kind === "APP" ? a.name : a.nickname || a.username}
                                        </strong>
                                    </td>
                                    <td>{a.username}</td>
                                    <td>
                      <span className={"badge " + (a.flagged ? "red" : "")}>
                        {a.flagged
                            ? "命中屏蔽词"
                            : a.review_status === "REVIEWED"
                                ? "已审查"
                                : "待审查"}
                      </span>
                                    </td>
                                    <td>
                                        <button
                                            className="secondary"
                                            disabled={loading}
                                            onClick={async () => {
                                                try {
                                                    setLoading(true);
                                                    setError("");
                                                    setSelected(
                                                        await api(
                                                            "support/review/detail",
                                                            {id: a.id, type: a.type, role: a.role},
                                                            "POST",
                                                        ),
                                                    );
                                                } catch (x) {
                                                    setError((x as Error).message);
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                        >
                                            查看详情
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </ResponsiveTable>
                    </div>
                </section>
            )}
        </div>
    );
}

type Mark = { field: string; hash: string; quote: string; label: string };

function ReviewDetail({
                          api,
                          app,
                          close,
                      }: {
    api: Api;
    app: any;
    close: () => void;
}) {
    const root = useRef<HTMLDivElement>(null),
        qc = useQueryClient(),
        [candidate, setCandidate] = useState<Mark | null>(null),
        [marks, setMarks] = useState<Mark[]>([]),
        [reason, setReason] = useState(""),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    const isText = (f: any) =>
        f.markable ??
        (["name", "description", "username", "notice"].includes(f.key) ||
            (f.key.startsWith("version:") && !f.key.endsWith(":release_time")));
    const display = (f: any) => {
        if (f.key === "binding_mode")
            return (
                (
                    {
                        NONE: "无",
                        IP: "IP",
                        DEVICE: "设备",
                        IP_AND_DEVICE: "设备和IP",
                    } as any
                )[f.text] || f.text
            );
        if (f.key === "dec_mode")
            return (
                (
                    {
                        NONE: "无",
                        HEX: "十六进制",
                        BASE64: "Base64",
                        "AES128-GCM": "AES-128-GCM",
                        "AES256-GCM": "AES-256-GCM",
                        "CHACHA20-POLY1305": "ChaCha20-Poly1305",
                    } as any
                )[f.text] || f.text
            );
        if (f.key === "sign_enable") return f.text === "1" ? "开启" : "关闭";
        if (f.key === "status") return f.text === "1" ? "启用" : "禁用";
        if (
            f.key === "created_at" ||
            f.key === "updated_at" ||
            f.key.endsWith(":release_time")
        )
            return Number(f.text) > 0
                ? new Date(Number(f.text) * 1000).toLocaleString()
                : "—";
        return f.text || "—";
    };

    function select() {
        const s = window.getSelection();
        if (!s || s.isCollapsed) return;
        const anchor =
                s.anchorNode instanceof Element
                    ? s.anchorNode
                    : s.anchorNode?.parentElement,
            focus =
                s.focusNode instanceof Element
                    ? s.focusNode
                    : s.focusNode?.parentElement;
        const a = anchor?.closest("[data-review-field]"),
            b = focus?.closest("[data-review-field]");
        if (!a || a !== b || !root.current?.contains(a)) return;
        const field = app.fields.find(
            (f: any) => f.key === a.getAttribute("data-review-field"),
        );
        const quote = s.toString().trim();
        if (
            field &&
            isText(field) &&
            quote &&
            new TextEncoder().encode(quote).length <= 1000 &&
            field.text.includes(quote)
        )
            setCandidate({
                field: field.key,
                hash: field.hash,
                quote,
                label: field.label,
            });
    }

    useEffect(() => {
        document.addEventListener("selectionchange", select);
        return () => document.removeEventListener("selectionchange", select);
    }, [app]);

    function highlight(text: string, field: string) {
        const quotes = marks
            .filter((m) => m.field === field)
            .map((m) => m.quote)
            .sort((a, b) => b.length - a.length);
        if (!quotes.length) return text || "—";
        const re = new RegExp(
            "(" +
            quotes.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
            ")",
            "g",
        );
        return text
            .split(re)
            .map((part, i) =>
                quotes.includes(part) ? <mark key={i}>{part}</mark> : part,
            );
    }

    return (
        <div className="portal-page" ref={root}>
            <div className="setting-row">
                <BackLink onClick={close}>返回审查列表</BackLink>
                <strong>{app.name}</strong>
            </div>
            <div className="review-mark-toolbar">
                <button
                    className="primary"
                    disabled={busy || !!marks.length || app.review_status === "REVIEWED"}
                    onClick={async () => {
                        try {
                            setBusy(true);
                            setError("");
                            await api(
                                "support/review/approve",
                                {
                                    id: app.id,
                                    type: app.type || "APP",
                                    role: app.role || "USER",
                                    revision: app.revision,
                                },
                                "POST",
                            );
                            success("审查已通过；内容修改后将重新待审");
                            close();
                        } catch (x) {
                            setError((x as Error).message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    {app.review_status === "REVIEWED" ? "已审查通过" : "审查通过"}
                </button>
                <button
                    className="secondary"
                    disabled={!candidate || busy || marks.length >= 30}
                    onClick={() => {
                        if (
                            candidate &&
                            !marks.some(
                                (m) =>
                                    m.field === candidate.field && m.quote === candidate.quote,
                            )
                        )
                            setMarks([...marks, candidate]);
                        setCandidate(null);
                        window.getSelection()?.removeAllRanges();
                    }}
                >
                    <Highlighter size={16}/>
                    标记选中文字
                </button>
                <HelpTip title="使用方法">
                    <p>
                        选择下方只读文字，点击标记后提交违规工单。手机可长按选中文字。这里只提供内容查看与标记，处置操作由管理员在工单中核验执行。
                    </p>
                </HelpTip>
            </div>
            {app.fields.map((f: any) => (
                <section className="panel management-card" key={f.key}>
                    <h3>{f.label}</h3>
                    {f.key === "avatar" && (
                        <>
                            {/^data:image\/(png|jpeg|webp);base64,/.test(
                                app.avatar || "",
                            ) && (
                                <img
                                    className="review-avatar"
                                    src={app.avatar}
                                    alt="待审头像"
                                />
                            )}
                            <button
                                className="secondary review-avatar-mark"
                                disabled={busy || marks.some((m) => m.field === "avatar")}
                                onClick={() =>
                                    setMarks([
                                        ...marks,
                                        {
                                            field: "avatar",
                                            label: f.label,
                                            hash: f.hash,
                                            quote: "[头像违规]",
                                        },
                                    ])
                                }
                            >
                                [头像违规]
                            </button>
                        </>
                    )}
                    {f.key !== "avatar" && (
                        <div
                            tabIndex={0}
                            className="review-readable"
                            data-review-field={isText(f) ? f.key : undefined}
                            onMouseUp={select}
                            onTouchEnd={select}
                            onKeyUp={select}
                        >
                            {isText(f) ? highlight(f.text, f.key) : display(f)}
                        </div>
                    )}
                </section>
            ))}
            <section className="panel management-card">
                <h2>已标记 {marks.length} 处</h2>
                {marks.map((m, i) => (
                    <div className="review-mark" key={m.field + m.quote}>
                        <div>
                            <strong>{m.label}</strong>
                            <blockquote>{m.quote}</blockquote>
                        </div>
                        <button
                            className="icon-button"
                            aria-label="移除标记"
                            onClick={() => setMarks(marks.filter((_, index) => index !== i))}
                        >
                            <X size={16}/>
                        </button>
                    </div>
                ))}
                <label>
                    补充说明
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={1500}
                        rows={4}
                    />
                </label>
                {error && <p className="error">{error}</p>}
                <div className="form-actions">
                    <button
                        className="primary"
                        disabled={busy || !marks.length}
                        onClick={async () => {
                            try {
                                setBusy(true);
                                setError("");
                                await api(
                                    "support/review/report",
                                    {
                                        app_id: app.id,
                                        id: app.id,
                                        type: app.type || "APP",
                                        role: app.role || "USER",
                                        marks,
                                        reason,
                                    },
                                    "POST",
                                );
                                await qc.invalidateQueries({queryKey: ["tickets"]});
                                await qc.invalidateQueries({queryKey: ["ticket-dashboard"]});
                                setMarks([]);
                                setReason("");
                                success("违规工单已提交，可在工单系统查看");
                            } catch (x) {
                                setError((x as Error).message);
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        提交违规工单
                    </button>
                </div>
            </section>
        </div>
    );
}

export function ViolationActions({
                                     api,
                                     id,
                                     username,
                                     ownerRole = "USER",
                                     refetch,
                                 }: {
    api: Api;
    id: string;
    username: string;
    ownerRole?: string;
    refetch: () => Promise<any>;
}) {
    const [action, setAction] = useState("WARN"),
        [reason, setReason] = useState(""),
        [reviewed, setReviewed] = useState(false),
        [confirm, setConfirm] = useState(false),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false),
        [typed, setTyped] = useState("");
    return (
        <section className="ticket-reset">
            <h3>违规处置</h3>
            <label>
                处理方式
                <CustomSelect
                    value={action}
                    onChange={setAction}
                    options={[
                        {value: "WARN", label: "发送账号警告邮件"},
                        ...(ownerRole === "SUBUSER"
                            ? []
                            : [{value: "BAN", label: "封禁账号及所属应用"}]),
                        {value: "DELETE", label: "删除账号及全部关联数据"},
                    ]}
                />
            </label>
            <label>
                处理原因
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    maxLength={2000}
                />
            </label>
            <div className="setting-row">
                <strong>已核验违规证据与账号归属</strong>
                <Toggle
                    label="已核验违规证据与账号归属"
                    checked={reviewed}
                    onChange={setReviewed}
                />
            </div>
            <div className="form-actions">
                <button
                    className="danger-button"
                    disabled={!reviewed || !reason.trim()}
                    onClick={() => {
                        setTyped("");
                        setError("");
                        setConfirm(true);
                    }}
                >
                    确认处理
                </button>
            </div>
            {confirm && (
                <Dialog
                    title="确认违规处置"
                    close={() => {
                        if (!busy) setConfirm(false);
                    }}
                >
                    <p>
                        将对账号 <strong>{username}</strong> 执行
                        {action === "DELETE"
                            ? "永久删除账号及全部关联数据"
                            : action === "BAN"
                                ? "封禁账号及所属应用"
                                : "发送警告邮件"}
                        。
                    </p>
                    {action === "DELETE" && (
                        <label>
                            输入完整用户名确认
                            <input
                                value={typed}
                                onChange={(e) => setTyped(e.target.value)}
                                autoComplete="off"
                            />
                        </label>
                    )}
                    {error && <p className="error">{error}</p>}
                    <div className="form-actions">
                        <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => setConfirm(false)}
                        >
                            取消
                        </button>
                        <button
                            className="danger-button"
                            disabled={busy || (action === "DELETE" && typed !== username)}
                            onClick={async () => {
                                try {
                                    setBusy(true);
                                    setError("");
                                    await api(
                                        "admin/review/action",
                                        {
                                            id,
                                            action,
                                            reason,
                                            reviewed: "1",
                                            confirm_username: typed,
                                        },
                                        "POST",
                                    );
                                    setConfirm(false);
                                    await refetch();
                                    success(
                                        action === "WARN"
                                            ? "警告邮件已加入发送队列"
                                            : "违规处置已完成",
                                    );
                                } catch (x) {
                                    setError((x as Error).message);
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            授权并执行
                        </button>
                    </div>
                </Dialog>
            )}
        </section>
    );
}
