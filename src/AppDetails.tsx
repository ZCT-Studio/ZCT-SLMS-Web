import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Box,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Dialog } from "./Extras";
import { useQueryClient } from "@tanstack/react-query";
import "./styles/AppDetails.css";

type App = {
  appid: string;
  name: string;
  description: string;
  creator: string;
  owner_username?: string;
  owner_id?: number;
  binding_mode: string;
  status: string | number;
  created_at: number;
  secret_view_available?: boolean;
  secret_repeat_allowed?: boolean;
};
type Api = <T>(
  path: string,
  params?: Record<string, string | number>,
  method?: string,
) => Promise<T>;
const bindingLabels: Record<string, string> = {
  NONE: "无",
  IP: "IP",
  DEVICE: "设备",
  IP_AND_DEVICE: "设备和 IP",
};
const success = (detail: string) =>
  window.dispatchEvent(new CustomEvent("tcv:success", { detail }));

export function AppDetails({
  app,
  api,
  role,
}: {
  app: App;
  api: Api;
  role: string;
}) {
  const qc = useQueryClient(),
    [editing, setEditing] = useState(false),
    [editError, setEditError] = useState("");
  const [secret, setSecret] = useState(""),
    [asking, setAsking] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [copyError, setCopyError] = useState("");
  const request = useRef(0);
  const [consumed, setConsumed] = useState(false);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        request.current++;
        setSecret("");
        setAsking(false);
        setPending(false);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      request.current++;
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (!secret) return;
    const timer = window.setTimeout(() => setSecret(""), 60000);
    return () => window.clearTimeout(timer);
  }, [secret]);
  function close() {
    request.current++;
    setAsking(false);
    setPending(false);
    setError("");
  }
  async function copy(value: string, label: string) {
    try {
      setCopyError("");
      await navigator.clipboard.writeText(value);
      success(label + "已复制");
    } catch {
      setCopyError("复制失败，请手动选择内容复制。");
    }
  }
  const status =
    String(app.status) === "1"
      ? "正常"
      : String(app.status) === "0"
        ? "已停用"
        : String(app.status);
  const owner = app.owner_username || app.creator?.replace(/\*$/, "") || "—";
  return (
    <div className="application-details">
      <a className="details-back" href="/apps">
        <ArrowLeft size={15} /> 返回应用管理
      </a>
      <section className="panel details-overview">
        <div className="details-heading">
          <div className="details-icon">
            <Box size={25} />
          </div>
          <div>
            <h2>{app.name}</h2>
            <span
              className={
                "badge " + (String(app.status) === "1" ? "green" : "red")
              }
            >
              <i />
              {status}
            </span>
          </div>
        </div>
        <div className="details-description">
          <h3>应用介绍</h3>
          <p>{app.description || "暂无应用介绍"}</p>
          {role !== "SUBUSER" && role !== "SUPPORT" && (
            <button
              className="secondary"
              onClick={() => {
                setEditError("");
                setEditing(true);
              }}
            >
              <Settings size={15} />
              编辑应用资料
            </button>
          )}
        </div>
        <div className="app-card-actions">
          <a
            className="primary"
            href={"/licenses?app=" + encodeURIComponent(app.appid)}
          >
            <KeyRound size={16} /> 卡密管理
          </a>
          {role !== "SUBUSER" && (
            <a
              className="secondary"
              href={"/app-settings?app=" + encodeURIComponent(app.appid)}
            >
              <Settings size={16} /> 应用设置
            </a>
          )}
        </div>
      </section>
      <section className="panel details-info">
        <div className="details-section-heading">
          <ShieldCheck size={18} />
          <h2>接入凭据</h2>
        </div>
        <div className="details-credential">
          <div>
            <strong>APPID</strong>
            <small>应用的公开标识</small>
          </div>
          <div className="details-credential-value">
            <code>{app.appid}</code>
            <button
              type="button"
              className="icon-button"
              aria-label="复制 APPID"
              onClick={() => copy(app.appid, "APPID")}
            >
              <Copy size={16} />
            </button>
          </div>
        </div>
        <div className="details-credential">
          <div>
            <strong>APPSECRET</strong>
            <small>
              {role === "SUBUSER"
                ? "当前子用户无权查看密钥"
                : app.secret_repeat_allowed === false
                  ? consumed || app.secret_view_available === false
                    ? "此密钥已展示；如遗失请到应用设置重置"
                    : "仅允许查看一次，请立即复制保存"
                  : "验证当前账号密码后查看，60 秒后自动隐藏"}
            </small>
          </div>
          <div className="details-credential-value">
            <code className="app-secret-value">
              {secret || "••••••••••••••••••••••••"}
            </code>
            {role !== "SUBUSER" && (
              <button
                type="button"
                className="icon-button"
                disabled={
                  !secret && (consumed || app.secret_view_available === false)
                }
                aria-label={
                  secret ? "隐藏 APPSECRET" : "验证密码后查看 APPSECRET"
                }
                onClick={() => {
                  if (secret) setSecret("");
                  else {
                    setError("");
                    setAsking(true);
                  }
                }}
              >
                {secret ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            )}
            {secret && (
              <button
                type="button"
                className="icon-button"
                aria-label="复制 APPSECRET"
                onClick={() => copy(secret, "APPSECRET")}
              >
                <Copy size={16} />
              </button>
            )}
          </div>
        </div>
        {copyError && <p className="error">{copyError}</p>}
      </section>
      <section className="panel details-info">
        <h2>基本信息</h2>
        <dl className="details-facts">
          <div>
            <dt>应用名称</dt>
            <dd>{app.name}</dd>
          </div>
          <div>
            <dt>所属用户</dt>
            <dd>
              {owner}
              {app.owner_id && <small> UID {app.owner_id}</small>}
            </dd>
          </div>
          <div>
            <dt>绑定模式</dt>
            <dd>
              {bindingLabels[app.binding_mode] || app.binding_mode || "—"}
            </dd>
          </div>
          <div>
            <dt>运行状态</dt>
            <dd>{status}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>
              {app.created_at > 0
                ? new Date(app.created_at * 1000).toLocaleString("zh-CN", {
                    hour12: false,
                  })
                : "—"}
            </dd>
          </div>
        </dl>
      </section>
      {asking && (
        <Dialog title="验证身份后查看 APPSECRET" close={close}>
          <p className="muted">
            请输入当前登录账号的密码。请妥善保管应用密钥。
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const password = String(
                new FormData(e.currentTarget).get("password") || "",
              );
              const version = ++request.current;
              try {
                setPending(true);
                setError("");
                const result = await api<{ secret: string }>(
                  "app/secret/view",
                  { app_id: app.appid, password },
                  "POST",
                );
                if (request.current !== version) return;
                setSecret(result.secret);
                if (app.secret_repeat_allowed === false) setConsumed(true);
                setAsking(false);
              } catch (x) {
                if (request.current === version) setError((x as Error).message);
              } finally {
                if (request.current === version) setPending(false);
              }
            }}
          >
            <label>
              当前密码
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="app-card-actions">
              <button type="button" className="secondary" onClick={close}>
                取消
              </button>
              <button className="primary" disabled={pending}>
                <Check size={16} />
                {pending ? "验证中…" : "验证并查看"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {editing && (
        <Dialog title="编辑应用资料" close={() => setEditing(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                setPending(true);
                setEditError("");
                await api(
                  "app/update",
                  {
                    app_id: app.appid,
                    name: String(f.get("name")),
                    description: String(f.get("description")),
                  },
                  "POST",
                );
                await qc.invalidateQueries({ queryKey: ["apps"] });
                setEditing(false);
                success("应用资料已更新");
              } catch (x) {
                setEditError((x as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            <label>
              应用名称
              <input
                name="name"
                defaultValue={app.name}
                maxLength={128}
                required
              />
            </label>
            <label>
              应用介绍
              <textarea
                name="description"
                defaultValue={app.description}
                maxLength={4096}
                rows={5}
              />
            </label>
            {editError && <p className="error">{editError}</p>}
            <div className="form-actions">
              <button className="primary" disabled={pending}>
                {pending ? "保存中…" : "保存"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
