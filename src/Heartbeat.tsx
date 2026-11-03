import { ResponsiveTable } from "./ResponsiveTable";
import { HelpTip } from "./Help";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Toggle } from "./Select";
import { RefreshCw, HelpCircle } from "lucide-react";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
export function HeartbeatSettings({
  api,
  current,
}: {
  api: Api;
  current: string;
}) {
  const q = useQuery({
      queryKey: ["heartbeat", current],
      queryFn: () => api<any>("app/heartbeat", { app_id: current }),
      refetchInterval: 15000,
    }),
    [enabled, setEnabled] = useState(false),
    [interval, setIntervalValue] = useState(30),
    [timeout, setTimeoutValue] = useState(90),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (q.data) {
      setEnabled(q.data.enabled);
      setIntervalValue(q.data.interval_seconds);
      setTimeoutValue(q.data.timeout_seconds);
    }
  }, [q.data?.enabled, q.data?.interval_seconds, q.data?.timeout_seconds]);
  return (
    <div className="portal-page">
      <section className="panel management-card">
        <h2>心跳验证</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setBusy(true);
              setError("");
              await api(
                "app/heartbeat",
                {
                  app_id: current,
                  enabled,
                  interval_seconds: interval,
                  timeout_seconds: timeout,
                },
                "POST",
              );
              await q.refetch();
              window.dispatchEvent(
                new CustomEvent("zct_slms:success", { detail: "心跳设置已保存" }),
              );
            } catch (x) {
              setError((x as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="setting-row">
            <strong>启用客户端心跳</strong>
            <Toggle
              label="启用客户端心跳"
              checked={enabled}
              onChange={setEnabled}
            />
          </div>
          <div className="form-row">
            <label>
              心跳间隔（秒）
              <input
                type="number"
                min={5}
                max={3600}
                value={interval}
                onChange={(e) => setIntervalValue(Number(e.target.value))}
                required
              />
            </label>
            <label>
              离线判定超时（秒）
              <input
                type="number"
                min={interval * 2}
                max={86400}
                value={timeout}
                onChange={(e) => setTimeoutValue(Number(e.target.value))}
                required
              />
            </label>
          </div>
          <HelpTip title="客户端如何接入">
            <p>
              首次验证响应会返回心跳要求和间隔。客户端需按间隔调用{" "}
              <code>/api/v1/client/license/heartbeat</code>
              ，传入与验证接口相同的APPID、卡密、设备信息、时间戳、随机数及应用所要求的签名/加密。每次心跳重新检查封禁、有效期和绑定；失败时客户端应停止授权。后台超时仅标记离线，不自动删除或扣除卡密。
            </p>
          </HelpTip>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button className="primary" disabled={busy || !q.data}>
              保存设置
            </button>
          </div>
        </form>
      </section>
      <section className="panel">
        <div className="table-toolbar">
          <h2>客户端心跳记录</h2>
          <button className="secondary" onClick={() => void q.refetch()}>
            <RefreshCw size={15} />
            刷新
          </button>
        </div>
        {q.isError && (
          <p className="error table-error">{(q.error as Error).message}</p>
        )}
        <div className="table-scroll">
          <ResponsiveTable>
            <thead>
              <tr>
                {[
                  "卡密编号",
                  "状态",
                  "最近心跳",
                  "IP",
                  "设备指纹",
                  "心跳次数",
                ].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data?.records?.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.reference}</code>
                  </td>
                  <td>
                    <span
                      className={
                        "badge " + (r.state === "ONLINE" ? "green" : "")
                      }
                    >
                      {
                        (
                          {
                            ONLINE: "在线",
                            OFFLINE: "离线",
                            WAITING: "等待心跳",
                            DISABLED: "未启用",
                            INVALID: "授权无效",
                          } as any
                        )[r.state]
                      }
                    </span>
                  </td>
                  <td>
                    {r.last_seen
                      ? new Date(r.last_seen * 1000).toLocaleString()
                      : "—"}
                  </td>
                  <td>{r.ip || "—"}</td>
                  <td>
                    <code className="binding-fingerprint">
                      {r.device_fingerprint || "—"}
                    </code>
                  </td>
                  <td>{r.requests || 0}</td>
                </tr>
              ))}
              {q.data?.records?.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan={6}>
                    暂无卡密或心跳记录
                  </td>
                </tr>
              )}
            </tbody>
          </ResponsiveTable>
        </div>
      </section>
    </div>
  );
}
