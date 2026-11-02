import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FactorPage } from "./FactorPages";
import { IdentityAccess } from "./Identity";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
type Session = {
  user_type: string;
  user_id: number;
  username: string;
  token: string;
};
export function AccountSettings({
  api,
  session,
  onLogout,
}: {
  api: Api;
  session: Session;
  onLogout: () => void;
}) {
  const tab =
      window.location.pathname === "/account/connections"
        ? "connections"
        : "security",
    kind = window.location.pathname.split("/")[2] || "";
  return (
    <div className="account-settings">
      <div className="settings-tabs" role="tablist" aria-label="账号设置">
        {[
          ["security", "账号安全"],
          ["connections", "第三方授权"],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() =>
              window.location.assign(
                key === "connections" ? "/account/connections" : "/account",
              )
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "security" ? (
        <div role="tabpanel" className="account-security-panels">
          {kind ? (
            <FactorPage api={api} kind={kind} />
          ) : (
            <>
              <PasswordSettings
                api={api}
                session={session}
                onLogout={onLogout}
              />
              <div className="factor-links">
                {[
                  ["totp", "动态令牌", "使用验证器扫码绑定"],
                  ["passkeys", "通行密钥", "使用设备或安全密钥验证"],
                  ["recovery", "恢复码", "管理紧急恢复凭据"],
                ].map(([path, title, description]) => (
                  <a
                    className="panel management-card"
                    key={path}
                    href={"/account/" + path}
                  >
                    <h3>{title}</h3>
                    <p className="muted">{description}</p>
                    <span>管理 →</span>
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <section role="tabpanel" className="panel management-card">
          <h2>第三方授权</h2>
          {session.user_type === "USER" ? (
            <IdentityAccess api={api} bind />
          ) : (
            <p className="muted">
              第三方身份绑定目前面向用户账号；管理员和子用户请使用账号密码及已绑定的双重验证登录。
            </p>
          )}
        </section>
      )}
    </div>
  );
}
function PasswordSettings({
  api,
  session,
  onLogout,
}: {
  api: Api;
  session: Session;
  onLogout: () => void;
}) {
  const qc = useQueryClient(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="panel management-card">
      <h2>修改密码</h2>
      <p className="muted">
        修改后将退出此账号的所有登录会话，其他已添加账号保留。
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            current = "",
            password = String(f.get("password"));
          if (password !== String(f.get("confirm"))) {
            setError("两次输入的新密码不一致");
            return;
          }
          try {
            setBusy(true);
            setError("");
            if (session.user_type === "ADMIN") {
              const profile =
                qc.getQueryData<{ nickname: string; avatar: string }>([
                  "profile",
                  session.user_type,
                  session.user_id,
                ]) ||
                (await api<{ nickname: string; avatar: string }>(
                  "auth/profile",
                ));
              await api(
                "admin/account",
                {
                  current_password: current,
                  new_password: password,
                  new_username: session.username,
                  display_name: profile.nickname,
                  avatar: profile.avatar,
                },
                "POST",
              );
            } else
              await api(
                "auth/password",
                { current_password: current, new_password: password },
                "POST",
              );
            let accounts: Session[] = [];
            try {
              accounts = JSON.parse(
                sessionStorage.getItem("tcv-accounts") || "[]",
              );
            } catch {}
            sessionStorage.setItem(
              "tcv-accounts",
              JSON.stringify(
                accounts.filter(
                  (a) =>
                    a.user_type !== session.user_type ||
                    a.user_id !== session.user_id,
                ),
              ),
            );
            sessionStorage.removeItem("tcv-session");
            qc.clear();
            window.dispatchEvent(
              new CustomEvent("tcv:success", {
                detail: "密码已修改，请重新登录",
              }),
            );
            onLogout();
          } catch (x) {
            setError((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-row">
          <label>
            新密码
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={256}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            确认新密码
            <input
              name="confirm"
              type="password"
              minLength={12}
              maxLength={256}
              autoComplete="new-password"
              required
            />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "保存中…" : "修改密码"}
        </button>
      </form>
    </section>
  );
}
