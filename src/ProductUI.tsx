// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import type {ReactNode} from "react";
import {motion} from "motion/react";
import rawVersion from "../VERSION?raw";

const version = rawVersion.trim();

export function WorkspaceBrand() {
    return <>
        <div className="brand">
            <div><strong>ZCT-SLMS</strong>
                <div className="versions">Web v{version}</div>
            </div>
        </div>
        <div className="nav-divider"/>
    </>
}

export function LoginFrame({children, title = "欢迎回来", links, notice, footer = "© ZCT-SLMS"}: {
    children: ReactNode;
    title?: string;
    links?: ReactNode;
    notice?: ReactNode;
    footer?: string
}) {
    return <div className="login-page auth-login-page">
        <nav className="login-top-links">{links}</nav>
        <div className="login-brand"><span>ZCT-SLMS</span></div>
        <motion.div initial={{opacity: 0, y: 15}} animate={{opacity: 1, y: 0}} className="login-card">
            <div className="eyebrow">WELCOME BACK</div>
            <h1>{title}</h1>{notice || <p/>}{children}</motion.div>
        <div className="login-footer">{footer}</div>
    </div>
}

export function AccountRoleTabs({value, onChange}: { value: string; onChange: (value: string) => void }) {
    return <div
        className="role-tabs">{[["owner", "用户"], ["subuser", "子用户"], ["admin", "管理员/支持"]].map(([v, label]) =>
        <button type="button" className={value === v ? "active" : ""} onClick={() => onChange(v)}
                key={v}>{label}</button>)}</div>
}

export function LoginMethodTabs({value, onChange}: { value: string; onChange: (value: string) => void }) {
    return <div
        className="login-methods">{[["password", "密码"], ["passkey", "通行密钥"]].map(([v, label]) =>
        <button type="button" key={v} className={value === v ? "active" : ""}
                onClick={() => onChange(v)}>{label}</button>)}</div>
}

export function ApplicationSummary({href, name, owner, appid}: {
    href: string;
    name: string;
    owner: string;
    appid: string
}) {
    return <a className="panel app-summary" href={href}><strong>{name}</strong><span>{owner}</span><code>{appid}</code></a>
}

export function Stat({icon, label, value, hint, color, badge = "实时"}: {
    icon: ReactNode;
    label: string;
    value: number | undefined;
    hint: string;
    color: string;
    badge?: string
}) {
    return <div className="stat panel">
        <div className="stat-top">
            <div className={"stat-icon " + color}>{icon}</div>
            <span>{badge}</span></div>
        <div className="stat-label">{label}</div>
        <div className="stat-number">{value ?? "—"}</div>
        <div className="stat-hint">{hint}</div>
    </div>
}
