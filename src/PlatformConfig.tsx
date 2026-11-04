// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {useEffect, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CustomSelect, Toggle} from "./Select";
import {Dialog} from "./Extras";
import {HelpTip} from "./Help";

type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
type Field = {
    path: string;
    label: string;
    type: string;
    value: string | number | boolean;
    options: string;
    min: number;
    max: number;
    configured?: boolean;
};
const groups: Record<string, string> = {
    server: "服务监听",
    database: "数据库",
    security: "会话与密钥",
    rate_limit: "限流与锁定",
    logging: "日志",
};

export function PlatformConfig({api}: { api: Api }) {
    const qc = useQueryClient(),
        query = useQuery({
            queryKey: ["platform-config"],
            queryFn: () =>
                api<{ path: string; fields: Field[]; database_backends?: string[] }>(
                    "admin/platform-config",
                ),
        });
    const [values, setValues] = useState<Record<string, any>>({}),
        [group, setGroup] = useState("logging"),
        [confirm, setConfirm] = useState(false),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    useEffect(() => {
        if (query.data)
            setValues(
                Object.fromEntries(query.data.fields.map((f) => [f.path, f.value])),
            );
    }, [query.data]);

    async function save() {
        setBusy(true);
        setError("");
        try {
            await api("admin/platform-config", {values}, "POST");
            await Promise.all([
                qc.invalidateQueries({queryKey: ["platform-config"]}),
                qc.invalidateQueries({queryKey: ["apps"]}),
                qc.invalidateQueries({queryKey: ["system-configs"]}),
            ]);
            setConfirm(false);
            window.dispatchEvent(
                new CustomEvent("zct_slms:success", {
                    detail:
                        "配置已保存；除 API 日志等级和密钥查看策略外，重启 Core 后生效",
                }),
            );
        } catch (x) {
            setError((x as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="panel management-card">
            <h2>
                运行配置{" "}
                <HelpTip title="运行配置说明">
                    直接保存到当前 Core 使用的配置文件。API
                    日志等级与密钥查看策略立即生效，其他项目重启 Core
                    后生效；保存前会保留一份 .previous 备份。
                </HelpTip>
            </h2>
            <div className="settings-tabs">
                {Object.entries(groups).map(([k, v]) => (
                    <button
                        key={k}
                        className={group === k ? "active" : ""}
                        onClick={() => setGroup(k)}
                    >
                        {v}
                    </button>
                ))}
            </div>
            {query.isError && (
                <p className="error">{(query.error as Error).message}</p>
            )}
            {group === "database" && query.data?.database_backends && (
                <p className="muted">
                    当前 Core 包含：{query.data.database_backends.join("、")}
                    。选择数据库后仅显示对应配置；应用其他数据库配置前需使用包含对应后端支持的
                    Core。
                </p>
            )}
            {query.data?.fields
                .filter(
                    (f) =>
                        f.path.startsWith(group + ".") &&
                        (group !== "database" ||
                            f.path === "database.type" ||
                            (f.path === "database.sqlite_path" &&
                                values["database.type"] === "sqlite") ||
                            f.path.startsWith("database." + values["database.type"] + ".")),
                )
                .map((f) => (
                    <div key={f.path} className="setting-row">
                        <label style={{flex: 1}}>
                            {f.label}
                            {f.type !== "bool" &&
                                (f.type === "select" ? (
                                    <CustomSelect
                                        value={String(values[f.path] ?? "")}
                                        options={f.options
                                            .split(",")
                                            .map((value) => ({value, label: value}))}
                                        onChange={(v) => setValues((d) => ({...d, [f.path]: v}))}
                                    />
                                ) : (
                                    <input
                                        type={
                                            f.type === "number"
                                                ? "number"
                                                : f.type === "password"
                                                    ? "password"
                                                    : "text"
                                        }
                                        value={values[f.path] ?? ""}
                                        min={f.min}
                                        max={f.max}
                                        placeholder={f.configured ? "已配置，留空保留" : ""}
                                        onChange={(e) =>
                                            setValues((d) => ({
                                                ...d,
                                                [f.path]:
                                                    f.type === "number"
                                                        ? Number(e.target.value)
                                                        : e.target.value,
                                            }))
                                        }
                                    />
                                ))}
                        </label>
                        {f.type === "bool" && (
                            <Toggle
                                label={f.label}
                                checked={!!values[f.path]}
                                onChange={(v) => setValues((d) => ({...d, [f.path]: v}))}
                            />
                        )}
                    </div>
                ))}
            {group === "logging" && (
                <HelpTip title="日志过滤规则">
                    API 等级设为 DEBUG 后，INFO
                    全局过滤器会隐藏访问日志；需要查看时，将全局最低等级也改为 DEBUG
                    并重启。
                </HelpTip>
            )}
            {group === "security" && (
                <HelpTip title="密钥与访问范围说明">
                    关闭重复查看后，每个密钥仅在创建、重置或首次验证密码时展示一次。已展示过的密钥无法再次读取。
                    管理接口访问范围中，LOCAL 仅允许本机，PUBLIC 要求管理员 IP
                    位于后端白名单中。
                </HelpTip>
            )}
            {!confirm && error && <p className="error">{error}</p>}
            <div className="form-actions">
                <button
                    className="primary"
                    disabled={!query.data || busy}
                    onClick={() => {
                        setError("");
                        if (
                            query.data?.fields.some(
                                (f) =>
                                    /^(server|database)\./.test(f.path) &&
                                    String(values[f.path]) !== String(f.value),
                            )
                        )
                            setConfirm(true);
                        else void save();
                    }}
                >
                    {busy ? "保存中…" : "保存运行配置"}
                </button>
            </div>
            {confirm && (
                <Dialog title="确认保存运行配置" close={() => setConfirm(false)}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void save();
                        }}
                    >
                        <p className="muted">
                            更改端口或数据库后，请同步调整部署配置。配置文件：
                            {query.data?.path}
                        </p>
                        {error && <p className="error">{error}</p>}
                        <button className="primary" disabled={busy}>
                            {busy ? "保存中…" : "确认保存"}
                        </button>
                    </form>
                </Dialog>
            )}
        </section>
    );
}
