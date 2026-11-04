// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {ResponsiveTable} from "./ResponsiveTable";
import {useEffect, useMemo, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Pencil, Search} from "lucide-react";
import {AppDanger, Dialog} from "./Extras";
import {EncodingSettings} from "./ApplicationViews";
import {HeartbeatSettings} from "./Heartbeat";
import {AccountActions} from "./AccountActions";
import {CustomSelect, Toggle} from "./Select";

type App = {
    id?: number;
    description: string;
    status: string;
    created_at: number;
    creator: string;
    appid: string;
    name: string;
    binding_mode: string;
    dec_mode?: string;
    sign_enable?: number;
    notice?: string;
};
type Api = <T>(
    p: string,
    b?: Record<string, string | number>,
    m?: string,
) => Promise<T>;
type Props = {
    api: Api;
    apps: App[];
    current: string;
    setCurrent: (s: string) => void;
    role: string;
    onLogout: () => void;
    hideSelector?: boolean;
};
type Field = {
    name: string;
    label: string;
    type?: string;
    options?: { value: string; label: string }[];
    required?: boolean;
    value?: string;
};

function Form({
                  title,
                  fields,
                  submit,
                  label = "保存",
              }: {
    title: string;
    fields: Field[];
    submit: (v: Record<string, string>) => Promise<void>;
    label?: string;
}) {
    const [pending, setPending] = useState(false),
        [error, setError] = useState("");
    return (
        <section className="panel management-card">
            <h2>{title}</h2>
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                        setPending(true);
                        setError("");
                        await submit(
                            Object.fromEntries(
                                new FormData(e.currentTarget).entries(),
                            ) as Record<string, string>,
                        );
                        window.dispatchEvent(
                            new CustomEvent("zct_slms:success", {detail: "操作成功"}),
                        );
                    } catch (x) {
                        setError((x as Error).message);
                    } finally {
                        setPending(false);
                    }
                }}
            >
                {fields.map((f) => (
                    <label key={f.name}>
                        {f.label}
                        {f.options ? (
                            <CustomSelect
                                name={f.name}
                                defaultValue={f.value ?? f.options[0]?.value}
                                options={f.options}
                            />
                        ) : f.type === "textarea" ? (
                            <textarea
                                name={f.name}
                                rows={5}
                                defaultValue={f.value || ""}
                                required={f.required}
                            />
                        ) : (
                            <input
                                name={f.name}
                                type={f.type || "text"}
                                required={f.required}
                                defaultValue={f.value}
                            />
                        )}
                    </label>
                ))}
                {error && <p className="error">{error}</p>}
                <button className="primary" disabled={pending}>
                    {pending ? "处理中…" : label}
                </button>
            </form>
        </section>
    );
}

