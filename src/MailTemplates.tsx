import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CustomSelect } from "./Select";
import { HelpTip } from "./Help";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const names: Record<string, string> = {
  register: "注册验证码",
  login: "登录验证码",
  bind: "身份绑定",
  security: "安全验证与2FA",
  recovery: "账号恢复",
  ticket_verify: "工单提醒邮箱验证",
  ticket_update: "工单进度通知",
  temporary_password: "工单临时密码",
  general: "通用验证码",
};
export function MailTemplates({ api }: { api: Api }) {
  const q = useQuery({
    queryKey: ["mail-templates"],
    queryFn: () => api<any>("admin/mail-templates"),
  });
  const [draft, setDraft] = useState<
      Record<string, { subject: string; body: string; format?: string }>
    >({}),
    [kind, setKind] = useState("register"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (q.data) setDraft(q.data.templates);
  }, [q.data]);
  const current = draft[kind];
  const preview = (text: string) =>
    text.replace(
      /\{(\w+)\}/g,
      (_, key) =>
        (
          ({
            code: "123456",
            username: "example_user",
            nickname: "示例用户",
            userid: "10001",
            email: "user@example.com",
            ticketid: "示例工单编号",
            status: "待处理",
            siteurl: "#",
            ticketurl: "#",
            new_chat: "支持 · 最新回复\n您好，您的问题已收到，我们正在处理。",
            full_chat:
              "用户 · 首次提问\n希望咨询账号相关问题。\n\n支持 · 最新回复\n您好，您的问题已收到，我们正在处理。",
          }) as Record<string, string>
        )[key] ?? "{" + key + "}",
    );
  return (
    <section className="panel management-card mail-template-settings">
      <div className="setting-row">
        <h2>邮件模板</h2>
        <HelpTip title="邮件模板占位符">
          <p>
            支持 {"{code} {username} {nickname} {userid} {email}"}
            ；工单通知另支持{" "}
            {"{ticketid} {status} {new_chat} {full_chat} {siteurl} {ticketurl}"}
            。按钮使用前端可访问地址。注册前尚不存在用户
            ID；尚未提供的用户名或昵称使用空值或“用户”。
          </p>
          <p>
            支持纯文本与 HTML 邮件，HTML
            占位符自动转义，预览禁用脚本和外部资源。验证码和临时密码正文必须保留{" "}
            {"{code}"}
            。临时密码模板中此占位符表示临时密码。
          </p>
        </HelpTip>
      </div>
      <label>
        邮件用途
        <CustomSelect
          value={kind}
          onChange={setKind}
          options={Object.entries(names).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </label>
      {current && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("admin/mail-templates", { templates: draft }, "POST");
              await q.refetch();
              window.dispatchEvent(
                new CustomEvent("zct_slms:success", { detail: "邮件模板已保存" }),
              );
            } catch (x) {
              if ((x as Error).message !== "操作已取消")
                setError((x as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            邮件格式
            <CustomSelect
              value={current.format || "plain"}
              options={[
                { value: "html", label: "HTML 卡片" },
                { value: "plain", label: "纯文本" },
              ]}
              onChange={(format) =>
                setDraft((d) => ({ ...d, [kind]: { ...d[kind], format } }))
              }
            />
          </label>
          <label>
            邮件主题
            <input
              value={current.subject}
              required
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  [kind]: { ...d[kind], subject: e.target.value },
                }))
              }
            />
          </label>
          <label>
            邮件正文
            <textarea
              rows={9}
              value={current.body}
              required
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  [kind]: { ...d[kind], body: e.target.value },
                }))
              }
            />
          </label>
          <div className="template-preview">
            <h3>预览</h3>
            <strong>{preview(current.subject)}</strong>
            {current.format === "html" ? (
              <iframe
                title="邮件模板预览"
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={
                  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:;\">" +
                  preview(current.body)
                }
              />
            ) : (
              <p>{preview(current.body)}</p>
            )}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() =>
                setDraft((d) => ({ ...d, [kind]: q.data.defaults[kind] }))
              }
            >
              恢复此项默认值
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "保存中…" : "保存模板"}
            </button>
          </div>
        </form>
      )}
      {(error || q.isError) && (
        <p className="error">{error || (q.error as Error).message}</p>
      )}
    </section>
  );
}
