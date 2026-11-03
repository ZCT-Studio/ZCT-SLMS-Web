import { ResponsiveTable } from "./ResponsiveTable";
import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { CustomSelect } from "./Select";
import { AccountActions } from "./AccountActions";
type Api = <T>(
  path: string,
  params?: Record<string, string | number>,
  method?: string,
) => Promise<T>;
type App = {
  id?: number;
  appid: string;
  name: string;
  description: string;
  binding_mode: string;
  status: string | number;
  created_at: number;
  creator: string;
  owner_id?: number;
  owner_username?: string;
};
type Session = {
  token: string;
  username: string;
  user_type: string;
  user_id: number;
  force_setup?: boolean;
};
type Profile = {
  user_id: number;
  username: string;
  user_type: string;
  nickname: string;
  avatar: string;
};
type SubUser = {
  id: number;
  username: string;
  display_name: string;
  quota_limit: number;
  quota_used: number;
  status: number;
  assigned_apps?: string[];
};
const bindingName = (v: string) =>
  ({ NONE: "无", IP: "IP", DEVICE: "设备", IP_AND_DEVICE: "设备和 IP" })[v] ??
  v;
const profileKey = (s: Session) => `zct_slms-profile:v2:${s.user_type}:${s.user_id}`;
const dialogStack: symbol[] = [];
let dialogOverflow = "";
export function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const identity = useRef(Symbol()),
    panel = useRef<HTMLDivElement>(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const id = identity.current;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialogStack.length) {
      dialogOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialogStack.push(id);
    panel.current?.focus({ preventScroll: true });
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dialogStack.at(-1) === id) closeRef.current();
      if (e.key === "Tab" && dialogStack.at(-1) === id) {
        const items = [
          ...(panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),a[href],[tabindex="0"]',
          ) || []),
        ].filter((el) => el.getClientRects().length);
        const first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", f);
    return () => {
      document.removeEventListener("keydown", f);
      const index = dialogStack.indexOf(id);
      if (index >= 0) dialogStack.splice(index, 1);
      if (!dialogStack.length) document.body.style.overflow = dialogOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="关闭" onClick={close}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function AppDanger({ api, app }: { api: Api; app: App }) {
  const [dialog, setDialog] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [secret, setSecret] = useState(""),
    [password, setPassword] = useState("");
  return (
    <section className="panel management-card app-danger">
      <div>
        <h2>应用操作</h2>
        <p className="muted">
          重置密钥会让旧客户端失效；删除应用会影响全部相关数据。
        </p>
      </div>
      <div className="app-card-actions">
        <button
          className="secondary"
          onClick={() => {
            setError("");
            setDialog("secret");
          }}
        >
          重置密钥
        </button>
        <button
          className="danger-button"
          onClick={() => {
            setError("");
            setDialog("delete");
          }}
        >
          <Trash2 size={15} /> 删除应用
        </button>
      </div>
      {dialog && (
        <Dialog
          title={dialog === "delete" ? "删除应用" : "重置应用密钥"}
          close={() => {
            setDialog("");
            setSecret("");
            setError("");
          }}
        >
          {secret ? (
            <pre className="result">{secret}</pre>
          ) : (
            <>
              <p className="muted">
                {dialog === "delete"
                  ? `删除「${app.name}」后无法撤销。`
                  : "确认重置应用密钥？"}
              </p>
              {error && <p className="error">{error}</p>}
              <div className="form-actions">
                <button
                  className="danger-button"
                  disabled={pending}
                  onClick={async () => {
                    try {
                      setPending(true);
                      setError("");
                      if (dialog === "delete") {
                        await api("app/delete", { id: app.id! }, "POST");
                        location.href = "/apps";
                      } else
                        setSecret(
                          (
                            await api<{ secret: string }>(
                              "app/secret/regenerate",
                              { id: app.id! },
                              "POST",
                            )
                          ).secret,
                        );
                    } catch (x) {
                      if ((x as Error).message !== "操作已取消")
                        setError((x as Error).message);
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {pending
                    ? "处理中…"
                    : dialog === "delete"
                      ? "确认删除"
                      : "确认重置"}
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </section>
  );
}
export function ProfileControl({
  api,
  session,
  onLogout,
  onSwitch,
  onAdd,
  position,
  setPosition,
}: {
  api: Api;
  session: Session;
  onLogout: () => void;
  onSwitch: (s: Session) => void;
  onAdd: () => void;
  position: string;
  setPosition: (p: string) => void;
}) {
  const qc = useQueryClient();
  const cached = (() => {
    try {
      return JSON.parse(
        localStorage.getItem(profileKey(session)) || "null",
      ) as Profile | null;
    } catch {
      return null;
    }
  })();
  const profile = useQuery({
    queryKey: ["profile", session.user_type, session.user_id],
    queryFn: async () => {
      const d = await api<Profile>("auth/profile");
      localStorage.setItem(profileKey(session), JSON.stringify(d));
      return d;
    },
    initialData: cached ?? undefined,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
  });
  const config = useQuery({
    queryKey: ["system-configs"],
    queryFn: () => api<{ max_avatar_bytes: number }>("system/configs"),
    staleTime: 300000,
  });
  const [open, setOpen] = useState(false),
    [menu, setMenu] = useState(false),
    [error, setError] = useState(""),
    [avatar, setAvatar] = useState(cached?.avatar || ""),
    [pending, setPending] = useState(false),
    [rename, setRename] = useState<{
      username: string;
      nickname: string;
    } | null>(null),
    [accounts, setAccounts] = useState<Session[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("zct_slms-accounts") || "[]");
      } catch {
        return [];
      }
    });
  useEffect(
    () => setAvatar(profile.data?.avatar || ""),
    [profile.data?.avatar],
  );
  useEffect(() => {
    if (session.user_type === "ADMIN" && session.force_setup) setOpen(true);
  }, [session]);
  useEffect(
    () =>
      setAccounts((old) => {
        const next = [
          ...old.filter(
            (a) =>
              a.user_type !== session.user_type ||
              a.user_id !== session.user_id,
          ),
          { ...session, nickname: profile.data?.nickname || session.username },
        ];
        localStorage.setItem("zct_slms-accounts", JSON.stringify(next));
        return next;
      }),
    [session, profile.data?.nickname],
  );
  const nickname = profile.data?.nickname || session.username,
    max = config.data?.max_avatar_bytes || 1048576;
  return (
    <div className="account-menu-wrap">
      <button
        className="profile profile-button"
        aria-expanded={menu}
        onClick={() => setMenu(!menu)}
      >
        <ChevronDown size={16} className="account-chevron" />
        <span className="avatar">
          {avatar ? <img src={avatar} alt="" /> : nickname[0]?.toUpperCase()}
        </span>
        <span className="profile-info">
          <strong>{nickname}</strong>
          <small>{session.username}</small>
        </span>
      </button>
      {menu && (
        <div className="account-menu">
          <button
            className="account-add"
            onClick={() => {
              setMenu(false);
              onAdd();
            }}
          >
            <Plus size={15} /> 添加账号
          </button>
          <div className="account-menu-list">
            {accounts.map((a) => (
              <button
                className={a.token === session.token ? "current" : ""}
                key={a.token}
                onClick={() => a.token !== session.token && onSwitch(a)}
              >
                <span>{a.username}</span>
                <small>
                  {a.user_type} · {a.user_id}
                <span role="button" tabIndex={0} aria-label={`移除账号 ${a.username}`} onClick={(e) => { e.stopPropagation(); const next = accounts.filter(x => x.token !== a.token); localStorage.setItem("zct_slms-accounts", JSON.stringify(next)); setAccounts(next); if(a.token === session.token) {localStorage.removeItem("zct_slms-session"); window.location.assign("/?accounts=1");} }} onKeyDown={(e) => {if(e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); e.currentTarget.click(); }}}>删除</span>
                </small>
                {a.token === session.token && <i>当前</i>}

              </button>
            ))}
          </div>
          <button
            className="account-menu-action"
            onClick={() => {
              setMenu(false);
              setOpen(true);
            }}
          >
            <Settings size={14} /> 用户资料
          </button>
          <button className="account-menu-action logout" onClick={onLogout}>
            <LogOut size={14} /> 退出登录
          </button>
        </div>
      )}
      {open && (
        <Dialog
          title={session.force_setup ? "首次管理员账号设置" : "用户资料"}
          close={() => !session.force_setup && setOpen(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                nickname = String(f.get("nickname"));
              try {
                setPending(true);
                setError("");
                const username = String(f.get("new_username"));
                if (
                  session.user_type === "ADMIN" &&
                  !session.force_setup &&
                  username !== session.username
                ) {
                  setRename({ username, nickname });
                  return;
                }
                let d: Profile | undefined;
                if (session.user_type === "ADMIN" && session.force_setup)
                  await api(
                    "admin/account",
                    {
                      current_password: "",
                      new_username: String(f.get("new_username")),
                      new_password: String(f.get("new_password")),
                      display_name: nickname,
                      avatar,
                    },
                    "POST",
                  );
                else
                  d = await api<Profile>(
                    "auth/profile",
                    { nickname, avatar },
                    "POST",
                  );
                const saved = d ?? {
                  user_id: session.user_id,
                  username: session.username,
                  user_type: session.user_type,
                  nickname,
                  avatar,
                };
                localStorage.setItem(
                  profileKey(session),
                  JSON.stringify(saved),
                );
                qc.setQueryData(
                  ["profile", session.user_type, session.user_id],
                  saved,
                );
                if (session.user_type === "ADMIN" && session.force_setup)
                  onLogout();
                else {
                  setOpen(false);
                  window.dispatchEvent(
                    new CustomEvent("zct_slms:success", {
                      detail: "用户资料已保存",
                    }),
                  );
                }
              } catch (x) {
                setError((x as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            <label>
              昵称
              <input name="nickname" defaultValue={nickname} required />
            </label>
            <label>
              用户名
              <input
                name="new_username"
                defaultValue={session.username}
                readOnly={session.user_type !== "ADMIN"}
                required
              />
            </label>
            {session.user_type === "ADMIN" && session.force_setup && (
              <>
                <label>
                  新密码
                  <input
                    name="new_password"
                    type="password"
                    minLength={12}
                    required={!!session.force_setup}
                  />
                </label>
              </>
            )}
            <label>
              头像（最大 {Math.round(max / 1024)} KB）
              <span className="avatar-upload">
                <span className="avatar">
                  {avatar ? (
                    <img src={avatar} alt="当前头像" />
                  ) : (
                    nickname[0]?.toUpperCase()
                  )}
                </span>
                <span>
                  选择图片<small>PNG、JPEG、WebP</small>
                </span>
                <input
                  className="avatar-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > max) {
                      setError("头像超过大小限制");
                      return;
                    }
                    const r = new FileReader();
                    r.onload = () => setAvatar(String(r.result));
                    r.readAsDataURL(file);
                  }}
                />
              </span>
            </label>
            <label>
              应用管理展示
              <CustomSelect
                defaultValue={localStorage.getItem("zct_slms-app-layout") || "auto"}
                onChange={(v) => {
                  localStorage.setItem("zct_slms-app-layout", v);
                  window.dispatchEvent(new Event("zct_slms:layout"));
                }}
                options={[
                  { value: "auto", label: "自动" },
                  { value: "list", label: "列表" },
                  { value: "cards", label: "卡片" },
                ]}
              />
            </label>
            <label>
              导航位置
              <CustomSelect
                value={position}
                onChange={setPosition}
                options={[
                  { value: "left", label: "左侧" },
                  { value: "right", label: "右侧" },
                  { value: "top", label: "顶部" },
                ]}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={pending}>
              保存资料
            </button>
          </form>
        </Dialog>
      )}
      {rename && (
        <Dialog
          title="验证身份后修改用户名"
          close={() => {
            if (!pending) setRename(null);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setPending(true);
                setError("");
                await api(
                  "admin/account",
                  {
                    new_username: rename.username,
                    display_name: rename.nickname,
                    avatar,
                  },
                  "POST",
                );
                const saved = {
                  user_id: session.user_id,
                  username: rename.username,
                  user_type: session.user_type,
                  nickname: rename.nickname,
                  avatar,
                };
                localStorage.setItem(
                  profileKey(session),
                  JSON.stringify(saved),
                );
                setRename(null);
                setOpen(false);
                window.dispatchEvent(
                  new CustomEvent("zct_slms:success", {
                    detail: "用户名已修改，请重新登录",
                  }),
                );
                onLogout();
              } catch (x) {
                setError((x as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            <p className="muted">
              管理员用户名将改为 {rename.username}，保存后需要重新登录。
            </p>
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={pending}>
              {pending ? "保存中…" : "确认修改"}
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
export function SubUsers({ api, apps }: { api: Api; apps: App[] }) {
  const qc = useQueryClient(),
    list = useQuery({
      queryKey: ["subusers"],
      queryFn: () => api<SubUser[]>("app/subusers"),
    }),
    config = useQuery({
      queryKey: ["system-configs"],
      queryFn: () =>
        api<{ owner_can_create_subuser: boolean }>("system/configs"),
    });
  const [search, setSearch] = useState(""),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const f = () => setCreating(true);
    window.addEventListener("zct_slms:create-subuser", f);
    return () => window.removeEventListener("zct_slms:create-subuser", f);
  }, []);
  const users = useMemo(
    () =>
      (list.data || []).filter((u) =>
        `${u.id} ${u.username} ${u.display_name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [list.data, search],
  );
  const access = async (u: SubUser, a: App, assigned: boolean) => {
    try {
      setBusy(true);
      await api(
        "app/subuser-access",
        {
          subuser_id: u.id,
          app_id: a.appid,
          action: assigned ? "unassign" : "assign",
        },
        "POST",
      );
      await qc.invalidateQueries({ queryKey: ["subusers"] });
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="panel">
        <div className="table-toolbar">
          <div className="user-toolbar">
            <div className="search">
              <Search size={16} />
              <input
                placeholder="搜索 UID、用户名、昵称"
                aria-label="搜索子用户"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        {error && <p className="error table-error">{error}</p>}
        {list.isError && (
          <p className="error table-error">{(list.error as Error).message}</p>
        )}
        <div className="table-scroll">
          <ResponsiveTable>
            <thead>
              <tr>
                <th>UID</th>
                <th>用户名</th>
                <th>昵称</th>
                <th>额度</th>
                <th>已用</th>
                <th>应用权限</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.display_name || "—"}</td>
                  <td>{u.quota_limit === -1 ? "不限" : u.quota_limit}</td>
                  <td>{u.quota_used}</td>
                  <td>
                    <div className="permission-list">
                      {apps.map((a) => {
                        const assigned = !!u.assigned_apps?.includes(a.appid);
                        return (
                          <button
                            disabled={busy}
                            className={assigned ? "assigned" : ""}
                            key={a.appid}
                            onClick={() => access(u, a, assigned)}
                          >
                            {a.name}
                            {assigned ? " ✓" : " +"}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <AccountActions
                      api={api}
                      user={u}
                      role="SUBUSER"
                      deleteOnly
                    />
                  </td>
                </tr>
              ))}
              {!list.isError && !users.length && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    {list.isLoading
                      ? "正在加载子用户…"
                      : search
                        ? "没有符合条件的子用户"
                        : "暂无子用户"}
                  </td>
                </tr>
              )}
            </tbody>
          </ResponsiveTable>
        </div>
      </section>
      {creating && (
        <Dialog title="创建子用户" close={() => setCreating(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                setBusy(true);
                setError("");
                if (!config.data?.owner_can_create_subuser)
                  throw new Error("管理员未允许创建子用户");
                await api(
                  "app/subusers",
                  {
                    username: String(f.get("username")),
                    password: String(f.get("password")),
                    display_name: String(f.get("display_name")),
                    quota_limit: String(f.get("quota_limit")),
                  },
                  "POST",
                );
                await qc.invalidateQueries({ queryKey: ["subusers"] });
                setCreating(false);
              } catch (x) {
                setError((x as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              用户名
              <input name="username" required />
            </label>
            <label>
              初始密码
              <input name="password" type="password" minLength={12} required />
            </label>
            <label>
              昵称
              <input name="display_name" />
            </label>
            <label>
              卡密额度
              <input
                name="quota_limit"
                type="number"
                min={-1}
                defaultValue={0}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={busy}>
              创建子用户
            </button>
          </form>
        </Dialog>
      )}
    </>
  );
}
