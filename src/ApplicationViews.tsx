import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CustomSelect, Toggle } from "./Select";
import { IdentityAdmin } from "./Identity";
import { FactorAdmin } from "./Security";
import { RecoveryPolicy } from "./Portal";
type Api = <T>(
  p: string,
  b?: Record<string, string | number>,
  m?: string,
) => Promise<T>;
export const modes = [
  { value: "NONE", label: "无" },
  { value: "BASE64", label: "Base64" },
  { value: "HEX", label: "十六进制" },
  { value: "AES128-GCM", label: "AES-128-GCM" },
  { value: "AES256-GCM", label: "AES-256-GCM" },
  { value: "CHACHA20-POLY1305", label: "ChaCha20-Poly1305" },
];
export function EncodingSettings({
  api,
  current,
}: {
  api: Api;
  current: string;
}) {
  const cfg = useQuery({
    queryKey: ["system-configs"],
    queryFn: () => api<{ allowed_encoding_modes: string }>("system/configs"),
  });
  const [mode, setMode] = useState("NONE"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const needsKey = ["AES128-GCM", "AES256-GCM", "CHACHA20-POLY1305"].includes(
    mode,
  );
  return (
    <section className="panel management-card">
      <h2>传输编码与加密</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setBusy(true);
            setError("");
            await api(
              "app/set-decode",
              {
                app_id: current,
                dec_mode: mode,
                dec_key: needsKey
                  ? String(new FormData(e.currentTarget).get("key"))
                  : "",
              },
              "POST",
            );
            window.dispatchEvent(
              new CustomEvent("tcv:success", { detail: "编码设置已保存" }),
            );
          } catch (x) {
            setError((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          编码模式
          <CustomSelect
            value={mode}
            onChange={setMode}
            options={modes.filter((m) =>
              (
                cfg.data?.allowed_encoding_modes ||
                modes.map((m) => m.value).join(",")
              )
                .split(",")
                .includes(m.value),
            )}
          />
        </label>
        {needsKey && (
          <>
            <label>
              加密密钥
              <input
                name="key"
                type="password"
                required
                pattern={
                  mode === "AES128-GCM" ? "[0-9a-fA-F]{32}" : "[0-9a-fA-F]{64}"
                }
              />
            </label>
            <p className="muted">
              {mode === "AES128-GCM"
                ? "16 字节密钥：32 位十六进制字符（0–9、a–f）。"
                : "32 字节密钥：64 位十六进制字符（0–9、a–f）。"}
            </p>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          保存
        </button>
      </form>
    </section>
  );
}
export function AppBrowser({
  apps,
}: {
  apps: {
    appid: string;
    name: string;
    owner_username?: string;
    creator: string;
  }[];
}) {
  const [pref, setPref] = useState(
    () => localStorage.getItem("tcv-app-layout") || "auto",
  );
  useEffect(() => {
    const f = () => setPref(localStorage.getItem("tcv-app-layout") || "auto");
    window.addEventListener("tcv:layout", f);
    return () => window.removeEventListener("tcv:layout", f);
  }, []);
  return (
    <div className={"app-browser view-" + pref}>
      {apps.map((a) => (
        <a
          className="panel app-summary"
          href={"/app-details?app=" + encodeURIComponent(a.appid)}
          key={a.appid}
        >
          <strong>{a.name}</strong>
          <span>
            {a.owner_username || a.creator?.replace(/\*$/, "") || "—"}
          </span>
          <code>{a.appid}</code>
        </a>
      ))}
    </div>
  );
}
export function SecuritySettings({ api }: { api: Api }) {
  const [tab, setTab] = useState("login");
  const qc = useQueryClient(),
    cfg = useQuery({
      queryKey: ["system-configs"],
      queryFn: () =>
        api<{
          owner_can_create_subuser: boolean;
          allowed_encoding_modes: string;
        }>("system/configs"),
    });
  const [error, setError] = useState("");
  async function save(path: string, body: Record<string, string | number>) {
    try {
      setError("");
      await api(path, body, "POST");
      await qc.invalidateQueries({ queryKey: ["system-configs"] });
      window.dispatchEvent(
        new CustomEvent("tcv:success", { detail: "设置已保存" }),
      );
    } catch (x) {
      setError((x as Error).message);
    }
  }
  return (
    <div className="platform-settings">
      <div className="settings-tabs security-tabs" role="tablist">
        {[
          ["login", "注册登录"],
          ["2fa", "2FA"],
          ["recovery", "账号恢复"],
          ["captcha", "人机验证"],
          ["subuser", "子用户设置"],
          ["encryption", "加密设置"],
        ].map(([key, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => {
              setTab(key);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "login" && <IdentityAdmin api={api} />}
      {tab === "recovery" && <RecoveryPolicy api={api} />}
      {(tab === "2fa" || tab === "captcha") && (
        <FactorAdmin api={api} tab={tab} />
      )}
      {tab === "subuser" && (
        <section className="panel management-card">
          <h2>权限策略</h2>
          <div className="setting-row">
            <div>
              <strong>允许应用所有者创建子用户</strong>
              <small>关闭后保留已有子用户。</small>
            </div>
            <Toggle
              checked={!!cfg.data?.owner_can_create_subuser}
              label="允许创建子用户"
              onChange={(v) =>
                save("admin/subuser-policy", { enabled: v ? "1" : "0" })
              }
            />
          </div>
        </section>
      )}
      {tab === "encryption" && (
        <section className="panel management-card">
          <h2>允许的编码与加密</h2>
          <p className="muted">
            限制后续应用配置可选择的算法；已有应用配置不自动变更。
          </p>
          {modes.map((m) => (
            <div className="setting-row" key={m.value}>
              <strong>{m.label}</strong>
              <Toggle
                label={m.label}
                checked={(
                  cfg.data?.allowed_encoding_modes ||
                  modes.map((m) => m.value).join(",")
                )
                  .split(",")
                  .includes(m.value)}
                onChange={(v) => {
                  const selected = new Set(
                    (
                      cfg.data?.allowed_encoding_modes ||
                      modes.map((m) => m.value).join(",")
                    ).split(","),
                  );
                  v ? selected.add(m.value) : selected.delete(m.value);
                  save("admin/encoding-policy", {
                    modes: [...selected].join(","),
                  });
                }}
              />
            </div>
          ))}
        </section>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
