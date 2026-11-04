// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {ResponsiveTable} from "./ResponsiveTable";
import {HelpTip} from "./Help";
import {useEffect, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Copy, Download, Eye, Plus, RefreshCw, Search, Trash2,} from "lucide-react";
import {Dialog} from "./Extras";
import {MultiSelect, Toggle} from "./Select";

type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const notify = (detail: string) =>
    window.dispatchEvent(new CustomEvent("zct_slms:success", {detail}));
const date = (n: number) =>
    n === -1 ? "永久" : new Date(n * 1000).toLocaleString();

export function VoucherPage({
                                api,
                                role,
                                kind: codeKind,
                            }: {
    api: Api;
    role: string;
    kind: "INVITE" | "BALANCE";
}) {
    const qc = useQueryClient(),
        canCreate = role === "ADMIN" || (role === "USER" && codeKind === "BALANCE");
    const [tab, setTab] = useState(
            role === "ADMIN" ? "manage" : codeKind === "INVITE" ? "invite" : "redeem",
        ),
        [state, setState] = useState<string[]>([]),
        [search, setSearch] = useState(""),
        [create, setCreate] = useState(false),
        [forever, setForever] = useState(true),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [result, setResult] = useState<string[]>([]),
        [deleting, setDeleting] = useState<any>(null);
    const createKind = codeKind;
    const history = useQuery({
            queryKey: ["voucher-history", codeKind],
            queryFn: () => api<any[]>("vouchers/list", {kind: codeKind}),
            enabled: canCreate,
        }),
        status = useQuery({
            queryKey: ["voucher-status"],
            queryFn: () => api<any>("vouchers/status"),
            enabled: role !== "ADMIN",
        });
    useEffect(() => {
        if (!result.length) return;
        const id = setTimeout(() => setResult([]), 60000);
        const hide = () => {
            if (document.hidden) setResult([]);
        };
        document.addEventListener("visibilitychange", hide);
        return () => {
            clearTimeout(id);
            document.removeEventListener("visibilitychange", hide);
        };
    }, [result]);
    const statusOf = (r: any) =>
        r.used_by
            ? "USED"
            : r.expires_at !== -1 && r.expires_at < Date.now() / 1000
                ? "EXPIRED"
                : "UNUSED";
    const rows = (history.data || []).filter(
        (r) =>
            r.kind === codeKind &&
            (!state.length || state.includes(statusOf(r))) &&
            `${r.reference} ${r.amount} ${r.used_by || ""}`
                .toLowerCase()
                .includes(search.toLowerCase()),
    );

    async function refresh() {
        await Promise.all([
            history.refetch(),
            role !== "ADMIN" ? status.refetch() : Promise.resolve(),
        ]);
    }

    return (
        <div className="portal-page voucher-page">
            <div className="page-heading portal-list-heading">
                <div>
                    <h1>兑换码</h1>
                    <p>管理邀请码、余额码及兑换记录。</p>
                </div>
                {tab === "manage" && (
                    <div className="heading-actions">
                        <button className="secondary" onClick={() => void refresh()}>
                            <RefreshCw size={15}/>
                            刷新
                        </button>
                        <button
                            className="primary"
                            onClick={() => {
                                setError("");
                                setForever(true);
                                setCreate(true);
                            }}
                        >
                            <Plus size={15}/>
                            创建{codeKind === "INVITE" ? "邀请码" : "余额码"}
                        </button>
                    </div>
                )}
            </div>
            <div className="settings-tabs" role="tablist" aria-label="兑换码类型">
                {role !== "SUBUSER" && (
                    <button
                        role="tab"
                        aria-selected={codeKind === "INVITE"}
                        className={codeKind === "INVITE" ? "active" : ""}
                        onClick={() => {
                            if (codeKind !== "INVITE")
                                window.location.assign("/invite-codes");
                        }}
                    >
                        邀请码
                    </button>
                )}
                <button
                    role="tab"
                    aria-selected={codeKind === "BALANCE"}
                    className={codeKind === "BALANCE" ? "active" : ""}
                    onClick={() => {
                        if (codeKind !== "BALANCE")
                            window.location.assign("/balance-codes");
                    }}
                >
                    余额码
                </button>
            </div>
            {role === "USER" && codeKind === "BALANCE" && (
                <div className="settings-tabs">
                    <button
                        className={tab === "redeem" ? "active" : ""}
                        onClick={() => setTab("redeem")}
                    >
                        使用余额码
                    </button>
                    {role === "USER" && (
                        <>
                            <button
                                className={tab === "manage" ? "active" : ""}
                                onClick={() => setTab("manage")}
                            >
                                子用户余额码
                            </button>
                        </>
                    )}
                </div>
            )}
            {tab === "manage" ? (
                <section className="panel list-panel">
                    <div className="table-toolbar">
                        <h2>
                            {role === "ADMIN"
                                ? codeKind === "INVITE"
                                    ? "邀请码管理"
                                    : "余额码管理"
                                : "子用户余额码"}
                        </h2>
                    </div>
                    <div className="voucher-filters">
                        <label className="search">
                            <Search size={16}/>
                            <input
                                aria-label="搜索兑换码记录"
                                placeholder="搜索编号、额度或使用者ID"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </label>
                        <MultiSelect
                            ariaLabel="兑换码状态"
                            values={state}
                            onChange={setState}
                            options={[
                                {value: "UNUSED", label: "未使用"},
                                {value: "USED", label: "已使用"},
                                {value: "EXPIRED", label: "已过期"},
                            ]}
                        />
                    </div>
                    {history.isError && (
                        <p className="error table-error">
                            {(history.error as Error).message}
                        </p>
                    )}
                    <div className="table-scroll">
                        <ResponsiveTable>
                            <thead>
                            <tr>
                                {["编号", "额度", "有效期", "状态", "使用者", "操作"].map(
                                    (t) => (
                                        <th key={t}>{t}</th>
                                    ),
                                )}
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}>
                                    <td>
                                        <code>{r.reference}</code>
                                    </td>
                                    <td>{r.amount}</td>
                                    <td>{date(r.expires_at)}</td>
                                    <td>
                      <span
                          className={
                              "badge " + (statusOf(r) === "UNUSED" ? "green" : "")
                          }
                      >
                        {
                            (
                                {
                                    UNUSED: "未使用",
                                    USED: "已使用",
                                    EXPIRED: "已过期",
                                } as any
                            )[statusOf(r)]
                        }
                      </span>
                                    </td>
                                    <td>{r.used_by || "—"}</td>
                                    <td>
                                        <div className="row-actions">
                                            <button
                                                className="icon-button"
                                                aria-label="验证后查看兑换码"
                                                disabled={busy || !r.can_reveal}
                                                onClick={async () => {
                                                    try {
                                                        setBusy(true);
                                                        const d = await api<{ code: string }>(
                                                            "vouchers/reveal",
                                                            {id: r.id},
                                                            "POST",
                                                        );
                                                        setResult([d.code]);
                                                    } catch (x) {
                                                        setError((x as Error).message);
                                                    } finally {
                                                        setBusy(false);
                                                    }
                                                }}
                                            >
                                                <Eye size={16}/>
                                            </button>
                                            {!r.used_by && (
                                                <button
                                                    className="icon-button"
                                                    aria-label="删除未使用兑换码"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        setError("");
                                                        setDeleting(r);
                                                    }}
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!rows.length && (
                                <tr>
                                    <td colSpan={6} className="empty-row">
                                        {history.isPending ? "正在加载…" : "暂无符合条件的兑换码"}
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </ResponsiveTable>
                    </div>
                </section>
            ) : (
                <section className="panel management-card">
                    <h2>{tab === "invite" ? "绑定邀请码" : "使用余额码"}</h2>
                    <p className="muted">
                        {role === "SUBUSER"
                            ? `可用额度：${status.data?.quota_limit === -1 ? "不限额" : Math.max(0, (status.data?.quota_limit || 0) - (status.data?.quota_used || 0))}`
                            : `当前余额：${status.data?.balance === -1 ? "不限额" : (status.data?.balance ?? "—")}`}
                    </p>
                    {tab === "invite" && status.data?.invite_bound ? (
                        <p className="muted">此账号已绑定过邀请码。</p>
                    ) : (
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const form = e.currentTarget;
                                try {
                                    setBusy(true);
                                    setError("");
                                    await api(
                                        "vouchers/redeem",
                                        {
                                            kind: tab === "invite" ? "INVITE" : "BALANCE",
                                            code: String(new FormData(form).get("code")).trim(),
                                        },
                                        "POST",
                                    );
                                    await qc.invalidateQueries({queryKey: ["voucher-status"]});
                                    await qc.invalidateQueries({queryKey: ["license-balance"]});
                                    form.reset();
                                    notify(tab === "invite" ? "邀请码已绑定" : "余额码已使用");
                                } catch (x) {
                                    setError((x as Error).message);
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            <label>
                                {tab === "invite" ? "邀请码" : "余额码"}
                                <input
                                    name="code"
                                    minLength={64}
                                    maxLength={64}
                                    required
                                    autoComplete="off"
                                />
                            </label>
                            <div className="form-actions">
                                <button className="primary" disabled={busy}>
                                    {tab === "invite" ? "绑定邀请码" : "使用余额码"}
                                </button>
                            </div>
                        </form>
                    )}
                </section>
            )}
            {error && !create && !deleting && <p className="error">{error}</p>}
            {create && (
                <Dialog
                    title={codeKind === "INVITE" ? "创建邀请码" : "创建余额码"}
                    close={() => {
                        if (!busy) setCreate(false);
                    }}
                >
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget),
                                seconds =
                                    Number(f.get("days")) * 86400 +
                                    Number(f.get("hours")) * 3600 +
                                    Number(f.get("minutes")) * 60;
                            if (!forever && seconds <= 0) {
                                setError("有效期必须大于零");
                                return;
                            }
                            try {
                                setBusy(true);
                                setError("");
                                const d = await api<{ codes: string[] }>(
                                    "vouchers/create",
                                    {
                                        kind: createKind,
                                        count: Number(f.get("count")),
                                        amount: Number(f.get("amount")),
                                        expires_at: forever
                                            ? -1
                                            : Math.floor(Date.now() / 1000) + seconds,
                                    },
                                    "POST",
                                );
                                await history.refetch();
                                setCreate(false);
                                setResult(d.codes);
                                notify("兑换码已创建");
                            } catch (x) {
                                setError((x as Error).message);
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        <div className="form-row">
                            <label>
                                数量
                                <input
                                    name="count"
                                    type="number"
                                    min={1}
                                    max={500}
                                    defaultValue={1}
                                    required
                                />
                            </label>
                            <label>
                                {createKind === "INVITE" ? "绑定奖励余额" : "增加余额 / 额度"}
                                <input
                                    name="amount"
                                    type="number"
                                    min={createKind === "INVITE" ? 0 : 1}
                                    max={1000000000}
                                    defaultValue={1}
                                    required
                                />
                            </label>
                        </div>
                        <div className="setting-row">
                            <strong>永久有效</strong>
                            <Toggle
                                label="永久有效"
                                checked={forever}
                                onChange={setForever}
                            />
                        </div>
                        {!forever && (
                            <div className="form-row">
                                {[
                                    ["days", "天"],
                                    ["hours", "小时"],
                                    ["minutes", "分钟"],
                                ].map(([name, label]) => (
                                    <label key={name}>
                                        {label}
                                        <input
                                            name={name}
                                            type="number"
                                            min={0}
                                            max={36500}
                                            defaultValue={0}
                                        />
                                    </label>
                                ))}
                            </div>
                        )}
                        <HelpTip title="生成规则">
                            <p>
                                64位随机码，每个仅能使用一次。每位用户只能绑定一次邀请码。子用户余额码增加额度，创建卡密时才扣主用户余额。旧版仅存哈希的兑换码无法再次查看明文。
                            </p>
                        </HelpTip>
                        {error && <p className="error">{error}</p>}
                        <div className="form-actions">
                            <button
                                type="button"
                                className="secondary"
                                disabled={busy}
                                onClick={() => setCreate(false)}
                            >
                                取消
                            </button>
                            <button className="primary" disabled={busy}>
                                创建
                            </button>
                        </div>
                    </form>
                </Dialog>
            )}
            {deleting && (
                <Dialog
                    title="删除未使用的兑换码"
                    close={() => {
                        if (!busy) setDeleting(null);
                    }}
                >
                    <p>
                        删除后该兑换码立即失效。确认删除编号{" "}
                        <code>{deleting.reference}</code>？
                    </p>
                    {error && <p className="error">{error}</p>}
                    <div className="form-actions">
                        <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => setDeleting(null)}
                        >
                            取消
                        </button>
                        <button
                            className="danger-button"
                            disabled={busy}
                            onClick={async () => {
                                try {
                                    setBusy(true);
                                    await api("vouchers/delete", {id: deleting.id}, "POST");
                                    setDeleting(null);
                                    await history.refetch();
                                    notify("兑换码已删除");
                                } catch (x) {
                                    setError((x as Error).message);
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            验证并删除
                        </button>
                    </div>
                </Dialog>
            )}
            {result.length > 0 && (
                <Dialog
                    title={codeKind === "INVITE" ? "邀请码明文" : "余额码明文"}
                    close={() => setResult([])}
                >
                    <pre className="result">{result.join("\n")}</pre>
                    <div className="form-actions">
                        <button
                            className="secondary"
                            onClick={async () => {
                                await navigator.clipboard.writeText(result.join("\n"));
                                notify("已复制");
                            }}
                        >
                            <Copy size={15}/>
                            复制
                        </button>
                        <button
                            className="secondary"
                            onClick={() => {
                                const url = URL.createObjectURL(
                                    new Blob([result.join("\n")], {
                                        type: "text/plain;charset=utf-8",
                                    }),
                                );
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "兑换码.txt";
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            <Download size={15}/>
                            导出
                        </button>
                        <button className="primary" onClick={() => setResult([])}>
                            关闭
                        </button>
                    </div>
                </Dialog>
            )}
        </div>
    );
}
