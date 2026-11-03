import { MailTemplates } from "./MailTemplates";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Toggle } from "./Select";
import { PlatformConfig } from "./PlatformConfig";
type Api = <T>(
  path: string,
  params?: Record<string, string | number>,
  method?: string,
) => Promise<T>;
export function Policies({ api }: { api: Api }) {
  const qc = useQueryClient();
  const cfg = useQuery({
    queryKey: ["system-configs"],
    queryFn: () =>
      api<{
        owner_can_create_subuser: boolean;
        license_timer_paused: boolean;
        max_avatar_bytes: number;
      }>("system/configs"),
  });
  const core = useQuery({
    queryKey: ["core-version"],
    queryFn: () =>
      api<{ version: string; components?: Record<string, string> }>(
        "system/ping",
      ),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("general");
  const save = async (fn: () => Promise<unknown>) => {
    try {
      setBusy(true);
      setError("");
      await fn();
      await qc.invalidateQueries({ queryKey: ["system-configs"] });
      window.dispatchEvent(
        new CustomEvent("zct_slms:success", { detail: "操作成功" }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="platform-settings">
      <div className="settings-tabs" role="tablist" aria-label="平台设置">
        {[
          ["general", "常规设置"],
          ["runtime", "运行配置"],
          ["mail", "工单邮箱"],
          ["templates", "邮件模板"],
          ["versions", "系统版本"],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "runtime" && <PlatformConfig api={api} />}
      {tab === "templates" && <MailTemplates api={api} />}
      {tab === "mail" && <TicketMailSettings api={api} />}
      {tab === "versions" && (
        <section className="panel management-card">
          <h2>系统版本</h2>
          <div className="setting-row">
            <strong>Core</strong>
            <span>v{core.data?.version || "—"}</span>
          </div>
          {Object.entries(core.data?.components || {}).map(
            ([name, version]) => (
              <div className="setting-row" key={name}>
                <strong>{name}</strong>
                <span>v{version}</span>
              </div>
            ),
          )}
        </section>
      )}
      {tab === "general" && (
        <>
          <section className="panel management-card">
            <h2>头像大小限制</h2>
            {cfg.data && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(() =>
                    api(
                      "admin/avatar-limit",
                      {
                        max_avatar_bytes:
                          Number(new FormData(e.currentTarget).get("kb")) *
                          1024,
                      },
                      "POST",
                    ),
                  );
                }}
              >
                <label>
                  最大文件大小（KB）
                  <input
                    name="kb"
                    type="number"
                    min={100}
                    max={1024}
                    step={1}
                    defaultValue={Math.round(
                      (cfg.data.max_avatar_bytes || 1048576) / 1024,
                    )}
                    required
                  />
                </label>
                <button className="primary" disabled={busy}>
                  保存头像限制
                </button>
              </form>
            )}
          </section>
          <section className="panel management-card">
            <h2>卡密计时</h2>
            <div className="setting-row">
              <div>
                <strong>
                  {cfg.data?.license_timer_paused ? "当前已暂停" : "当前运行中"}
                </strong>
                <small>影响全平台卡密剩余有效时长。</small>
              </div>
              <button
                className="secondary"
                disabled={busy || !cfg.data}
                onClick={() =>
                  save(() =>
                    api(
                      "admin/license-timer/" +
                        (cfg.data!.license_timer_paused ? "resume" : "pause"),
                      {},
                      "POST",
                    ),
                  )
                }
              >
                {cfg.data?.license_timer_paused ? "恢复计时" : "暂停计时"}
              </button>
            </div>
          </section>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
import { TicketMailSettings } from "./TicketNotifications";
