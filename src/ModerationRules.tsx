import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Toggle } from "./Select";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const errorText = (e: any) => (e instanceof Error ? e.message : String(e));
const success = (detail: string) =>
  window.dispatchEvent(new CustomEvent("zct_slms:success", { detail }));
export function ModerationPage({ api }: { api: Api }) {
  const q = useQuery({
      queryKey: ["moderation"],
      queryFn: () => api<any>("admin/moderation"),
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [enabled, setEnabled] = useState<boolean | undefined>();
  return (
    <section className="panel management-card">
      <h2>屏蔽词过滤</h2>
      <p className="muted">
        使用 ZACLib
        检测用户名称、昵称、应用名称、介绍、公告和版本文本；英文忽略大小写，中文按原文匹配。
      </p>
      {q.isError && <p className="error">{errorText(q.error)}</p>}
      {q.data && (
        <form
          key={q.data.rules}
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setBusy(true);
              setError("");
              await api(
                "admin/moderation",
                {
                  rules: String(new FormData(e.currentTarget).get("rules")),
                  enabled: (enabled ?? q.data.enabled) ? "1" : "0",
                },
                "POST",
              );
              await q.refetch();
              success("审查设置已保存");
            } catch (x) {
              setError(errorText(x));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="setting-row">
            <strong>启用屏蔽词检测</strong>
            <Toggle
              label="启用屏蔽词检测"
              checked={enabled ?? q.data.enabled}
              onChange={setEnabled}
            />
          </div>
          <label>
            屏蔽词（一行一个）
            <textarea
              name="rules"
              defaultValue={q.data.rules}
              rows={14}
              maxLength={1048576}
              placeholder="每行输入一个需要拦截的词语"
            />
          </label>
          <p className="muted">
            最多 20000 条，每条不超过 256 字节，总计不超过 1048576 字节。
          </p>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="primary" disabled={busy}>
              {busy ? "保存中…" : "保存设置"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