export function Management({
                               api,
                               apps,
                               current,
                               setCurrent,
                               role,
                               hideSelector,
                           }: Props) {
    const qc = useQueryClient(),
        [page, setPage] = useState("binding"),
        [sign, setSign] = useState(false),
        [latest, setLatest] = useState("");
    const users = useQuery({
        queryKey: ["users"],
        queryFn: () =>
            api<
                {
                    id: number;
                    username: string;
                    display_name: string;
                    balance: number;
                    status: number;
                    created_at: number;
                }[]
            >("admin/owner/list"),
        enabled: role === "ADMIN",
    });
    const channels = useQuery({
        queryKey: ["channels", current],
        queryFn: () =>
            api<{ channels: { channel: string; latest_version?: string }[] }>(
                "app/channel/list",
                {appid: current},
            ),
        enabled: !!current && role !== "ADMIN",
    });
    const post = async (p: string, b: Record<string, string | number>) => {
        await api(p, b, "POST");
        await qc.invalidateQueries();
    };
    const currentApp = apps.find((a) => a.appid === current);
    const [signBusy, setSignBusy] = useState(false),
        [signError, setSignError] = useState("");
    useEffect(() => {
        const f = () => {
            setDialogError("");
            setCreateOpen(true);
        };
        window.addEventListener("zct_slms:create-user", f);
        return () => window.removeEventListener("zct_slms:create-user", f);
    }, []);
    const [search, setSearch] = useState(""),
        [createOpen, setCreateOpen] = useState(false),
        [balance, setBalance] = useState<{
            id: number;
            username: string;
            balance: number;
        } | null>(null),
        [dialogError, setDialogError] = useState("");
    const rows = useMemo(
        () =>
            (users.data || []).filter((u) =>
                `${u.id} ${u.username} ${u.display_name}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
            ),
        [users.data, search],
    );
    if (role === "ADMIN")
        return (
            <>
                <section className="panel">
                    <div className="table-toolbar">
                        <div className="user-toolbar">
                            <div className="search">
                                <Search size={16}/>
                                <input
                                    placeholder="搜索 UID、用户名、昵称"
                                    aria-label="搜索用户"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    {users.isError && (
                        <p className="error table-error">
                            {(users.error as Error).message}
                        </p>
                    )}
                    <div className="table-scroll">
                        <ResponsiveTable>
                            <thead>
                            <tr>
                                <th>UID</th>
                                <th>用户名</th>
                                <th>昵称</th>
                                <th>余额</th>
                                <th>状态</th>
                                <th>创建时间</th>
                                <th>操作</th>
                            </tr>
                            </thead>
                            <tbody>
                            {rows.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.id}</td>
                                    <td>{u.username}</td>
                                    <td>{u.display_name || "—"}</td>
                                    <td>
                      <span className="balance-edit">
                        {u.balance === -1 ? "不限额" : u.balance}
                          <button
                              className="icon-button"
                              aria-label={`修改 ${u.username} 的余额`}
                              onClick={() => {
                                  setDialogError("");
                                  setBalance({
                                      id: u.id,
                                      username: u.username,
                                      balance: u.balance,
                                  });
                              }}
                          >
                          <Pencil size={14}/>
                        </button>
                      </span>
                                    </td>
                                    <td>{u.status === 1 ? "正常" : "停用"}</td>
                                    <td>
                                        {new Date(u.created_at * 1000).toLocaleDateString(
                                            "zh-CN",
                                        )}
                                    </td>
                                    <td>
                                        <AccountActions api={api} user={u} role="USER"/>
                                    </td>
                                </tr>
                            ))}
                            {!users.isError && !rows.length && (
                                <tr>
                                    <td colSpan={7} className="empty-cell">
                                        {users.isLoading
                                            ? "正在加载用户…"
                                            : search
                                                ? "没有符合条件的用户"
                                                : "暂无用户"}
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </ResponsiveTable>
                    </div>
                </section>
                {createOpen && (
                    <Dialog title="新建用户" close={() => setCreateOpen(false)}>
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const f = new FormData(e.currentTarget);
                                try {
                                    setDialogError("");
                                    await post("admin/owner/create", {
                                        username: String(f.get("username")),
                                        password: String(f.get("password")),
                                        display_name: String(f.get("display_name")),
                                    });
                                    setCreateOpen(false);
                                } catch (x) {
                                    setDialogError((x as Error).message);
                                }
                            }}
                        >
                            <label>
                                用户名
                                <input name="username" required/>
                            </label>
                            <label>
                                初始密码
                                <input
                                    name="password"
                                    type="password"
                                    minLength={12}
                                    required
                                />
                            </label>
                            <label>
                                昵称
                                <input name="display_name"/>
                            </label>
                            {dialogError && <p className="error">{dialogError}</p>}
                            <button className="primary">创建用户</button>
                        </form>
                    </Dialog>
                )}
                {balance && (
                    <Dialog
                        title={`修改 ${balance.username} 的余额`}
                        close={() => setBalance(null)}
                    >
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                try {
                                    setDialogError("");
                                    await post("admin/owner/balance", {
                                        user_id: balance.id,
                                        balance: String(
                                            new FormData(e.currentTarget).get("balance"),
                                        ),
                                    });
                                    setBalance(null);
                                } catch (x) {
                                    setDialogError((x as Error).message);
                                }
                            }}
                        >
                            <label>
                                余额（-1 表示不限额）
                                <input
                                    name="balance"
                                    type="number"
                                    min={-1}
                                    defaultValue={balance.balance}
                                    required
                                />
                            </label>
                            {dialogError && <p className="error">{dialogError}</p>}
                            <button className="primary">保存余额</button>
                        </form>
                    </Dialog>
                )}
            </>
        );
    const appOptions = apps.map((a) => ({value: a.appid, label: a.name})),
        channelOptions = ["release", "beta", "alpha"].map((x) => ({
            value: x,
            label: x,
        }));
    return (
        <>
            {!hideSelector && (
                <div className="management-selector">
                    <label>
                        选择应用
                        <CustomSelect
                            value={current}
                            onChange={setCurrent}
                            options={appOptions}
                        />
                    </label>
                </div>
            )}
            {!current ? (
                <div className="panel management-card">请先选择应用。</div>
            ) : (
                <>
                    <div className="settings-tabs">
                        {[
                            ["binding", "绑定与安全"],
                            ["notice", "公告"],
                            ["version", "版本通道"],
                            ["heartbeat", "心跳验证"],
                            ["operations", "应用操作"],
                        ].map(([v, l]) => (
                            <button
                                key={v}
                                className={page === v ? "active" : ""}
                                onClick={() => setPage(v)}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                    <div className="management-grid">
                        {page === "operations" && apps.find((a) => a.appid === current) && (
                            <AppDanger
                                api={api}
                                app={apps.find((a) => a.appid === current)!}
                            />
                        )}
                        {page === "binding" && (
                            <>
                                <Form
                                    key={current + ":" + currentApp?.binding_mode}
                                    title="绑定方式"
                                    fields={[
                                        {
                                            name: "binding_mode",
                                            label: "绑定模式",
                                            value: currentApp?.binding_mode,
                                            options: [
                                                {value: "NONE", label: "无"},
                                                {value: "IP", label: "IP"},
                                                {value: "DEVICE", label: "设备"},
                                                {value: "IP_AND_DEVICE", label: "设备和 IP"},
                                            ],
                                        },
                                    ]}
                                    submit={(v) => post("app/binding", {app_id: current, ...v})}
                                />
                                <section className="panel management-card">
                                    <h2>请求签名</h2>
                                    <div className="setting-row">
                                        <div>
                                            <strong>签名校验</strong>
                                            <small>
                                                {currentApp?.sign_enable === undefined
                                                    ? "更新 Core 后可读取当前状态"
                                                    : currentApp.sign_enable
                                                        ? "已启用"
                                                        : "已关闭"}
                                            </small>
                                        </div>
                                        <Toggle
                                            label="请求签名"
                                            checked={!!currentApp?.sign_enable}
                                            disabled={
                                                signBusy || currentApp?.sign_enable === undefined
                                            }
                                            onChange={async (next) => {
                                                try {
                                                    setSignBusy(true);
                                                    setSignError("");
                                                    await post("app/sign-enable", {
                                                        app_id: current,
                                                        sign_enable: next ? "1" : "0",
                                                    });
                                                    window.dispatchEvent(
                                                        new CustomEvent("zct_slms:success", {
                                                            detail: "签名设置已保存",
                                                        }),
                                                    );
                                                } catch (x) {
                                                    setSignError((x as Error).message);
                                                } finally {
                                                    setSignBusy(false);
                                                }
                                            }}
                                        />
                                    </div>
                                    {signError && <p className="error">{signError}</p>}
                                </section>
                                <EncodingSettings
                                    api={api}
                                    current={current}
                                    currentMode={currentApp?.dec_mode}
                                />
                            </>
                        )}
                        {page === "heartbeat" && (
                            <HeartbeatSettings api={api} current={current}/>
                        )}
                        {page === "notice" &&
                            (currentApp?.notice === undefined ? (
                                <section className="panel management-card">
                                    当前 Core 未返回公告内容，请更新 Core
                                    后编辑，避免覆盖现有公告。
                                </section>
                            ) : (
                                <Form
                                    key={current + ":" + currentApp?.notice}
                                    title="更新应用公告"
                                    fields={[
                                        {
                                            name: "notice",
                                            label: "公告内容",
                                            type: "textarea",
                                            value: currentApp?.notice,
                                        },
                                    ]}
                                    submit={(v) => post("app/notice", {app_id: current, ...v})}
                                />
                            ))}{" "}
                        {page === "version" && (
                            <>
                                <Form
                                    title="发布版本"
                                    fields={[
                                        {name: "channel", label: "通道", options: channelOptions},
                                        {name: "version", label: "版本号", required: true},
                                        {
                                            name: "download_url",
                                            label: "下载地址",
                                            type: "url",
                                            required: true,
                                        },
                                        {name: "file_hash", label: "文件哈希"},
                                        {
                                            name: "hash_algorithm",
                                            label: "哈希算法",
                                            options: ["SHA256", "SHA512", "MD5"].map((x) => ({
                                                value: x,
                                                label: x,
                                            })),
                                        },
                                        {name: "minimum_version", label: "最低版本"},
                                        {name: "changelog", label: "更新说明"},
                                    ]}
                                    submit={(v) =>
                                        post("app/version/create", {app_id: current, ...v})
                                    }
                                    label="发布版本"
                                />
                                <section className="panel management-card">
                                    <h2>版本通道</h2>
                                    <p className="muted">
                                        {channels.data?.channels
                                            ?.filter((c) =>
                                                ["release", "beta", "alpha"].includes(c.channel),
                                            )
                                            .map(
                                                (c) =>
                                                    `${c.channel}${c.latest_version ? " · " + c.latest_version : ""}`,
                                            )
                                            .join("、") || "暂无版本"}
                                    </p>
                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            try {
                                                setLatest(
                                                    JSON.stringify(
                                                        await api("app/version/latest", {
                                                            appid: current,
                                                            channel: String(
                                                                new FormData(e.currentTarget).get("channel"),
                                                            ),
                                                        }),
                                                        null,
                                                        2,
                                                    ),
                                                );
                                            } catch (x) {
                                                setLatest((x as Error).message);
                                            }
                                        }}
                                    >
                                        <label>
                                            查询通道
                                            <CustomSelect
                                                name="channel"
                                                defaultValue="release"
                                                options={channelOptions}
                                            />
                                        </label>
                                        <button className="secondary">查看最新版本</button>
                                    </form>
                                    {latest && <pre className="result">{latest}</pre>}
                                </section>
                            </>
                        )}
                    </div>
                </>
            )}
        </>
    );
}

export function Account() {
    return null;
}
