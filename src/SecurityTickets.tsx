// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {TicketEditor} from "./TicketMarkdown";
import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Dialog} from "./Extras";
import {CustomSelect} from "./Select";
import {HelpTip} from "./Help";

export const securityNames: Record<string, string> = {
    email: "邮箱",
    phone: "手机号",
    microsoft: "Microsoft",
    github: "GitHub",
    google: "Google",
    telegram: "Telegram",
    gitlab: "GitLab",
    discord: "Discord",
    totp: "动态令牌",
    passkey: "全部通行密钥",
    recovery: "恢复码",
};
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;

export function SecurityTicketRequest({
                                          api,
                                          method = "",
                                          inline = false,
                                      }: {
    api: Api;
    method?: string;
    inline?: boolean;
}) {
    const qc = useQueryClient(),
        [open, setOpen] = useState(false),
        [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    const q = useQuery({
        queryKey: ["security-ticket-targets"],
        queryFn: () => api<any[]>("tickets/security-targets"),
        enabled: open,
    });
    const targets = (q.data || []).filter((t) => !method || t.method === method);
    return (
        <>
            <div className={inline ? "security-ticket-inline" : "form-actions"}>
                <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                        setError("");
                        setOpen(true);
                    }}
                >
                    通过工单解绑或重置
                </button>

            </div>
            {open && (
                <Dialog
                    title="账号安全申请"
                    close={() => {
                        if (!busy) setOpen(false);
                    }}
                >
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const data = new FormData(e.currentTarget);
                            setBusy(true);
                            setError("");
                            try {
                                const selected = String(data.get("security_method"));
                                await api(
                                    "tickets/create",
                                    {
                                        category: "SECURITY",
                                        security_method: selected,
                                        security_action: String(data.get("security_action")),
                                        title: "账号安全申请：" + securityNames[selected],
                                        body: String(data.get("body")),
                                    },
                                    "POST",
                                );
                                await qc.invalidateQueries({queryKey: ["tickets"]});
                                setOpen(false);
                                window.dispatchEvent(
                                    new CustomEvent("zct_slms:success", {
                                        detail: "安全工单已提交，等待核验",
                                    }),
                                );
                            } catch (x) {
                                setError((x as Error).message);
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        <div className="form-actions">
                            <HelpTip title="解绑工单">
                                <p>
                                    仅处理申请中选择的登录方式。人工核验账号归属后执行，旧会话将失效。重置会先移除旧绑定，随后由本人重新绑定；新的密钥和恢复码不会展示给工作人员。无法登录时可从“忘记密码”的解绑工单入口提交。
                                </p>
                            </HelpTip>
                        </div>
                        {q.isPending ? (
                            <p className="muted">正在获取已绑定方式…</p>
                        ) : targets.length ? (
                            <>
                                <label>
                                    处理方式
                                    <CustomSelect
                                        name="security_method"
                                        defaultValue={targets[0].method}
                                        options={targets.map((t) => ({
                                            value: t.method,
                                            label: securityNames[t.method],
                                        }))}
                                    />
                                </label>
                                <label>
                                    申请操作
                                    <CustomSelect
                                        name="security_action"
                                        defaultValue="RESET"
                                        options={[
                                            {value: "RESET", label: "重置（移除后重新设置）"},
                                            {value: "UNBIND", label: "解除绑定"},
                                        ]}
                                    />
                                </label>
                                <label>
                                    申请说明与账号归属材料
                                    <TicketEditor
                                        name="body"
                                        rows={6}
                                        minLength={10}
                                        maxLength={8000}
                                        placeholder="说明遇到的问题和能够核验账号归属的信息，请勿填写密码或密钥。"
                                        required
                                    />
                                </label>
                                <div className="form-actions">
                                    <button className="primary" disabled={busy}>
                                        提交申请
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p className="muted">没有可处理的已绑定方式。</p>
                        )}
                        {(error || q.isError) && (
                            <p className="error">{error || (q.error as Error).message}</p>
                        )}
                    </form>
                </Dialog>
            )}
        </>
    );
}
