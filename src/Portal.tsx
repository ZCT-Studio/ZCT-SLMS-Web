import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, ProfileControl } from "./Extras";
import { AccountSettings } from "./AccountSettings";
import { SecondMethodBanner } from "./AuthFlows";
import { CustomSelect, Toggle } from "./Select";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const success = (detail: string) =>
  window.dispatchEvent(new CustomEvent("tcv:success", { detail }));
const date = (value: number) =>
  value === -1 ? "永久" : value ? new Date(value * 1000).toLocaleString() : "—";
const errorText = (e: any) => (e instanceof Error ? e.message : String(e));
export function RecoveryPolicy({ api }: { api: Api }) {
  const q = useQuery({
      queryKey: ["factor-settings"],
      queryFn: () => api<any>("admin/factors/settings"),
    }),
    [draft, setDraft] = useState<Record<string, boolean>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const fields = [
    ["email", "邮箱验证码"],
    ["phone", "手机验证码"],
    ["passkey", "通行密钥"],
    ["totp", "动态令牌"],
    ["ticket", "人工工单"],
  ];
  return (
    <section className="panel management-card">
      <h2>账号恢复方式</h2>
      <p className="muted">
        已绑定邮箱或手机号的账号通过原绑定身份自助重置；未绑定的账号可验证新的邮箱或手机号后提交忘记密码工单。
      </p>
      {q.isError && <p className="error">{errorText(q.error)}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setBusy(true);
            setError("");
            await api(
              "admin/factors/settings",
              Object.fromEntries(
                fields.map(([k]) => {
                  const key = `recovery_${k}_enabled`;
                  return [key, draft[key] ?? q.data?.[key] ?? true];
                }),
              ),
              "POST",
            );
            await q.refetch();
            success("恢复策略已保存");
          } catch (x) {
            setError(errorText(x));
          } finally {
            setBusy(false);
          }
        }}
      >
        {fields.map(([key, label]) => {
          const k = `recovery_${key}_enabled`;
          return (
            <div className="setting-row" key={k}>
              <strong>{label}</strong>
              <Toggle
                label={label}
                checked={draft[k] ?? q.data?.[k] ?? true}
                onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
              />
            </div>
          );
        })}
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="primary" disabled={busy || !q.data}>
            保存策略
          </button>
        </div>
      </form>
    </section>
  );
}
export function VoucherPage({ api, role }: { api: Api; role: string }) {
  const qc = useQueryClient(),
    [tab, setTab] = useState(
      role === "ADMIN" ? "invite-create" : "balance-redeem",
    ),
    [result, setResult] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [permanent, setPermanent] = useState(true);
  const status = useQuery({
      queryKey: ["voucher-status"],
      queryFn: () => api<any>("vouchers/status"),
      enabled: role === "USER" || role === "SUBUSER",
    }),
    history = useQuery({
      queryKey: ["voucher-history"],
      queryFn: () => api<any[]>("vouchers/list"),
      enabled: role === "ADMIN" || role === "USER",
    });
  const tabs =
    role === "ADMIN"
      ? [
          ["invite-create", "邀请码"],
          ["balance-create", "余额码"],
        ]
      : [
          ["balance-redeem", "使用余额码"],
          ...(role === "USER"
            ? [
                ["invite-redeem", "绑定邀请码"],
                ["balance-create", "生成子用户余额码"],
              ]
            : []),
        ];
  const create = tab.endsWith("create"),
    invite = tab.startsWith("invite");
  return (
    <div className="portal-page">
      <div className="settings-tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setTab(key);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel management-card">
        <h2>{tabs.find((t) => t[0] === tab)?.[1]}</h2>
        {role === "USER" && (
          <p className="muted">
            当前余额：
            {status.data?.balance === -1
              ? "不限额"
              : (status.data?.balance ?? "—")}
          </p>
        )}
        {role === "SUBUSER" && (
          <p className="muted">
            可用额度：
            {status.data?.quota_limit === -1
              ? "不限额"
              : Math.max(
                  0,
                  (status.data?.quota_limit || 0) -
                    (status.data?.quota_used || 0),
                )}
            。创建卡密时同步消耗主用户余额。
          </p>
        )}
        {create ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                seconds =
                  Number(f.get("days") || 0) * 86400 +
                  Number(f.get("hours") || 0) * 3600 +
                  Number(f.get("minutes") || 0) * 60;
              if (!permanent && seconds <= 0) {
                setError("有效期必须大于零");
                return;
              }
              try {
                setBusy(true);
                setError("");
                const d = await api<{ codes: string[] }>(
                  "vouchers/create",
                  {
                    kind: invite ? "INVITE" : "BALANCE",
                    count: Number(f.get("count")),
                    amount: Number(f.get("amount")),
                    expires_at: permanent
                      ? -1
                      : Math.floor(Date.now() / 1000) + seconds,
                  },
                  "POST",
                );
                setResult(d.codes);
                await qc.invalidateQueries({ queryKey: ["voucher-history"] });
                success("兑换码已生成");
              } catch (x) {
                setError(errorText(x));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="muted">
              {invite
                ? "64 位大小写字母与数字混合；每个邀请码仅能使用一次，每位用户只能绑定一次。"
                : "64 位大小写字母、数字与符号混合；每个余额码仅能使用一次。"}
              {role === "USER" &&
                "仅所属子用户可兑换，增加子用户额度；兑换时不扣主用户余额，实际创建卡密时扣除。"}
            </p>
            <div className="form-row">
              <label>
                数量
                <input
                  name="count"
                  type="number"
                  min={1}
                  max={500}
                  defaultValue={1}
                  required
                />
              </label>
              <label>
                {invite ? "绑定后增加余额" : "增加的余额 / 额度"}
                <input
                  name="amount"
                  type="number"
                  min={invite ? 0 : 1}
                  max={1000000000}
                  defaultValue={invite ? 0 : 1}
                  required
                />
              </label>
            </div>
            <div className="setting-row">
              <strong>永久有效</strong>
              <Toggle
                label="永久有效"
                checked={permanent}
                onChange={setPermanent}
              />
            </div>
            {!permanent && (
              <div className="duration-fields">
                {[
                  ["days", "天"],
                  ["hours", "小时"],
                  ["minutes", "分钟"],
                ].map(([name, label]) => (
                  <label key={name}>
                    {label}
                    <input
                      name={name}
                      type="number"
                      min={0}
                      max={36500}
                      defaultValue={0}
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="form-actions">
              <button className="primary" disabled={busy}>
                {busy ? "处理中…" : "生成"}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setBusy(true);
                setError("");
                await api(
                  "vouchers/redeem",
                  {
                    kind: invite ? "INVITE" : "BALANCE",
                    code: String(new FormData(e.currentTarget).get("code")),
                  },
                  "POST",
                );
                await qc.invalidateQueries({ queryKey: ["voucher-status"] });
                success(invite ? "邀请码已绑定" : "余额码使用成功");
                e.currentTarget?.reset();
              } catch (x) {
                setError(errorText(x));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="muted">
              {invite
                ? "注册时未绑定邀请码的用户，可在这里补充绑定。每个用户只能绑定一次。"
                : "输入 64 位余额码，确认后增加账户余额或子用户额度。"}
            </p>
            {invite && status.data?.invite_bound ? (
              <p className="muted">此账号已绑定过邀请码，不能重复绑定。</p>
            ) : (
              <>
                <label>
                  {invite ? "邀请码" : "余额码"}
                  <input
                    name="code"
                    minLength={64}
                    maxLength={64}
                    autoComplete="off"
                    required
                  />
                </label>
                <div className="form-actions">
                  <button className="primary" disabled={busy}>
                    {busy ? "处理中…" : invite ? "绑定邀请码" : "使用余额码"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
        {error && <p className="error">{error}</p>}
      </section>
      {create && (
        <section className="panel management-card">
          <h2>生成记录</h2>
          <p className="muted">明文仅在生成时展示，记录使用摘要编号标识。</p>
          {history.isError && (
            <p className="error">{errorText(history.error)}</p>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {["编号", "类型", "额度", "有效期", "状态"].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.data?.map((r, i) => (
                  <tr key={r.reference + i}>
                    <td>
                      <code>{r.reference}</code>
                    </td>
                    <td>{r.kind === "INVITE" ? "邀请码" : "余额码"}</td>
                    <td>{r.amount}</td>
                    <td>{date(r.expires_at)}</td>
                    <td>
                      {r.used_by
                        ? "已使用"
                        : r.expires_at !== -1 &&
                            r.expires_at < Date.now() / 1000
                          ? "已过期"
                          : "未使用"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {result.length > 0 && (
        <Dialog title="兑换码已生成" close={() => setResult([])}>
          <p className="muted">仅展示一次，请立即复制保存。</p>
          <pre className="result">{result.join("\n")}</pre>
          <div className="form-actions">
            <button
              className="primary"
              onClick={() =>
                navigator.clipboard
                  .writeText(result.join("\n"))
                  .then(() => success("已复制"))
                  .catch(() => setError("复制失败，请手动复制"))
              }
            >
              复制全部
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
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
      <h2>屏蔽词设置</h2>
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
              maxLength={32768}
              placeholder="每行输入一个需要拦截的词语"
            />
          </label>
          <p className="muted">
            最多 2000 条，每条不超过 256 字节，总计不超过 32768 字节。
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
export function ReviewPage({ api }: { api: Api }) {
  const q = useQuery({
      queryKey: ["support-review"],
      queryFn: () => api<any>("support/review"),
    }),
    [search, setSearch] = useState("");
  return (
    <div className="portal-page">
      <section className="panel management-card">
        <h2>内容审查</h2>
        <label>
          搜索用户名、应用名称或介绍
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索"
          />
        </label>
        {q.isError && <p className="error">{errorText(q.error)}</p>}
        <div className="review-users">
          <strong>用户名</strong>
          <span>
            {q.data?.users
              ?.filter((u: any) =>
                u.username.toLowerCase().includes(search.toLowerCase()),
              )
              .map((u: any) => u.username)
              .join(" · ") || "无匹配账号"}
          </span>
        </div>
      </section>
      {q.data?.apps
        ?.filter((a: any) =>
          `${a.username} ${a.name} ${a.description}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .map((a: any) => (
          <section className="panel management-card" key={a.id}>
            <div className="setting-row">
              <h2>{a.name}</h2>
              {a.flagged && <span className="badge red">命中屏蔽词</span>}
            </div>
            <p className="muted">
              所有者：{a.username} · APPID {a.appid}
            </p>
            <h3>介绍</h3>
            <p className="review-text">{a.description || "暂无介绍"}</p>
            <h3>公告</h3>
            <p className="review-text">{a.notice || "暂无公告"}</p>
            <h3>版本信息</h3>
            {a.versions.map((v: any, i: number) => (
              <div className="review-version" key={i}>
                <strong>
                  {v.version} · {v.channel}
                </strong>
                <p className="review-text">{v.changelog || "暂无更新说明"}</p>
                <small>最低版本：{v.minimum_version || "未设置"}</small>
                <p className="review-text">
                  下载地址：<code>{v.download_url || "未设置"}</code>
                </p>
                <small>
                  文件校验：{v.hash_algorithm} · {v.file_hash}
                </small>
              </div>
            ))}
          </section>
        ))}
    </div>
  );
}
export function StaffUsers({ api }: { api: Api }) {
  const q = useQuery({
      queryKey: ["support-users"],
      queryFn: () => api<any[]>("admin/support/users"),
    }),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="panel management-card">
      <div className="setting-row">
        <h2>支持账号</h2>
        <button className="primary" onClick={() => setOpen(true)}>
          新建支持账号
        </button>
      </div>
      <p className="muted">
        权限仅限工单、用户名与公开应用内容审查。不能控制应用、查看密钥或修改服务器设置。
      </p>
      {q.data?.map((s) => (
        <div className="setting-row" key={s.id}>
          <strong>{s.username}</strong>
          <span>{s.nickname}</span>
        </div>
      ))}
      {q.isError && <p className="error">{errorText(q.error)}</p>}
      {open && (
        <Dialog title="新建支持账号" close={() => setOpen(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                setBusy(true);
                setError("");
                await api(
                  "admin/support/users",
                  {
                    username: String(f.get("username")),
                    nickname: String(f.get("nickname")),
                    initial_password: String(f.get("password")),
                  },
                  "POST",
                );
                await q.refetch();
                setOpen(false);
                success("支持账号已创建，首次登录须修改密码");
              } catch (x) {
                setError(errorText(x));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              用户名
              <input name="username" pattern="[A-Za-z0-9_.-]{3,64}" required />
            </label>
            <label>
              昵称
              <input name="nickname" maxLength={48} required />
            </label>
            <label>
              初始密码
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={256}
                autoComplete="new-password"
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button className="primary" disabled={busy}>
                创建账号
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
export function TicketsPage({ api, role }: { api: Api; role: string }) {
  const q = useQuery({
      queryKey: ["tickets"],
      queryFn: () => api<any[]>("tickets/list"),
      refetchInterval: 30000,
    }),
    [open, setOpen] = useState(false),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (selected)
    return <TicketView api={api} id={selected} back={() => setSelected("")} />;
  return (
    <div className="portal-page">
      <section className="panel management-card">
        <div className="setting-row">
          <h2>工单系统</h2>
          <button className="primary" onClick={() => setOpen(true)}>
            新建工单
          </button>
        </div>
        {q.isError && <p className="error">{errorText(q.error)}</p>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {["标题", "类型", "账号", "状态", "更新时间"].map((v) => (
                  <th key={v}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data?.map((t) => (
                <tr
                  key={t.id}
                  className="clickable-row"
                  onClick={() => setSelected(t.id)}
                >
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setSelected(t.id)}
                    >
                      {t.title}
                    </button>
                  </td>
                  <td>{ticketType(t.category)}</td>
                  <td>{t.username}</td>
                  <td>{ticketStatus(t.status)}</td>
                  <td>{date(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {role === "ADMIN" && <StaffUsers api={api} />}{" "}
      {open && (
        <Dialog title="新建工单" close={() => setOpen(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                setBusy(true);
                setError("");
                const r = await api<any>(
                  "tickets/create",
                  {
                    category: String(f.get("category")),
                    title: String(f.get("title")),
                    body: String(f.get("body")),
                  },
                  "POST",
                );
                await q.refetch();
                setOpen(false);
                setSelected(r.id);
                success("工单已创建");
              } catch (x) {
                setError(errorText(x));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              工单类型
              <CustomSelect
                name="category"
                defaultValue="GENERAL"
                options={[
                  { value: "GENERAL", label: "常规支持" },
                  { value: "ACCOUNT", label: "账号支持" },
                ]}
              />
            </label>
            <label>
              标题
              <input name="title" maxLength={90} required />
            </label>
            <label>
              问题描述
              <textarea
                name="body"
                minLength={10}
                maxLength={8000}
                rows={7}
                required
              />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
              <button className="primary" disabled={busy}>
                提交工单
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
const ticketType = (v: string) =>
    ({
      FORGOT: "忘记密码",
      ACCOUNT: "账号支持",
      GENERAL: "常规支持",
      PASSKEY: "通行密钥删除",
    })[v] || v,
  ticketStatus = (v: string) =>
    ({
      OPEN: "待处理",
      PROCESSING: "处理中",
      RESOLVED: "已解决",
      CLOSED: "已关闭",
    })[v] || v;
export function TicketView({
  api,
  id,
  accessToken = "",
  back,
}: {
  api: Api;
  id: string;
  accessToken?: string;
  back: () => void;
}) {
  const q = useQuery({
      queryKey: ["ticket", id, accessToken],
      queryFn: () =>
        api<any>("tickets/read", { id, access_token: accessToken }, "POST"),
      refetchInterval: 30000,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false);
  return (
    <section className="panel management-card">
      <button className="secondary" onClick={back}>
        ← 返回工单
      </button>
      <h2>{q.data?.title || "工单详情"}</h2>
      <p className="muted">
        {id} · {ticketType(q.data?.category)} · {ticketStatus(q.data?.status)}
      </p>
      {q.isError && <p className="error">{errorText(q.error)}</p>}
      <div className="ticket-thread">
        {q.data?.messages?.map((m: any, i: number) => (
          <article key={i}>
            <header>
              <strong>
                {m.sender_role === "ADMIN"
                  ? "管理员"
                  : m.sender_role === "SUPPORT"
                    ? "支持"
                    : "用户"}
              </strong>
              <small>{date(m.created_at)}</small>
            </header>
            <p>{m.body}</p>
          </article>
        ))}
      </div>
      {q.data?.status === "OPEN" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            try {
              setBusy(true);
              setError("");
              await api(
                "tickets/reply",
                {
                  id,
                  access_token: accessToken,
                  body: String(new FormData(form).get("body")),
                },
                "POST",
              );
              form.reset();
              await q.refetch();
              success("回复已发送");
            } catch (x) {
              setError(errorText(x));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            回复
            <textarea name="body" rows={5} maxLength={8000} required />
          </label>
          <div className="form-actions">
            <button className="primary" disabled={busy}>
              发送回复
            </button>
          </div>
        </form>
      )}
      {q.data?.passkey_name && (
        <p className="muted">申请删除的通行密钥：{q.data.passkey_name}</p>
      )}
      {q.data?.can_remove_passkey && (
        <div className="ticket-reset">
          <p className="muted">
            请核验申请材料和账号归属。仅删除本工单指定的通行密钥，随后撤销申请账号全部登录会话。不能处理自己的删除申请；支持人员不能处理管理员或支持账号的申请。
          </p>
          <div className="setting-row">
            <strong>已核验账号归属与删除申请</strong>
            <Toggle
              label="已核验账号归属与删除申请"
              checked={reviewed}
              onChange={setReviewed}
            />
          </div>
          <div className="form-actions">
            <button
              className="danger-button"
              disabled={busy || !reviewed}
              onClick={async () => {
                try {
                  setBusy(true);
                  setError("");
                  await api(
                    "tickets/remove-passkey",
                    { id, reviewed: "1" },
                    "POST",
                  );
                  await q.refetch();
                  success("指定通行密钥已删除，申请账号会话已撤销");
                } catch (x) {
                  setError(errorText(x));
                } finally {
                  setBusy(false);
                }
              }}
            >
              审核通过并删除通行密钥
            </button>
          </div>
        </div>
      )}
      {q.data?.can_reset_password && (
        <div className="ticket-reset">
          <p className="muted">
            请核验申诉材料及账号归属。临时密码仅发送至用户已验证的新联系方式；支持与管理员不可见。不能通过此入口重置管理员或支持账号。
          </p>
          <div className="setting-row">
            <strong>已核验申诉材料与账号归属</strong>
            <Toggle
              label="已核验申诉材料与账号归属"
              checked={reviewed}
              onChange={setReviewed}
            />
          </div>
          <div className="form-actions">
            <button
              className="danger-button"
              disabled={busy || !reviewed}
              onClick={async () => {
                try {
                  setBusy(true);
                  setError("");
                  await api(
                    "tickets/reset-password",
                    { id, reviewed: "1" },
                    "POST",
                  );
                  await q.refetch();
                  success("临时密码已定向发送给用户");
                } catch (x) {
                  setError(errorText(x));
                } finally {
                  setBusy(false);
                }
              }}
            >
              发送临时密码并重置
            </button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
export function SupportShell({
  api,
  session,
  onLogout,
}: {
  api: Api;
  session: any;
  onLogout: () => void;
}) {
  const qc = useQueryClient(),
    path = window.location.pathname,
    [position, setPosition] = useState(
      localStorage.getItem("tcv-nav") || "left",
    );
  const logout = async () => {
    try {
      await api("auth/logout", {}, "POST");
    } catch {}
    sessionStorage.removeItem("tcv-session");
    let all: any[] = [];
    try {
      all = JSON.parse(sessionStorage.getItem("tcv-accounts") || "[]");
    } catch {}
    sessionStorage.setItem(
      "tcv-accounts",
      JSON.stringify(all.filter((a) => a.token !== session.token)),
    );
    qc.clear();
    onLogout();
  };
  return (
    <div className={"layout nav-" + position}>
      <aside className="sidebar">
        <div className="brand">
          <strong>
            TingCloud
            <br />
            <small>支持工作台</small>
          </strong>
        </div>
        <div className="nav-divider" />
        <nav>
          {[
            ["/tickets", "工单系统"],
            ["/review", "内容审查"],
            ["/account", "账号设置"],
          ].map(([href, label]) => (
            <a
              className={path.startsWith(href) ? "active" : ""}
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ProfileControl
            api={api}
            session={session}
            position={position}
            setPosition={(v) => {
              setPosition(v);
              localStorage.setItem("tcv-nav", v);
            }}
            onAdd={() => {
              sessionStorage.removeItem("tcv-session");
              qc.clear();
              onLogout();
            }}
            onSwitch={(s) => {
              sessionStorage.setItem("tcv-session", JSON.stringify(s));
              window.location.assign("/");
            }}
            onLogout={logout}
          />
        </div>
      </aside>
      <main>
        <div className="content">
          <SecondMethodBanner api={api} />
          {path.startsWith("/account") ? (
            <AccountSettings api={api} session={session} onLogout={onLogout} />
          ) : path === "/review" ? (
            <ReviewPage api={api} />
          ) : (
            <TicketsPage api={api} role="SUPPORT" />
          )}
        </div>
        <div className="footer fixed-footer">© TingCloud Verifier</div>
      </main>
    </div>
  );
}
