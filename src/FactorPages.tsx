import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Dialog } from "./Extras";
import { performPasskey } from "./Security";
import { requestPassword } from "./PasswordPrompt";
type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const done = (detail: string) =>
  window.dispatchEvent(new CustomEvent("tcv:success", { detail }));
export function FactorPage({ api, kind }: { api: Api; kind: string }) {
  const qc = useQueryClient(),
    q = useQuery({
      queryKey: ["account-factors"],
      queryFn: () => api<any>("auth/factors"),
    });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [recovery, setRecovery] = useState(""),
    [setup, setSetup] = useState<any>(null),
    [codes, setCodes] = useState<string[]>([]),
    [removeTarget, setRemoveTarget] = useState<any>(null),
    [removeMethod, setRemoveMethod] = useState(""),
    [removeCode, setRemoveCode] = useState(""),
    [removeReason, setRemoveReason] = useState(""),
    [removeError, setRemoveError] = useState("");
  useEffect(() => {
    if (!setup) return;
    const timer = setTimeout(() => {
      setSetup(null);
      setError("绑定二维码已过期，请重新开始");
    }, 300000);
    return () => clearTimeout(timer);
  }, [setup]);
  async function act(action: string, extra: Record<string, any> = {}) {
    setBusy(true);
    setError("");
    try {
      const result = await api<any>(
        "auth/factors",
        { action, code, recovery_code: recovery, ...extra },
        "POST",
      );
      if (result.recovery_codes) setCodes(result.recovery_codes);
      await qc.invalidateQueries({ queryKey: ["account-factors"] });
      await qc.invalidateQueries({ queryKey: ["factor-status"] });
      setCode("");
      setRecovery("");
      done("操作成功");
      return result;
    } catch (x) {
      setError((x as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel management-card factor-page">
      <a className="details-back" href="/account">
        ← 返回账号安全
      </a>
      <h2>
        {kind === "totp"
          ? "动态令牌"
          : kind === "passkeys"
            ? "通行密钥"
            : "恢复码"}
      </h2>
      {q.isError && <p className="error">{(q.error as Error).message}</p>}
      {q.data && (
        <>
          {kind === "totp" && (
            <>
              <p className="muted">
                使用验证器扫描二维码，输入生成的 6 位验证码完成绑定。
              </p>
              <div className="setting-row">
                <strong>状态</strong>
                <span>{q.data.totp_enabled ? "已绑定" : "未绑定"}</span>
              </div>
              {!q.data.totp_enabled && !setup && (
                <div className="form-actions">
                  <button
                    className="primary"
                    disabled={busy || !q.data.totp_available}
                    onClick={async () => {
                      const d = await act("totp-start");
                      if (d) setSetup(d);
                    }}
                  >
                    开始绑定
                  </button>
                </div>
              )}
              {!q.data.totp_available && !q.data.totp_enabled && (
                <p className="muted">管理员尚未开放动态令牌绑定。</p>
              )}
              {setup && (
                <div className="totp-setup">
                  <div className="totp-qr">
                    <QRCodeSVG
                      value={setup.uri}
                      size={208}
                      level="M"
                      marginSize={4}
                      title="动态令牌绑定二维码"
                    />
                  </div>
                  <details>
                    <summary>无法扫码，查看手动绑定密钥</summary>
                    <code className="sensitive-value">{setup.secret}</code>
                  </details>
                  <p className="muted">
                    SHA-1 · 6 位 · 30 秒，二维码 5 分钟内有效。
                  </p>
                </div>
              )}
              {(setup || q.data.totp_enabled) && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const d = await act(
                      setup ? "totp-confirm" : "totp-disable",
                    );
                    if (d) setSetup(null);
                  }}
                >
                  <label>
                    动态验证码
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      className={setup ? "primary" : "danger-button"}
                      disabled={busy}
                    >
                      {setup ? "保存绑定" : "解除绑定"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
          {kind === "passkeys" && (
            <>
              <p className="muted">
                使用设备解锁、系统验证器或安全密钥验证身份。登录是否要求第二种方式由管理员的
                2FA 策略决定。
              </p>
              <div className="passkey-list">
                {q.data.keys?.length ? (
                  q.data.keys.map((k: any) => (
                    <div className="setting-row" key={k.id}>
                      <div>
                        <strong>{k.name}</strong>
                        <small>
                          {new Date(k.created_at * 1000).toLocaleString()}
                        </small>
                      </div>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => {
                          setRemoveTarget(k);
                          setRemoveMethod("");
                          setRemoveCode("");
                          setRemoveReason("");
                          setRemoveError("");
                        }}
                      >
                        删除
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted">尚未绑定通行密钥。</p>
                )}
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = String(
                    new FormData(e.currentTarget).get("name") || "我的通行密钥",
                  );
                  setBusy(true);
                  setError("");
                  try {
                    const result = await requestPassword<any>(
                      "验证后添加通行密钥",
                      async (password) => {
                        const start = await api<any>(
                          "auth/factors",
                          { action: "passkey-start", password },
                          "POST",
                        );
                        const credential = await performPasskey(
                          start.public_key,
                          true,
                        );
                        return api<any>(
                          "auth/factors",
                          {
                            action: "passkey-confirm",
                            password,
                            name,
                            challenge_id: start.challenge_id,
                            credential,
                          },
                          "POST",
                        );
                      },
                    );
                    if (result.recovery_codes) setCodes(result.recovery_codes);
                    await qc.invalidateQueries({
                      queryKey: ["account-factors"],
                    });
                    await qc.invalidateQueries({ queryKey: ["factor-status"] });
                    done("通行密钥已绑定");
                  } catch (x) {
                    setError((x as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  通行密钥名称
                  <input
                    name="name"
                    placeholder="例如：我的电脑"
                    maxLength={48}
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !q.data.passkey_available ||
                      !window.PublicKeyCredential
                    }
                  >
                    添加通行密钥
                  </button>
                </div>
              </form>
              {!q.data.passkey_available && (
                <p className="muted">管理员尚未开放通行密钥绑定。</p>
              )}
            </>
          )}
          {kind === "recovery" && (
            <>
              <p className="muted">
                恢复码用于紧急验证，每个只能使用一次。重新生成后旧恢复码全部失效，关闭展示弹窗后无法再次读取。
              </p>
              <div className="setting-row">
                <strong>剩余恢复码</strong>
                <span>{q.data.recovery_remaining} 个</span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("recovery-regenerate");
                }}
              >
                {q.data.totp_enabled && (
                  <label>
                    当前动态验证码
                    <input
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      maxLength={6}
                      autoComplete="one-time-code"
                    />
                  </label>
                )}
                <label>
                  现有恢复码
                  {q.data.totp_enabled ? "（与动态验证码任选一个）" : ""}
                  <input
                    value={recovery}
                    onChange={(e) => setRecovery(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="primary"
                    disabled={busy || (!code && !recovery)}
                  >
                    重新生成恢复码
                  </button>
                </div>
              </form>
              {q.data.recovery_remaining === 0 &&
                !q.data.totp_enabled &&
                !q.data.keys?.length && (
                  <p className="muted">
                    请先绑定动态令牌或通行密钥，首次绑定后会自动生成恢复码。
                  </p>
                )}
            </>
          )}
        </>
      )}
      {error && <p className="error">{error}</p>}
      {removeTarget && (
        <Dialog
          title={`删除通行密钥：${removeTarget.name}`}
          close={() => {
            if (!busy) setRemoveTarget(null);
          }}
        >
          <p className="muted">
            选择验证方式。密钥删除后将无法用于此账号登录；提交工单不会立即删除。
          </p>
          <div
            className="passkey-remove-options"
            role="group"
            aria-label="选择删除方式"
          >
            {[
              ["passkey", "通过当前账号通行密钥删除"],
              ["recovery", "通过恢复码删除"],
              ["ticket", "提交工单删除"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={removeMethod === value ? "primary" : "secondary"}
                aria-pressed={removeMethod === value}
                disabled={busy}
                onClick={() => {
                  setRemoveMethod(value);
                  setRemoveError("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {removeMethod === "passkey" && (
            <p className="muted">
              可使用当前账号任意一把已绑定的通行密钥验证。
            </p>
          )}
          {removeMethod === "recovery" && (
            <label>
              一次性恢复码
              <input
                value={removeCode}
                onChange={(e) => setRemoveCode(e.target.value)}
                autoComplete="off"
                placeholder="输入已保存的恢复码"
              />
            </label>
          )}
          {removeMethod === "ticket" && (
            <>
              <p className="muted">
                请提供账号归属证明和删除原因，等待管理员或支持人员核验。审核通过后会退出此账号的全部会话。
              </p>
              <label>
                申请说明
                <textarea
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  rows={5}
                  minLength={10}
                  maxLength={7000}
                  placeholder="说明无法使用其他验证方式的原因，并提供账号归属证明"
                />
              </label>
            </>
          )}
          {removeError && <p className="error">{removeError}</p>}
          <div className="form-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setRemoveTarget(null)}
            >
              取消
            </button>
            <button
              className="primary"
              disabled={
                busy ||
                !removeMethod ||
                (removeMethod === "recovery" && !removeCode.trim()) ||
                (removeMethod === "ticket" && removeReason.trim().length < 10)
              }
              onClick={async () => {
                setBusy(true);
                setRemoveError("");
                try {
                  if (removeMethod === "passkey") {
                    await requestPassword(
                      "验证后删除通行密钥",
                      async (password) => {
                        const start = await api<any>(
                          "auth/factors",
                          {
                            action: "passkey-remove-start",
                            id: removeTarget.id,
                            password,
                          },
                          "POST",
                        );
                        const credential = await performPasskey(
                          start.public_key,
                          false,
                        );
                        return api(
                          "auth/factors",
                          {
                            action: "passkey-remove",
                            method: "passkey",
                            id: removeTarget.id,
                            password,
                            challenge_id: start.challenge_id,
                            credential,
                          },
                          "POST",
                        );
                      },
                    );
                  } else if (removeMethod === "recovery") {
                    await api(
                      "auth/factors",
                      {
                        action: "passkey-remove",
                        method: "recovery",
                        id: removeTarget.id,
                        recovery_code: removeCode.trim(),
                      },
                      "POST",
                    );
                  } else {
                    await api(
                      "tickets/create",
                      {
                        category: "PASSKEY",
                        key_id: removeTarget.id,
                        title: "申请删除通行密钥",
                        body: removeReason.trim(),
                      },
                      "POST",
                    );
                    await qc.invalidateQueries({ queryKey: ["tickets"] });
                  }
                  await qc.invalidateQueries({ queryKey: ["account-factors"] });
                  await qc.invalidateQueries({ queryKey: ["factor-status"] });
                  done(
                    removeMethod === "ticket"
                      ? "工单已提交，请在工单系统查看处理进度"
                      : "通行密钥已删除",
                  );
                  setRemoveTarget(null);
                  setRemoveCode("");
                  setRemoveReason("");
                } catch (x) {
                  setRemoveError((x as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? "处理中…"
                : removeMethod === "ticket"
                  ? "提交申请"
                  : "验证并删除"}
            </button>
          </div>
        </Dialog>
      )}
      {codes.length > 0 && (
        <Dialog title="请保存一次性恢复码" close={() => setCodes([])}>
          <p className="muted">仅展示一次，请离线妥善保存。</p>
          <pre className="result">{codes.join("\n")}</pre>
          <div className="form-actions">
            <button className="primary" onClick={() => setCodes([])}>
              我已保存
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
