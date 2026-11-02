import { useEffect, useRef, useState } from "react";
import { Dialog } from "./Extras";
type Request = {
  title: string;
  run: (password: string) => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};
export function requestPassword<T>(
  title: string,
  run: (password: string) => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) =>
    window.dispatchEvent(
      new CustomEvent("tcv:password", {
        detail: { title, run, resolve, reject },
      }),
    ),
  );
}
export function PasswordPromptHost() {
  const [request, setRequest] = useState<Request | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    current = useRef<Request | null>(null);
  useEffect(() => {
    const f = (e: Event) => {
      const next = (e as CustomEvent<Request>).detail;
      if (current.current) {
        next.reject(new Error("请先完成当前密码验证"));
        return;
      }
      current.current = next;
      setRequest(next);
      setError("");
      setBusy(false);
    };
    window.addEventListener("tcv:password", f);
    return () => {
      window.removeEventListener("tcv:password", f);
      current.current?.reject(new Error("操作已取消"));
    };
  }, []);
  if (!request) return null;
  const close = () => {
    if (busy) return;
    request.reject(new Error("操作已取消"));
    current.current = null;
    setRequest(null);
  };
  return (
    <Dialog title={request.title || "验证身份"} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setBusy(true);
            setError("");
            const result = await request.run(
              String(new FormData(e.currentTarget).get("password")),
            );
            request.resolve(result);
            current.current = null;
            setRequest(null);
          } catch (x) {
            setError((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="muted">验证当前账号密码后执行操作。</p>
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
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            onClick={close}
            disabled={busy}
          >
            取消
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "处理中…" : "确认"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function passwordField(
  path: string,
  params: Record<string, any>,
  method: string,
) {
  if (method !== "POST") return "";
  if (
    [
      "admin/identity/settings",
      "admin/platform-config",
      "admin/factors/settings",
      "admin/moderation",
      "admin/support/users",
      "admin/account",
      "auth/password",
    ].includes(path)
  )
    return "current_password";
  if (
    [
      "auth/factors",
      "vouchers/create",
      "app/secret/view",
      "app/secret/regenerate",
      "tickets/reset-password",
      "tickets/remove-passkey",
    ].includes(path)
  )
    return "password";
  if (path === "tickets/create" && params.category === "PASSKEY")
    return "password";
  if (path.startsWith("auth/connect/") && params.action === "bind")
    return "password";
  if (path === "auth/factors/verify" && params.method === "password")
    return "password";
  return "";
}
