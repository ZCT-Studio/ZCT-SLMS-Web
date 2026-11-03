import { LoginFrame, AccountRoleTabs, WorkspaceBrand, Stat } from "./ProductUI";
import { ResponsiveTable } from "./ResponsiveTable";
import { BackLink } from "./BackLink";
import React, { useEffect, useMemo, useState } from "react";
import { MobileNavigation } from "./Navigation";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Copy,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Settings,
  X,
} from "lucide-react";
import { Management } from "./Management";
import { AppDanger, ProfileControl, SubUsers, Dialog } from "./Extras";
import { Policies } from "./Policies";
import { AppBrowser, SecuritySettings } from "./ApplicationViews";
import { AppDetails } from "./AppDetails";
import { AccountSettings } from "./AccountSettings";
import { CustomSelect, MultiSelect } from "./Select";
import { IdentityAccess, CompleteIdentityLogin } from "./Identity";
import { authenticateFactors, useHuman } from "./Security";
import {
  PrimaryLogin,
  MfaDialog,
  OnboardingGate,
  SecondMethodBanner,
} from "./AuthFlows";
import { RecoveryPage } from "./RecoveryPage";
import {
  VoucherPage,
  TicketsPage,
  ReviewPage,
  StaffUsers,
  SupportShell,
  TicketBadge,
} from "./Portal";
import { version as webVersion } from "../package.json";
import "./styles/style.css";
import "./styles/FormControls.css";
import "./styles/Portal.css";
import "./styles/Unified.css";
import {
  PasswordPromptHost,
  passwordField,
  requestPassword,
} from "./PasswordPrompt";

type Owner = {
  id: number;
  username: string;
  display_name: string;
  status: number;
};
type Session = {
  token: string;
  username: string;
  user_type: string;
  user_id: number;
  force_setup?: boolean;
};
type App = {
  id?: number;
  appid: string;
  name: string;
  description: string;
  binding_mode: string;
  dec_mode?: string;
  sign_enable?: number;
  notice?: string;
  status: string;
  created_at: number;
  creator: string;
  owner_id?: number;
  owner_username?: string;
};
type License = {
  appid?: string;
  app_name?: string;
  id: number;
  license: string;
  status: string;
  banned: boolean;
  expired?: boolean;
  binding_mode: string;
  bound_ip?: string;
  bound_ip_hash?: string;
  bound_device_fingerprint?: string;
  license_type: string;
  expires_at: number;
  created_at: number;
  creator: string;
};
type Audit = {
  actor_type: string;
  actor_id: number;
  action: string;
  target_type: string;
  result: string;
  ip: string;
  created_at: number;
};
for (const key of ["zct_slms-session", "zct_slms-accounts"]) {
  if (!localStorage.getItem(key) && sessionStorage.getItem(key))
    localStorage.setItem(key, sessionStorage.getItem(key)!);
  sessionStorage.removeItem(key);
}
const getSession = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem("zct_slms-session") || "null");
  } catch {
    return null;
  }
};
async function api<T>(
  path: string,
  params?: Record<string, string | number>,
  method = "GET",
): Promise<T> {
  const confirmation = passwordField(path, params || {}, method);
  if (confirmation && !params?.[confirmation])
    return requestPassword("确认当前操作", (password) =>
      api<T>(path, { ...params, [confirmation]: password }, method),
    );
  const token = getSession()?.token;
  const query =
    params && method === "GET"
      ? "?" +
        new URLSearchParams(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        )
      : "";
  const res = await fetch("/api/v1/" + path + query, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? JSON.stringify(params || {}) : undefined,
  });
  if (!res.ok)
    throw new Error(
      res.status === 502 || res.status === 503
        ? "后端服务不可用，请确认后端已启动并可访问"
        : `请求失败 (${res.status})`,
    );
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("后端返回了无法解析的响应，请检查接口地址或更新后端");
  }
  if (json.code !== 0) throw new Error(json.message || `错误 ${json.code}`);
  return json.data as T;
}
const date = (n: number) =>
  n > 0 ? new Date(n * 1000).toLocaleDateString("zh-CN") : "—";
