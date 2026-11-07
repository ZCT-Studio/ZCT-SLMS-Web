// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {avatarUrl} from "./Network";

import {useState} from "react";
import {LoginFrame} from "./ProductUI";
import {authenticateFactors} from "./Security";
import {storeSession} from "./AuthFlows";

type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
type Session = { token: string; username: string; user_id: number; user_type: string };
const storageKey = "zct_slms-pending-signup";

export function SocialSignup({api, onLogin}: { api: Api; onLogin: (s: Session) => void }) {
    const [draft] = useState<any>(() => {
        try {
            return JSON.parse(sessionStorage.getItem(storageKey) || "null")
        } catch {
            return null
        }
    });
    const [avatar, setAvatar] = useState<string>(draft?.profile?.avatar || "");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function back() {
        if (busy) return;
        setBusy(true);
        if (draft?.setup_token) await api("auth/connect/signup", {
            setup_token: draft.setup_token,
            browser_verifier: draft.browser_verifier,
            action: "cancel"
        }, "POST").catch(() => {
        });
        sessionStorage.removeItem(storageKey);
        window.location.assign("/?accounts=1&add=1");
    }

    return <LoginFrame title="完善账号资料" links={<button type="button" onClick={back}>返回登录</button>}>
        {!draft?.setup_token ? <><p className="error">注册信息已过期，请重新登录。</p>
            <div className="form-actions">
                <button className="secondary" onClick={back}>返回登录</button>
            </div>
        </> : <>
            <p className="muted">确认并保存后才会创建账号。用户名和昵称可修改，密码可以留空。</p>
            <form onSubmit={async e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const password = String(f.get("password") || "");
                if (password !== String(f.get("confirm") || "")) {
                    setError("两次输入的密码不一致");
                    return;
                }
                try {
                    setBusy(true);
                    setError("");
                    const result = await api<Session>("auth/connect/signup", {
                        setup_token: draft.setup_token,
                        browser_verifier: draft.browser_verifier,
                        username: String(f.get("username") || ""),
                        nickname: String(f.get("nickname") || ""),
                        avatar,
                        new_password: password
                    }, "POST");
                    const session = await authenticateFactors(api, result);
                    sessionStorage.removeItem(storageKey);
                    storeSession(session);
                    onLogin(session);
                    window.location.assign("/");
                } catch (x) {
                    setError((x as Error).message)
                } finally {
                    setBusy(false)
                }
            }}>
                <label>头像<span className="avatar-upload"><span className="avatar">{avatar ?
                    <img src={avatarUrl(avatar)} referrerPolicy="no-referrer"
                         alt="预填头像"/> : "用"}</span><span>选择图片<small>PNG、JPEG、WebP</small></span><input
                    className="avatar-file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > (draft.max_avatar_bytes || 1048576)) {
                        setError("头像超过大小限制");
                        return;
                    }
                    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
                        setError("请选择 PNG、JPEG 或 WebP 图片");
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setAvatar(String(reader.result));
                    reader.readAsDataURL(file)
                }}/></span></label>
                {avatar && <div className="form-actions">
                    <button type="button" className="secondary" onClick={() => setAvatar("")}>移除头像</button>
                </div>}
                <label>用户名<input name="username" defaultValue={draft.profile?.username || ""} minLength={3}
                                    maxLength={64} pattern="[A-Za-z0-9_.-]{3,64}" autoComplete="username"
                                    required/></label>
                <label>昵称<input name="nickname" defaultValue={draft.profile?.nickname || ""} maxLength={48} required/></label>
                <label>密码（可选）<input name="password" type="password" minLength={12} maxLength={256}
                                        autoComplete="new-password"/></label>
                <label>确认密码<input name="confirm" type="password" minLength={12} maxLength={256}
                                      autoComplete="new-password"/></label>
                {error && <p className="error">{error}</p>}
                <div className="form-actions">
                    <button className="primary" disabled={busy}>{busy ? "保存中…" : "保存并继续"}</button>
                </div>
            </form>
        </>}
    </LoginFrame>;
}
