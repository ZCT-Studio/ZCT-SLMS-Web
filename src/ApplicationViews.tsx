import {ApplicationSummary} from "./ProductUI";
import { useState, useEffect } from "react";
import { HelpTip } from "./Help";
import { Shuffle } from "lucide-react";
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
  currentMode,
}: {
  api: Api;
  current: string;
  currentMode?: string;
}) {
  const cfg = useQuery({
    queryKey: ["system-configs"],
    queryFn: () => api<{ allowed_encoding_modes: string }>("system/configs"),
  });
  const qc = useQueryClient();
  const [mode, setMode] = useState(currentMode || ""),
    [keyValue, setKeyValue] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setMode(currentMode || "");
    setKeyValue("");
    setError("");
  }, [current, currentMode]);
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
            await qc.invalidateQueries({ queryKey: ["apps"] });
            setKeyValue("");
            window.dispatchEvent(
              new CustomEvent("zct_slms:success", { detail: "编码设置已保存" }),
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
            placeholder={
              currentMode === undefined
                ? "请选择新模式（当前状态需更新 Core）"
                : "请选择编码模式"
            }
            onChange={(v) => {
              setMode(v);
              setKeyValue("");
            }}
            options={modes
              .filter(
                (m) =>
                  m.value === currentMode ||
                  (
                    cfg.data?.allowed_encoding_modes ||
                    modes.map((m) => m.value).join(",")
                  )
                    .split(",")
                    .includes(m.value),
              )
              .map((m) => ({
                ...m,
                disabled: !(
                  cfg.data?.allowed_encoding_modes ||
                  modes.map((x) => x.value).join(",")
                )
                  .split(",")
                  .includes(m.value),
              }))}
          />
        </label>
        {needsKey && (
          <>
            <label>
              新加密密钥{" "}
              <HelpTip title="密钥格式与随机生成">
                {mode === "AES128-GCM"
                  ? "16字节密钥，32位十六进制字符。"
                  : "32字节密钥，64位十六进制字符。"}{" "}
                随机按钮在浏览器本地生成，保存应用配置时才提交。
                当前密钥不会回传；保存后替换为本次输入的密钥。
              </HelpTip>
              <div className="key-generator">
                <input
                  name="key"
                  type="password"
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  required
                  pattern={
                    mode === "AES128-GCM"
                      ? "[0-9a-fA-F]{32}"
                      : "[0-9a-fA-F]{64}"
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="随机生成符合当前算法的密钥"
                  onClick={() => {
                    const bytes = crypto.getRandomValues(
                      new Uint8Array(mode === "AES128-GCM" ? 16 : 32),
                    );
                    setKeyValue(
                      Array.from(bytes, (b) =>
                        b.toString(16).padStart(2, "0"),
                      ).join(""),
                    );
                  }}
                >
                  <Shuffle size={17} />
                </button>
              </div>
            </label>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy || !mode}>
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
    () => localStorage.getItem("zct_slms-app-layout") || "auto",
  );
  useEffect(() => {
    const f = () => setPref(localStorage.getItem("zct_slms-app-layout") || "auto");
    window.addEventListener("zct_slms:layout", f);
    return () => window.removeEventListener("zct_slms:layout", f);
  }, []);
  return (
    <div className={"app-browser view-" + pref}>
      {!apps.length && (
        <div className="panel empty-state">
          暂无应用，可通过“创建应用”添加。
        </div>
      )}
      {apps.map((a) => (
        <ApplicationSummary key={a.appid} href={"/app-details?app="+encodeURIComponent(a.appid)} name={a.name} owner={a.owner_username || a.creator?.replace(/\*$/, "") || "—"} appid={a.appid}/>

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
        new CustomEvent("zct_slms:success", { detail: "设置已保存" }),
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