const EMPTY_LICENSES: License[] = [];
const coreRows = getCoreRowModel<License>();
const licenseColumns = createColumnHelper<License>();
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const human = useHuman(api);
  const registration = window.location.pathname === "/register";
  const [role, setRole] = useState("owner");
  const [codeLogin, setCodeLogin] = useState(false);
  const [error, setError] = useState("");
  const schema = z.object({
    username: z.string().min(1, "请输入用户名"),
    password: z.string().min(1, "请输入密码"),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <LoginFrame title={registration ? "注册用户账号" : "欢迎回来"} links={<><a href="/api-docs.html">API 文档</a>{!registration && <a href="/register">注册</a>}</>}>
        {!registration && (
          <AccountRoleTabs value={role} onChange={(v) => {setRole(v);setCodeLogin(false);}} />
        )}
        {(!registration || role !== "owner") && !codeLogin && (
          <PrimaryLogin api={api} role={role} human={human} onLogin={onLogin} />
        )}
        {role === "owner" && (
          <IdentityAccess
            api={api}
            onLogin={onLogin}
            sharedHuman={human}
            mode={registration ? "all" : codeLogin ? "code" : "providers"}
          />
        )}
        {registration && (
          <div className="login-secondary-links">
            <BackLink href="/">返回登录</BackLink>
          </div>
        )}
        {!registration && (
          <div className={`login-secondary-links ${codeLogin ? "code-login-links" : ""}`}>

            {role === "owner" && (
              <button type="button" onClick={() => setCodeLogin((v) => !v)}>
                {codeLogin ? "使用密码" : "使用验证码"}
              </button>
            )}
            {!codeLogin && <a href="/forgot-password">忘记密码</a>}
          </div>
        )}
    </LoginFrame>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog title={title} close={onClose}>
      {children}
    </Dialog>
  );
}
function AppShell({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  const location = useLocation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState(
    () => new URLSearchParams(window.location.search).get("app") || "",
  );
  const [modal, setModal] = useState("");
  const [navigationOpen, setNavigationOpen] = useState(false);
  useEffect(() => {
    if (location.pathname === "/vouchers")
      window.location.replace(
        session.user_type === "ADMIN" ? "/invite-codes" : "/balance-codes",
      );
  }, [location.pathname, session.user_type]);
  const [result, setResult] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [position, setPositionState] = useState(
    () => localStorage.getItem("zct_slms-nav-position") || "left",
  );
  const setPosition = (v: string) => {
    localStorage.setItem("zct_slms-nav-position", v);
    setPositionState(v);
  };
  const [action, setAction] = useState<{
    type: string;
    license: License;
  } | null>(null);
  const system = useQuery({
    queryKey: ["system-configs"],
    queryFn: () =>
      api<{ owner_can_create_subuser: boolean; max_avatar_bytes: number }>(
        "system/configs",
      ),
  });
  const owners = useQuery({
    queryKey: ["users"],
    queryFn: () => api<Owner[]>("admin/owner/list"),
    enabled: session.user_type === "ADMIN" && modal === "app",
  });
  const apps = useQuery({
    queryKey: ["apps"],
    queryFn: () => api<App[]>("app/list"),
  });
  const current = selected || apps.data?.[0]?.appid || "";
  const [licenseApps, setLicenseApps] = useState<string[]>(() => {
    const id = new URLSearchParams(window.location.search).get("app");
    return id ? [id] : [];
  });
  const licenseIds =
    location.pathname === "/licenses"
      ? licenseApps.length
        ? licenseApps
        : (apps.data || []).map((a) => a.appid)
      : [current];
  const licenses = useQuery({
    queryKey: ["licenses", licenseIds],
    queryFn: async () => {
      const out: License[] = [];
      for (let i = 0; i < licenseIds.length; i += 4) {
        const groups = await Promise.all(
          licenseIds.slice(i, i + 4).map(async (id) =>
            (await api<License[]>("license/list", { app_id: id })).map((r) => ({
              ...r,
              appid: id,
              app_name: apps.data?.find((a) => a.appid === id)?.name || id,
            })),
          ),
        );
        for (const g of groups) out.push(...g);
      }
      return out;
    },
    enabled:
      !!licenseIds.length &&
      !!current &&
      ["/", "/licenses"].includes(location.pathname),
  });
  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () => api<Audit[]>("admin/audit/list", { limit: 100 }),
    enabled: session.user_type === "ADMIN" && location.pathname === "/audit",
  });
  const mutation = useMutation({
    mutationFn: ({
      path,
      body,
    }: {
      path: string;
      body: Record<string, string | number>;
    }) => api<unknown>(path, body, "POST"),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["apps"] });
      qc.invalidateQueries({ queryKey: ["licenses"] });
      qc.invalidateQueries({ queryKey: ["license-balance"] });
      window.dispatchEvent(
        new CustomEvent("zct_slms:success", { detail: "操作成功" }),
      );
      if (vars.path === "license/create") {
        const d = data as { licenses: string[] };
        setResult(d.licenses.join("\n"));
      } else if (vars.path === "app/create") {
        const d = data as { appid: string; secret?: string };
        setResult(
          `应用 ID：${d.appid}\n${d.secret ? `APPSECRET（仅展示一次，请立即保存）：\n${d.secret}` : "可在应用详情输入密码后查看密钥。"}`,
        );
      } else setModal("");
    },
    onError: (e) => {
      if (!modal) setNotice(e.message);
    },
  });
  const list = licenses.data ?? EMPTY_LICENSES;
  const [licenseStates, setLicenseStates] = useState<string[]>([]);
  const filtered = useMemo(
    () =>
      list.filter(
        (x) =>
          (!licenseStates.length ||
            licenseStates.some((s) =>
              s === "BANNED"
                ? x.banned
                : s === "EXPIRED"
                  ? x.expired || x.status.toLowerCase() === "expired"
                  : s === "UNUSED"
                    ? !x.banned &&
                      !x.expired &&
                      x.status.toLowerCase() === "unused"
                    : !x.banned &&
                      !x.expired &&
                      x.status.toLowerCase() === "active",
            )) &&
          `${x.license} ${x.status} ${x.creator} ${x.license_type}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [list, search, licenseStates],
  );
  const active = list.filter(
    (x) => !x.banned && !x.expired && x.status.toLowerCase() === "active",
  ).length;
  const banned = list.filter((x) => x.banned).length;
  const columns = licenseColumns;
  const tableColumns = useMemo(
    () => [
      ...(location.pathname === "/licenses"
        ? [
            columns.accessor("app_name", {
              header: "所属应用",
              cell: (i) => i.getValue() || "—",
            }),
          ]
        : []),
      columns.accessor("license", {
        header: "卡密",
        cell: (i) => <span className="mono">{i.getValue()}</span>,
      }),
      columns.accessor("status", {
        header: "状态",
        cell: (i) => (
          <span
            className={"badge " + (i.row.original.banned ? "red" : "green")}
          >
            <i />
            {i.row.original.banned
              ? "已封禁"
              : i.row.original.expired
                ? "已过期"
                : (
                    {
                      unused: "未使用",
                      active: "已使用",
                      expired: "已过期",
                    } as Record<string, string>
                  )[i.getValue().toLowerCase()] || i.getValue()}
          </span>
        ),
      }),
      columns.accessor("license_type", {
        header: "类型",
        cell: (i) => i.getValue() || "—",
      }),
      columns.accessor("binding_mode", {
        header: "绑定方式",
        cell: (i) =>
          ({
            NONE: "无",
            IP: "IP",
            DEVICE: "设备",
            IP_AND_DEVICE: "设备和 IP",
          })[i.getValue()] || i.getValue(),
      }),
      ...(apps.data?.some(
        (a) => licenseIds.includes(a.appid) && a.binding_mode.includes("IP"),
      )
        ? [
            columns.display({
              id: "bound_ip",
              header: "绑定 IP",
              cell: (i) => (
                <span className="binding-value">
                  {i.row.original.bound_ip ||
                    (i.row.original.bound_ip_hash
                      ? "已绑定（原始 IP 不可用）"
                      : "未绑定")}
                </span>
              ),
            }),
          ]
        : []),
      ...(apps.data?.some(
        (a) =>
          licenseIds.includes(a.appid) &&
          ["DEVICE", "IP_AND_DEVICE"].includes(a.binding_mode),
      )
        ? [
            columns.display({
              id: "bound_device",
              header: "绑定设备指纹",
              cell: (i) => (
                <code
                  className="binding-fingerprint"
                  title={i.row.original.bound_device_fingerprint}
                >
                  {i.row.original.bound_device_fingerprint || "未绑定"}
                </code>
              ),
            }),
          ]
        : []),
      columns.accessor("created_at", {
        header: "创建时间",
        cell: (i) => date(i.getValue()),
      }),
      columns.accessor("expires_at", {
        header: "到期时间",
        cell: (i) => date(i.getValue()),
      }),
      columns.display({
        id: "actions",
        header: "操作",
        cell: (i) => (
          <div className="row-actions">
            {[
              ["toggle", i.row.original.banned ? "解封" : "封禁"],
              ["unbind", "解绑"],
              ["delete", "删除"],
              ["extend", "延长"],
              ["expire", "到期"],
              ["type", "类型"],
              ["limit", "解绑设置"],
            ].map(([type, label]) => (
              <button
                key={type}
                onClick={() => setAction({ type, license: i.row.original })}
              >
                {label}
              </button>
            ))}
          </div>
        ),
      }),
    ],
    [apps.data, current, location.pathname, licenseIds.join(",")],
  );
  const table = useReactTable({
    data: filtered,
    columns: tableColumns,
    getCoreRowModel: coreRows,
  });
  const title = ["/vouchers", "/invite-codes", "/balance-codes"].includes(
    location.pathname,
  )
    ? "兑换码"
    : location.pathname === "/support-users"
      ? "支持账号"
      : location.pathname === "/tickets"
        ? "工单系统"
        : location.pathname === "/review"
          ? "内容审查"
          : location.pathname === "/moderation"
            ? "审查设置"
            : location.pathname === "/app-details"
              ? "应用详情"
              : location.pathname === "/app-settings"
                ? "应用设置"
                : location.pathname === "/subusers"
                  ? "子用户管理"
                  : location.pathname === "/security"
                    ? "安全设置"
                    : location.pathname === "/policies"
                      ? "平台设置"
                      : location.pathname === "/management"
                        ? session.user_type === "ADMIN"
                          ? "用户列表"
                          : "应用设置"
                        : location.pathname.startsWith("/account")
                          ? "账号设置"
                          : location.pathname === "/apps"
                            ? "应用管理"
                            : location.pathname === "/licenses"
                              ? "卡密管理"
                              : location.pathname === "/audit"
                                ? "审计日志"
                                : "工作台";
  return (
    <div
      className={
        "layout nav-" + position + (navigationOpen ? " navigation-open" : "")
      }
    >
      <MobileNavigation open={navigationOpen} setOpen={setNavigationOpen} />
      <aside className="sidebar">
        <WorkspaceBrand />
        <nav>
          <NavLink reloadDocument to="/" end>
            <LayoutDashboard />
            概览
          </NavLink>
          <NavLink
            reloadDocument
            to="/apps"
            className={
              location.pathname === "/app-details" ? "active" : undefined
            }
          >
            <Box />
            应用管理
          </NavLink>
          <NavLink reloadDocument to="/licenses">
            <KeyRound />
            卡密管理
          </NavLink>
          <NavLink
            reloadDocument
            to={session.user_type === "ADMIN" ? "/management" : "/app-settings"}
          >
            <ClipboardList />
            {session.user_type === "ADMIN" ? "用户列表" : "应用设置"}
          </NavLink>
          {session.user_type === "ADMIN" && (
            <NavLink reloadDocument to="/app-settings">
              <Box />
              应用设置
            </NavLink>
          )}
          {session.user_type === "USER" && (
            <NavLink reloadDocument to="/subusers">
              <ClipboardList />
              子用户管理
            </NavLink>
          )}
          {session.user_type === "ADMIN" && (
            <NavLink reloadDocument to="/security">
              <ShieldCheck />
              安全设置
            </NavLink>
          )}
          <NavLink
            reloadDocument
            to="/account"
            className={
              location.pathname.startsWith("/account") ? "active" : undefined
            }
          >
            <Settings />
            账号设置
          </NavLink>
          {session.user_type === "ADMIN" && (
            <NavLink reloadDocument to="/policies">
              <ShieldCheck />
              平台设置
            </NavLink>
          )}
          {session.user_type === "ADMIN" && (
            <NavLink reloadDocument to="/audit">
              <ClipboardList />
              审计日志
            </NavLink>
          )}
          <NavLink reloadDocument to="/tickets">
            <ClipboardList />
            工单系统
            <TicketBadge api={api} />
          </NavLink>
          {session.user_type === "ADMIN" && (
            <>
              <NavLink reloadDocument to="/review">
                <ShieldCheck />
                内容审查
              </NavLink>
              <NavLink reloadDocument to="/support-users">
                <ShieldCheck />
                支持账号
              </NavLink>
            </>
          )}
          <NavLink
            reloadDocument
            to="/vouchers"
            className={
              ["/vouchers", "/invite-codes", "/balance-codes"].includes(
                location.pathname,
              )
                ? "active"
                : undefined
            }
          >
            <KeyRound />
            兑换码
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <ProfileControl
            api={api}
            session={session}
            position={position}
            setPosition={setPosition}
            onAdd={() => {
              window.location.assign("/?accounts=1&add=1");
            }}
            onSwitch={(account) => {
              localStorage.setItem("zct_slms-session", JSON.stringify(account));
              qc.clear();
              window.location.href = "/";
            }}
            onLogout={async () => {
              try {
                await api("auth/logout", {}, "POST");
              } catch {}
              let all: Session[] = [];
              try {
                all = JSON.parse(localStorage.getItem("zct_slms-accounts") || "[]");
              } catch {}
              localStorage.setItem(
                "zct_slms-accounts",
                JSON.stringify(all.filter((a) => a.token !== session.token)),
              );
              localStorage.removeItem("zct_slms-session");
              qc.clear();
              onLogout();
            }}
          />
        </div>
      </aside>
      <main>
        <div className="content">
          <SecondMethodBanner api={api} />
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {![
              "/tickets",
              "/vouchers",
              "/invite-codes",
              "/balance-codes",
              "/review",
              "/moderation",
              "/support-users",
              "/app-details",
            ].includes(location.pathname) && (
              <div
                className={
                  "page-heading" +
                  (location.pathname === "/" ? " overview-heading" : "")
                }
              >
                <div>
                  <h1>
                    {title === "工作台"
                      ? `你好，${session.username} 👋`
                      : title}
                  </h1>
                  <p>
                    {title === "工作台"
                      ? "欢迎回到控制台，您的授权业务一目了然。"
                      : title === "应用管理"
                        ? "管理您的应用和授权接入。"
                        : title === "卡密管理"
                          ? "创建、查找和管理应用下的授权卡密。"
                          : title === "账号设置"
                            ? "管理您的登录凭据。"
                            : title === "审计日志"
                              ? "查看平台最近的管理操作记录。"
                              : title === "用户列表"
                                ? "管理用户资料、余额与账号状态。"
                                : title === "子用户管理"
                                  ? "管理子用户与应用访问权限。"
                                  : title === "安全设置"
                                    ? "配置注册登录、身份验证和权限策略。"
                                    : title === "平台设置"
                                      ? "管理平台参数、邮件服务与系统信息。"
                                      : title === "应用设置"
                                        ? "配置应用安全、公告、版本和心跳。"
                                        : "管理平台设置。"}
                  </p>
                </div>
                <div className="heading-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      qc.invalidateQueries();
                    }}
                  >
                    <RefreshCw size={16} /> 刷新
                  </button>
                  {location.pathname === "/management" &&
                    session.user_type === "ADMIN" && (
                      <button
                        className="primary"
                        onClick={() =>
                          window.dispatchEvent(new Event("zct_slms:create-user"))
                        }
                      >
                        <Plus size={16} /> 新建用户
                      </button>
                    )}
                  {location.pathname === "/subusers" && (
                    <button
                      className="primary"
                      disabled={!system.data?.owner_can_create_subuser}
                      title={
                        system.data?.owner_can_create_subuser
                          ? "创建子用户"
                          : "管理员尚未允许创建子用户"
                      }
                      onClick={() =>
                        window.dispatchEvent(new Event("zct_slms:create-subuser"))
                      }
                    >
                      <Plus size={16} /> 创建子用户
                    </button>
                  )}
                  {["/", "/apps", "/licenses"].includes(location.pathname) && (
                    <button
                      className="primary"
                      onClick={() => {
                        setResult("");
                        mutation.reset();
                        setModal(
                          location.pathname === "/apps" ? "app" : "license",
                        );
                      }}
                    >
                      <Plus size={17} />
                      {location.pathname === "/apps" ? "创建应用" : "生成卡密"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {notice && (
              <div className="notice" onClick={() => setNotice("")}>
                {notice}
                <X size={15} />
              </div>
            )}
            {apps.isError &&
              [
                "/",
                "/apps",
                "/licenses",
                "/app-settings",
                "/app-details",
                "/subusers",
              ].includes(location.pathname) && (
                <div className="error">
                  应用列表加载失败：{(apps.error as Error).message}
                </div>
              )}
            {location.pathname === "/" && (
              <>
                <div className="section-title">
                  <div>
                    <h2>数据概览</h2>
                    <p>基于当前应用的实时数据</p>
                  </div>
                  <AppSelect
                    apps={apps.data || []}
                    value={current}
                    onChange={setSelected}
                  />
                </div>
                <div className="stats overview-stats">
                  <LicenseBalance appId={current} card />
                  <Stat
                    icon={<Box />}
                    label="应用总数"
                    value={apps.data?.length}
                    hint="当前账户可见应用"
                    color="purple"
                  />
                  <Stat
                    icon={<KeyRound />}
                    label="卡密总数"
                    value={current ? list.length : undefined}
                    hint="当前应用下的卡密"
                    color="blue"
                  />
                  <Stat
                    icon={<Activity />}
                    label="活跃卡密"
                    value={current ? active : undefined}
                    hint="已激活且未被封禁"
                    color="green"
                  />
                  <Stat
                    icon={<ShieldCheck />}
                    label="已封禁"
                    value={current ? banned : undefined}
                    hint="当前应用下的卡密"
                    color="orange"
                  />
                </div>
              </>
            )}
            {location.pathname === "/apps" &&
              (apps.isPending ? (
                <div className="panel empty-state">正在加载应用…</div>
              ) : (
                !apps.isError && <AppBrowser apps={apps.data || []} />
              ))}
            {location.pathname === "/app-details" &&
              (apps.isLoading ? (
                <div className="panel management-card">正在加载应用详情…</div>
              ) : apps.data?.find((a) => a.appid === selected) ? (
                <AppDetails
                  key={selected}
                  app={apps.data.find((a) => a.appid === selected)!}
                  api={api}
                  role={session.user_type}
                />
              ) : (
                !apps.isError && (
                  <div className="panel management-card">
                    <p className="muted">应用不存在或当前账号无权访问。</p>
                    <BackLink href="/apps">返回应用管理</BackLink>
                  </div>
                )
              ))}
            {location.pathname === "/app-settings" && (
              <>
                <div className="management-selector">
                  <label>
                    选择应用{" "}
                    <AppSelect
                      apps={apps.data || []}
                      value={current}
                      onChange={setSelected}
                    />
                  </label>
                </div>
                {current && apps.data?.find((a) => a.appid === current) ? (
                  <>
                    <div className="management-below">
                      <Management
                        api={api}
                        apps={apps.data || []}
                        current={current}
                        setCurrent={setSelected}
                        role="USER"
                        hideSelector
                        onLogout={onLogout}
                      />
                    </div>
                  </>
                ) : (
                  <div className="panel management-card">请先选择应用。</div>
                )}
              </>
            )}
            {location.pathname === "/subusers" &&
              (session.user_type === "USER" ? (
                <SubUsers api={api} apps={apps.data || []} />
              ) : (
                <div className="error">仅用户账号可管理子用户。</div>
              ))}
            {location.pathname === "/security" &&
              session.user_type === "ADMIN" && <SecuritySettings api={api} />}
            {["/invite-codes", "/balance-codes"].includes(location.pathname) &&
              (location.pathname === "/invite-codes" &&
              session.user_type === "SUBUSER" ? (
                <section className="panel management-card">
                  子用户不能绑定邀请码。
                </section>
              ) : (
                <VoucherPage
                  api={api}
                  role={session.user_type}
                  kind={
                    location.pathname === "/invite-codes" ? "INVITE" : "BALANCE"
                  }
                  key={location.pathname}
                />
              ))}
            {location.pathname === "/tickets" && (
              <TicketsPage api={api} role={session.user_type} />
            )}
            {location.pathname === "/review" &&
              session.user_type === "ADMIN" && (
                <ReviewPage api={api} canManageRules />
              )}
            {location.pathname === "/support-users" &&
              session.user_type === "ADMIN" && <StaffUsers api={api} />}
            {location.pathname === "/moderation" &&
              session.user_type === "ADMIN" && (
                <ReviewPage api={api} canManageRules initialTab="FILTER" />
              )}
            {location.pathname.startsWith("/account") && (
              <AccountSettings
                api={api}
                session={session}
                onLogout={onLogout}
              />
            )}
            {location.pathname === "/policies" &&
              (session.user_type === "ADMIN" ? (
                <Policies api={api} />
              ) : (
                <div className="error">需要管理员权限。</div>
              ))}
            {location.pathname === "/licenses" && (
              <div className="panel">
                <div className="table-toolbar">
                  <div>
                    <h2>全部卡密</h2>
                    <p>共 {filtered.length} 条记录</p>
                  </div>
                  <div className="filters">
                    <div className="search">
                      <Search size={16} />
                      <input
                        placeholder="搜索卡密、类型或创建者"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <MultiSelect
                      ariaLabel="卡密状态"
                      values={licenseStates}
                      onChange={setLicenseStates}
                      placeholder="全部状态"
                      options={[
                        { value: "UNUSED", label: "未使用" },
                        { value: "USED", label: "已使用" },
                        { value: "BANNED", label: "已封禁" },
                        { value: "EXPIRED", label: "已过期" },
                      ]}
                    />
                    <MultiSelect
                      ariaLabel="应用筛选"
                      values={licenseApps}
                      onChange={setLicenseApps}
                      placeholder="全部应用"
                      options={(apps.data || []).map((a) => ({
                        value: a.appid,
                        label: a.name + " · " + a.appid,
                      }))}
                    />
                  </div>
                </div>
                <LicenseTable
                  table={table}
                  loading={licenses.isLoading}
                  error={licenses.error as Error | null}
                />
              </div>
            )}
            {location.pathname === "/management" && (
              <Management
                api={api}
                apps={apps.data || []}
                current={current}
                setCurrent={setSelected}
                role={session.user_type}
                onLogout={onLogout}
              />
            )}
            {location.pathname === "/audit" && (
              <div className="panel">
                <div className="table-toolbar">
                  <div>
                    <h2>最近操作</h2>
                    <p>最近 100 条审计记录</p>
                  </div>
                </div>
                {audit.isError ? (
                  apps.isError ? null : (
                    <div className="error">
                      {(audit.error as Error).message}
                    </div>
                  )
                ) : (
                  <div className="table-scroll">
                    <ResponsiveTable>
                      <thead>
                        <tr>
                          {["操作", "操作者", "目标", "结果", "IP", "时间"].map(
                            (x) => (
                              <th key={x}>{x}</th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {audit.data?.map((a, i) => (
                          <tr key={i}>
                            <td>{a.action}</td>
                            <td>
                              {a.actor_type} #{a.actor_id}
                            </td>
                            <td>{a.target_type}</td>
                            <td>{a.result}</td>
                            <td>{a.ip}</td>
                            <td>{date(a.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </ResponsiveTable>
                    {!audit.data?.length && (
                      <Empty
                        text={audit.isLoading ? "加载中…" : "暂无审计记录"}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
        <div className="footer fixed-footer">
          <span>© ZCT-SLMS</span>
        </div>
      </main>
      {modal && (
        <Modal
          title={
            result ? "创建成功" : modal === "app" ? "创建应用" : "生成卡密"
          }
          onClose={() => {
            setModal("");
            setResult("");
            mutation.reset();
          }}
        >
          {mutation.isError && (
            <div className="error" role="alert">
              {mutation.error.message}
            </div>
          )}
          {result ? (
            <>
              <p className="muted">请立即复制并妥善保存以下信息。</p>
              <pre className="result">{result}</pre>
              <button
                className="primary"
                onClick={() =>
                  navigator.clipboard
                    .writeText(result)
                    .then(() =>
                      window.dispatchEvent(
                        new CustomEvent("zct_slms:success", {
                          detail: "已复制到剪贴板",
                        }),
                      ),
                    )
                    .catch(() => setNotice("复制失败，请手动选择复制"))
                }
              >
                <Copy size={16} /> 复制内容
              </button>
            </>
          ) : modal === "app" ? (
            <CreateApp
              role={session.user_type}
              owners={owners.data || []}
              loading={owners.isLoading}
              error={owners.error as Error | null}
              pending={mutation.isPending}
              onSubmit={(body) => mutation.mutate({ path: "app/create", body })}
            />
          ) : (
            <CreateLicense
              apps={apps.data || []}
              current={current}
              pending={mutation.isPending}
              onSubmit={(body) =>
                mutation.mutate({ path: "license/create", body })
              }
            />
          )}
        </Modal>
      )}
      {action && (
        <LicenseAction
          action={action}
          pending={mutation.isPending}
          error={mutation.error as Error | null}
          close={() => {
            setAction(null);
            mutation.reset();
          }}
          submit={(path, body) => {
            mutation.reset();
            mutation.mutate(
              { path, body },
              { onSuccess: () => setAction(null) },
            );
          }}
        />
      )}
    </div>
  );
}
function AppSelect({
  apps,
  value,
  onChange,
}: {
  apps: App[];
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      ariaLabel="选择应用"
      placeholder="暂无应用"
      options={apps.map((a) => ({ value: a.appid, label: a.name }))}
    />
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <div>
        <KeyRound size={22} />
      </div>
      <p>{text}</p>
    </div>
  );
}
function LicenseTable({
  table,
  loading,
  error,
  limit,
}: {
  table: ReturnType<typeof useReactTable<License>>;
  loading: boolean;
  error: Error | null;
  limit?: number;
}) {
  return (
    <div className="table-scroll">
      {error ? (
        <div className="error">{error.message}</div>
      ) : (
        <>
          <ResponsiveTable>
            <thead>
              {table.getHeaderGroups().map((g) => (
                <tr key={g.id}>
                  {g.headers.map((h) => (
                    <th key={h.id}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table
                .getRowModel()
                .rows.slice(0, limit)
                .map((r) => (
                  <tr key={r.id}>
                    {r.getVisibleCells().map((c) => (
                      <td key={c.id}>
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </ResponsiveTable>
          {!table.getRowModel().rows.length && (
            <Empty text={loading ? "加载中…" : "暂无卡密记录"} />
          )}
        </>
      )}
    </div>
  );
}
function CreateApp({
  role,
  owners,
  loading,
  error,
  pending,
  onSubmit,
}: {
  role: string;
  owners: Owner[];
  loading: boolean;
  error: Error | null;
  pending: boolean;
  onSubmit: (b: Record<string, string | number>) => void;
}) {
  const available = owners.filter((o) => o.status === 1);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          name: String(f.get("name")),
          description: String(f.get("description")),
          ...(role === "ADMIN" ? { owner_id: String(f.get("owner_id")) } : {}),
        });
      }}
    >
      {role === "ADMIN" && (
        <>
          <label>
            应用所有者
            <CustomSelect
              name="owner_id"
              placeholder={loading ? "加载用户中…" : "请选择应用所有者"}
              options={available.map((o) => ({
                value: String(o.id),
                label:
                  o.username +
                  (o.display_name ? " · " + o.display_name : "") +
                  " (UID " +
                  o.id +
                  ")",
              }))}
            />
          </label>
          {error && <p className="error">{error.message}</p>}
        </>
      )}
      <label>
        应用名称
        <input name="name" required />
      </label>
      <label>
        应用描述
        <textarea name="description" />
      </label>
      <button
        disabled={pending || (role === "ADMIN" && !available.length)}
        className="primary"
      >
        {pending ? "创建中…" : "创建应用"}
      </button>
    </form>
  );
}
function LicenseBalance({
  appId,
  card = false,
}: {
  appId: string;
  card?: boolean;
}) {
  const session = getSession();
  const q = useQuery({
    queryKey: ["license-balance", session?.user_type, session?.user_id, appId],
    queryFn: () =>
      api<{
        available: number | null;
        owner_username?: string;
        cost_per_license: number;
      }>("auth/balance", appId ? { app_id: appId } : {}),
    staleTime: 10000,
    refetchInterval: 30000,
  });
  const amount =
    q.data?.available === -1
      ? "不限额"
      : q.data?.available == null
        ? "—"
        : q.data.available;
  const hint = q.isError
    ? (q.error as Error).message
    : q.data?.owner_username
      ? "所属用户：" + q.data.owner_username
      : "每张卡密消耗 1 余额";
  return card ? (
    <div className="stat panel">
      <div className="stat-top">
        <div className="stat-icon purple">
          <KeyRound />
        </div>
        <span>实时</span>
      </div>
      <div className="stat-label">卡密余额</div>
      <div className="stat-number">{amount}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  ) : (
    <div className="license-credit-summary">
      <div>
        <span>可用卡密余额</span>
        <strong>{amount}</strong>
      </div>
      <small>{hint}</small>
    </div>
  );
}
function CreateLicense({
  apps,
  current,
  pending,
  onSubmit,
}: {
  apps: App[];
  current: string;
  pending: boolean;
  onSubmit: (b: Record<string, string | number>) => void;
}) {
  const [appId, setAppId] = useState(current || apps[0]?.appid || "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          app_id: String(f.get("app_id")),
          count: Number(f.get("count")),
          seconds_per_license: Number(f.get("days")) * 86400,
          license_type: String(f.get("license_type")),
          binding_mode: String(f.get("binding_mode")),
        });
      }}
    >
      <LicenseBalance appId={appId} />
      <label>
        所属应用
        <CustomSelect
          name="app_id"
          value={appId}
          onChange={setAppId}
          options={apps.map((a) => ({ value: a.appid, label: a.name }))}
        />
      </label>
      <div className="form-row">
        <label>
          生成数量
          <input
            name="count"
            type="number"
            min="1"
            max="1000"
            defaultValue="1"
            required
          />
        </label>
        <label>
          有效时长（天）
          <input name="days" type="number" min="1" defaultValue="30" required />
        </label>
      </div>
      <label>
        卡密类型（可自定义）
        <input name="license_type" maxLength={64} />
      </label>
      <label>
        绑定方式
        <CustomSelect
          name="binding_mode"
          defaultValue=""
          options={[
            { value: "", label: "使用应用默认设置" },
            { value: "NONE", label: "无" },
            { value: "IP", label: "IP" },
            { value: "DEVICE", label: "设备" },
            { value: "IP_AND_DEVICE", label: "设备和 IP" },
          ]}
        />
      </label>
      <button className="primary" disabled={pending || !apps.length}>
        {pending ? "生成中…" : "生成卡密"}
      </button>
    </form>
  );
}

function LicenseAction({
  action,
  pending,
  error,
  close,
  submit,
}: {
  action: { type: string; license: License };
  pending: boolean;
  error: Error | null;
  close: () => void;
  submit: (path: string, body: Record<string, string | number>) => void;
}) {
  const { type, license } = action;
  const labels: Record<string, string> = {
    toggle: license.banned ? "解封卡密" : "封禁卡密",
    unbind: "解除绑定",
    delete: "删除卡密",
    extend: "延长有效期",
    expire: "设置到期时间",
    type: "修改卡密类型",
    limit: "设置解绑次数",
  };
  return (
    <Dialog title={labels[type]} close={close}>
      <p className="muted">卡密：{license.license}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const id = license.id;
          let path = "",
            body: Record<string, string | number> = { license_id: id };
          if (type === "toggle") path = license.banned ? "unban" : "ban";
          if (type === "unbind") path = "unbind";
          if (type === "delete") path = "delete";
          if (type === "extend") {
            path = "add-time";
            body.seconds =
              Number(f.get("days") || 0) * 86400 +
              Number(f.get("hours") || 0) * 3600 +
              Number(f.get("minutes") || 0) * 60 +
              Number(f.get("seconds") || 0);
            if (!Number.isSafeInteger(body.seconds) || body.seconds <= 0) {
              e.currentTarget
                .querySelector<HTMLInputElement>('[name="seconds"]')
                ?.setCustomValidity("延长时间至少为 1 秒");
              e.currentTarget.reportValidity();
              return;
            }
          }
          if (type === "expire") {
            path = "set-time";
            const d = String(f.get("date") || "");
            if (!d) {
              body.permanent = "1";
            } else {
              const n = Date.parse(d + "T23:59:59");
              if (Number.isNaN(n)) return;
              body.expires_at = Math.floor(n / 1000);
            }
          }
          if (type === "type") {
            path = "set-type";
            body.license_type = String(f.get("type"));
          }
          if (type === "limit") {
            path = "unbind-info";
            body.unbind_limit = Number(f.get("limit"));
          }
          submit("license/" + path, body);
        }}
      >
        {type === "extend" && (
          <div className="form-row duration-fields">
            {[
              ["days", "天"],
              ["hours", "小时"],
              ["minutes", "分钟"],
              ["seconds", "秒"],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input
                  type="number"
                  name={name}
                  min="0"
                  step="1"
                  defaultValue={name === "days" ? "1" : "0"}
                  required
                  onInput={(e) => {
                    e.currentTarget.form
                      ?.querySelector<HTMLInputElement>('[name="seconds"]')
                      ?.setCustomValidity("");
                  }}
                />
              </label>
            ))}
          </div>
        )}
        {type === "expire" && (
          <label>
            到期日期（留空表示永久）
            <input type="date" name="date" />
          </label>
        )}
        {type === "type" && (
          <label>
            卡密类型
            <input
              name="type"
              defaultValue={license.license_type}
              maxLength={64}
              required
            />
          </label>
        )}
        {type === "limit" && (
          <label>
            解绑次数上限
            <input
              name="limit"
              type="number"
              min="0"
              defaultValue="0"
              required
            />
          </label>
        )}
        {type === "delete" && <p className="error">确认删除这张卡密？</p>}
        {error && (
          <p role="alert" className="error">
            {error.message}
          </p>
        )}
        <div className="app-card-actions">
          <button type="button" className="secondary" onClick={close}>
            取消
          </button>
          <button className="primary" disabled={pending}>
            {pending ? "处理中…" : "确认"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function SuccessPopup() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let timer: number | undefined;
    const f = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail || "操作成功");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(""), 2200);
    };
    window.addEventListener("zct_slms:success", f);
    return () => {
      window.removeEventListener("zct_slms:success", f);
      window.clearTimeout(timer);
    };
  }, []);
  return message ? (
    <div className="success-layer" role="status">
      <div className="success-pop">
        <span>✓</span>
        <strong>{message}</strong>
        <button aria-label="关闭" onClick={() => setMessage("")}>
          ×
        </button>
      </div>
    </div>
  ) : null;
}
function SavedAccounts() {
  const [accounts, setAccounts] = useState<Array<Session & {nickname?: string}>>(() => {
    try { const rows = JSON.parse(localStorage.getItem("zct_slms-accounts") || "[]"); return Array.isArray(rows) ? rows.filter(a => a?.token && a?.username) : []; } catch { return []; }
  });
  const [adding, setAdding] = useState(() => new URLSearchParams(location.search).has("add"));
  const remove = (token: string) => {
    const next = accounts.filter(a => a.token !== token);
    localStorage.setItem("zct_slms-accounts", JSON.stringify(next));
    if (getSession()?.token === token) localStorage.removeItem("zct_slms-session");
    setAccounts(next);
  };
  if (adding) return <><Login onLogin={() => window.location.assign("/")} /><a className="saved-account-back" href="/?accounts=1">返回已保存的账号</a></>;
  return <div className="login-page"><div className="login-brand">ZCT-SLMS</div><div className="login-card"><h1>已保存的账号</h1><div className="saved-account-list">{accounts.map(a => <div className="saved-account-row" key={a.token}><button onClick={() => {localStorage.setItem("zct_slms-session", JSON.stringify(a)); window.location.assign("/");}}><strong>{a.nickname || a.username}</strong><small>{a.username}</small></button><button className="saved-account-remove" aria-label={`移除账号 ${a.username}`} onClick={() => remove(a.token)}>删除</button></div>)}</div><button className="primary" onClick={() => window.location.assign("/?accounts=1&add=1")}>添加账号</button></div><div className="login-footer">© ZCT-SLMS</div></div>;
}
function Root() {
  const [session, setSession] = useState(getSession);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === "zct_slms-session") {
        client.clear();
        setSession(getSession());
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  return (
    <QueryClientProvider client={client}>
      <SuccessPopup />
      <PasswordPromptHost />
      <MfaDialog />
      <CompleteIdentityLogin
        api={api}
        onLogin={(s) => {
          client.clear();
          setSession(s);
        }}
      />
      {(new URLSearchParams(location.search).has("accounts") || (!session && location.pathname === "/" && (() => { try { return JSON.parse(localStorage.getItem("zct_slms-accounts") || "[]").length > 0; } catch { return false; } })())) ? <SavedAccounts /> : session ? (
        <OnboardingGate
          api={api}
          session={session}
          onLogout={() => setSession(null)}
        >
          {session.user_type === "SUPPORT" ? (
            <SupportShell
              api={api}
              session={session}
              onLogout={() => setSession(null)}
            />
          ) : (
            <BrowserRouter key="authenticated">
              <AppShell session={session} onLogout={() => setSession(null)} />
            </BrowserRouter>
          )}
        </OnboardingGate>
      ) : location.pathname === "/forgot-password" ? (
        <RecoveryPage api={api} />
      ) : (
        <Login
          onLogin={(s) => {
            client.clear();
            setSession(s);
          }}
        />
      )}
    </QueryClientProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Root />);
