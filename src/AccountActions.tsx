import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, ShieldCheck, Trash2 } from "lucide-react";
import { Dialog } from "./Extras";
import { requestPassword } from "./PasswordPrompt";
import { HelpTip } from "./Help";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const notify = (detail: string) =>
  window.dispatchEvent(new CustomEvent("zct_slms:success", { detail }));
export function AccountActions({
  api,
  user,
  role,
  deleteOnly = false,
}: {
  api: Api;
  user: { id: number; username: string; status?: number };
  role: string;
  deleteOnly?: boolean;
}) {
  const qc = useQueryClient(),
    [action, setAction] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const label =
    action === "DELETE"
      ? "删除账号"
      : action === "BAN"
        ? "封禁账号"
        : "解除封禁";
  return (
    <>
      <div className="heading-actions">
        {!deleteOnly && (
          <button
            className="icon-button"
            aria-label={user.status === 1 ? "封禁账号" : "解除封禁"}
            onClick={() => {
              setError("");
              setAction(user.status === 1 ? "BAN" : "UNBAN");
            }}
          >
            {user.status === 1 ? <Ban size={16} /> : <ShieldCheck size={16} />}
          </button>
        )}
        <button
          className="icon-button"
          aria-label="删除账号"
          onClick={() => {
            setError("");
            setAction("DELETE");
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {action && (
        <Dialog
          title={`${label} · ${user.username}`}
          close={() => {
            if (!busy) setAction("");
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                setBusy(true);
                setError("");
                await api(
                  "accounts/manage",
                  {
                    role,
                    user_id: user.id,
                    action,
                    confirm_username: String(f.get("username") || ""),
                  },
                  "POST",
                );
                await qc.invalidateQueries();
                setAction("");
                notify(`${label}成功`);
              } catch (x) {
                setError((x as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="muted">
              {action === "DELETE"
                ? "删除后无法恢复，关联应用和数据将一并删除。"
                : action === "BAN" && role === "USER"
                  ? "封禁后账号会话失效，所属应用和子用户将同时停用。"
                  : action === "UNBAN" && role === "USER"
                    ? "解封仅恢复此账号；所属应用和子用户需另行检查恢复。"
                    : "操作后该账号的现有登录会话将失效。"}
            </p>
            {action === "DELETE" && (
              <label>
                输入完整用户名确认
                <input name="username" required autoComplete="off" />
              </label>
            )}
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setAction("")}
              >
                取消
              </button>
              <button
                className={action === "DELETE" ? "danger-button" : "primary"}
                disabled={busy}
              >
                {busy ? "处理中…" : label}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
export function AccountClosure({ api }: { api: Api }) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    qc = useQueryClient();
  return (
    <section className="panel management-card">
      <div className="setting-row">
        <h2>注销账号</h2>
        <HelpTip title="注销流程">
          无论平台是否开启双重验证，都需要本次验证两种不同的登录方式。仅绑定一种时请先补充第二种。审核通过后账号及关联数据将永久删除；提交申请时仍保留账号。
        </HelpTip>
      </div>
      <div className="form-actions">
        <button
          className="danger-button"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          申请注销账号
        </button>
      </div>
      {open && (
        <Dialog
          title="申请注销账号"
          close={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const reason = String(
                new FormData(e.currentTarget).get("reason"),
              );
              try {
                setBusy(true);
                setError("");
                await requestPassword(
                  "注销账号：验证两种登录方式",
                  (password) =>
                    api("accounts/closure", { reason, password }, "POST"),
                  "closure",
                );
                await qc.invalidateQueries({ queryKey: ["tickets"] });
                setOpen(false);
                notify("注销申请已提交，请在工单系统查看审核进度");
              } catch (x) {
                setError((x as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              注销原因
              <textarea
                name="reason"
                minLength={10}
                maxLength={1200}
                required
                rows={4}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button className="primary" disabled={busy}>
                {busy ? "验证中…" : "验证并提交注销工单"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
export function ClosureReview({
  api,
  ticket,
  refresh,
}: {
  api: Api;
  ticket: any;
  refresh: () => Promise<any>;
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <div className="form-actions">
        <button className="danger-button" onClick={() => setOpen(true)}>
          审核并批准注销
        </button>
      </div>
      {open && (
        <Dialog
          title="批准注销账号"
          close={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                setBusy(true);
                setError("");
                await api(
                  "tickets/approve-closure",
                  {
                    id: ticket.id,
                    reviewed: "1",
                    confirm_username: String(f.get("username")),
                  },
                  "POST",
                );
                await refresh();
                setOpen(false);
                notify("账号已注销");
              } catch (x) {
                setError((x as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="muted">
              请核验申请账号与注销意愿。批准后永久删除账号及关联数据，无法恢复。
            </p>
            <label>
              输入申请账号用户名：{ticket.username}
              <input name="username" required autoComplete="off" />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button className="danger-button" disabled={busy}>
                确认批准注销
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
