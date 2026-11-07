// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

import {useEffect, useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CustomSelect, Toggle} from "./Select";
import {RefreshCw} from "lucide-react";
import "./styles/Security.css";

type Api = <T>(p: string, b?: Record<string, any>, m?: string) => Promise<T>;
const success = (detail: string) =>
    window.dispatchEvent(new CustomEvent("zct_slms:success", {detail}));
const decode = (s: string): ArrayBuffer =>
    Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
        c.charCodeAt(0),
    ).buffer;
const encode = (b: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(b)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

function options(pk: any, create = false) {
    const out = {...pk, challenge: decode(pk.challenge)};
    if (create) out.user = {...pk.user, id: decode(pk.user.id)};
    for (const k of ["allowCredentials", "excludeCredentials"])
        if (pk[k]) out[k] = pk[k].map((v: any) => ({...v, id: decode(v.id)}));
    return out;
}

function credential(c: PublicKeyCredential) {
    const r = c.response as AuthenticatorAttestationResponse &
        AuthenticatorAssertionResponse;
    return {
        id: c.id,
        type: c.type,
        response: {
            clientDataJSON: encode(r.clientDataJSON),
            ...(r.attestationObject
                ? {attestationObject: encode(r.attestationObject)}
                : {
                    authenticatorData: encode(r.authenticatorData),
                    signature: encode(r.signature),
                    userHandle: r.userHandle ? encode(r.userHandle) : null,
                }),
        },
    };
}

export async function performPasskey(pk: any, create = false) {
    const c = (
        create
            ? await navigator.credentials.create({publicKey: options(pk, true)})
            : await navigator.credentials.get({publicKey: options(pk)})
    ) as PublicKeyCredential | null;
    if (!c) throw new Error("通行密钥验证已取消");
    return credential(c);
}

export function authenticateFactors<T>(api: Api, data: T): Promise<T> {
    if (!(data as any)?.mfa_required) return Promise.resolve(data);
    return new Promise((resolve, reject) =>
        window.dispatchEvent(
            new CustomEvent("zct_slms:mfa", {detail: {api, data, resolve, reject}}),
        ),
    );
}

let scripts: Record<string, Promise<void> | undefined> = {};
let widgetLoadSequence = 0;

function widgetScript(provider: string, siteKey = "") {
    const cacheKey = provider + ":" + (provider === "recaptcha_v3" ? siteKey : "");
    if (scripts[cacheKey]) return scripts[cacheKey];
    const base = (provider === "recaptcha" || provider === "recaptcha_v3")
        ? "https://www.google.com/recaptcha/api.js"
        : provider === "hcaptcha"
            ? "https://js.hcaptcha.com/1/api.js"
            : "https://challenges.cloudflare.com/turnstile/v0/api.js";
    const callbackName = `zct_slms_captcha_loaded_${++widgetLoadSequence}`;
    scripts[cacheKey] = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        const globals = window as any;
        const cleanup = () => {
            clearTimeout(timeout);
            delete globals[callbackName];
            script.onerror = null;
        };
        const fail = () => {
            cleanup();
            script.remove();
            delete scripts[cacheKey];
            reject(new Error("人机验证加载失败或超时，请检查网络后重试"));
        };
        const timeout = window.setTimeout(fail, 20000);
        // SDK onload signals initialization, unlike the script element's load event.
        globals[callbackName] = () => {
            cleanup();
            resolve();
        };
        script.src = `${base}?render=${provider === "recaptcha_v3" ? encodeURIComponent(siteKey) : "explicit"}&onload=${callbackName}${provider === "hcaptcha" ? "&recaptchacompat=off" : ""}`;
        script.async = true;
        script.onerror = fail;
        document.head.appendChild(script);
    });
    return scripts[cacheKey];
}

function ProviderWidget({
                            provider,
                            siteKey,
                            onToken,
                        }: {
    provider: string;
    siteKey: string;
    onToken: (v: string) => void;
}) {
    const ref = useRef<HTMLDivElement>(null),
        containerRef = useRef<HTMLDivElement>(null),
        callback = useRef(onToken);
    callback.current = onToken;
    const [error, setError] = useState("");
    const [compact, setCompact] = useState<boolean | null>(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const measure = () => {
            const width = container.clientWidth;
            if (width > 0) setCompact(width < (provider === "turnstile" ? 300 : 304));
        };
        measure();
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", measure);
            return () => window.removeEventListener("resize", measure);
        }
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => observer.disconnect();
    }, [provider]);
    useEffect(() => {
        if (compact === null) return;
        let active = true,
            id: any,
            api: any;
        setError("");
        widgetScript(provider)
            .then(() => {
                if (!active || !ref.current) return;
                api = (window as any)[
                    provider === "recaptcha"
                        ? "grecaptcha"
                        : provider === "hcaptcha"
                            ? "hcaptcha"
                            : "turnstile"
                    ];
                const render = () => {
                    if (!active || !ref.current) return;
                    id = api.render(ref.current, {
                        sitekey: siteKey,
                        size: compact ? "compact" : provider === "turnstile" ? "flexible" : "normal",
                        callback: (token: string) => {
                            if (active) callback.current(token);
                        },
                        "expired-callback": () => {
                            if (active) callback.current("");
                        },
                        "error-callback": () => {
                            if (!active) return;
                            callback.current("");
                            setError("验证失败，请刷新重试");
                        },
                        theme: "light",
                    });
                };
                if (!api || typeof api.render !== "function") throw new Error("人机验证初始化失败，请重试");
                render();
            })
            .catch((e) => active && setError(e.message));
        return () => {
            active = false;
            callback.current("");
            if (id !== undefined) {
                try {
                    if (api.remove) api.remove(id);
                    else api.reset(id);
                } catch {
                }
            }
        };
    }, [provider, siteKey, compact]);
    return (
        <>
            <div ref={containerRef} className="captcha-widget-container">
                <div key={`${provider}-${compact}`} ref={ref}/>
            </div>
            {error && <p className="error">{error}</p>}
        </>
    );
}

export function useHuman(api: Api, enabled = true) {
    const [data, setData] = useState<any>(null),
        [error, setError] = useState(""),
        [revision, setRevision] = useState(0),
        [answer, setAnswer] = useState(""),
        [token, setToken] = useState("");
    const reset = () => {
        setAnswer("");
        setToken("");
        setRevision((v) => v + 1);
    };
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        setData(null);
        setError("");
        api<any>("auth/captcha")
            .then((d) => active && setData(d))
            .catch((e) => active && setError(e.message));
        return () => {
            active = false;
        };
    }, [revision, enabled]);
    const fields = {
        captcha_id: data?.challenge_id || "",
        captcha_answer: answer,
        captcha_token: token,
    };

    async function getFields() {
        if (!data || error) throw new Error(error || "人机验证配置尚未加载");
        if (data.provider !== "recaptcha_v3") return fields;
        await widgetScript("recaptcha_v3", data.site_key);
        const captcha = (window as any).grecaptcha;
        if (!captcha || typeof captcha.execute !== "function") throw new Error("reCAPTCHA v3 加载失败");
        const captchaToken = await captcha.execute(data.site_key, {action: "zct_slms"});
        if (!captchaToken) throw new Error("人机验证失败，请重试");
        return {...fields, captcha_token: captchaToken};
    }

    const widget = error ? (
        <div className="human-check">
            <p className="error">{error}</p>
            <button type="button" className="secondary" onClick={reset}>
                重试
            </button>
        </div>
    ) : !data ? (
        <p className="muted">正在加载验证配置…</p>
    ) : data.provider === "none" || data.provider === "recaptcha_v3" ? null : (
        <div className="human-check">
            <div className="inline-actions">
                <strong>请帮我们解决机器人</strong>
                <button
                    className="icon-button"
                    type="button"
                    aria-label="刷新人机验证"
                    onClick={reset}
                >
                    <RefreshCw size={15}/>
                </button>
            </div>
            {data.provider === "static" ? (
                <label>
                    {data.image ? (
                        <img
                            className="captcha-image"
                            src={data.image}
                            alt="请输入图片中的字符"
                        />
                    ) : (
                        <span className="captcha-question">{data.question}</span>
                    )}
                    <input
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="输入答案（区分大小写）"
                        autoComplete="off"
                    />
                </label>
            ) : (
                <ProviderWidget
                    key={revision}
                    provider={data.provider}
                    siteKey={data.site_key}
                    onToken={setToken}
                />
            )}
        </div>
    );
    return {
        fields,
        getFields,
        config: data,
        widget,
        reset,
        ready:
            !!data &&
            !error &&
            (data.provider === "none" || data.provider === "recaptcha_v3" ||
                (data.provider === "static" ? !!answer : !!token)),
    };
}

export function FactorAdmin({api, tab}: { api: Api; tab: string }) {
    const qc = useQueryClient(),
        q = useQuery({
            queryKey: ["factor-settings"],
            queryFn: () => api<any>("admin/factors/settings"),
        });
    const [draft, setDraft] = useState<any>({}),
        [configProvider, setConfigProvider] = useState("recaptcha"),
        [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    useEffect(() => {
        if (q.data) {
            setDraft({...q.data});
            if (q.data.captcha_provider && q.data.captcha_provider !== "none") setConfigProvider(q.data.captcha_provider);
        }
    }, [q.data]);
    const set = (k: string, v: any) => setDraft((d: any) => ({...d, [k]: v}));
    return (
        <section className="panel management-card">
            <h2>{tab === "2fa" ? "双重验证" : "人机验证"}</h2>
            {q.isError && <p className="error">{(q.error as Error).message}</p>}
            {tab === "2fa" ? (
                <>
                    <p className="muted">
                        开启 2FA 后，登录需要验证不同类别的第二因素；没有可用第二因素的账号可先登录，并提示绑定。下方开关控制新绑定入口。
                    </p>
                    {[
                        ["two_factor_enabled", "开启 2FA（登录后验证第二因素）"],
                        ["totp_enabled", "允许绑定动态令牌"],
                        ["passkey_enabled", "允许绑定通行密钥"],
                    ].map(([k, label]) => (
                        <div className="setting-row" key={k}>
                            <strong>{label}</strong>
                            <Toggle
                                label={label}
                                checked={!!draft[k]}
                                onChange={(v) => set(k, v)}
                            />
                        </div>
                    ))}
                    <p className="muted">
                        通行密钥使用“注册登录”中的前端可访问地址校验站点来源，生产环境需使用 HTTPS，本机调试可使用
                        localhost。动态令牌支持 TOTP 验证器。
                    </p>
                </>
            ) : (
                <>
                    <label>
                        验证方式
                        <CustomSelect
                            value={draft.captcha_provider || "none"}
                            onChange={(v) => {
                                set("captcha_provider", v);
                                if (v !== "none") setConfigProvider(v);
                            }}
                            options={[
                                {value: "none", label: "不启用（默认）"},
                                {value: "static", label: "静态题"},
                                {value: "recaptcha", label: "reCAPTCHA v2"},
                                {value: "recaptcha_v3", label: "reCAPTCHA v3"},
                                {value: "hcaptcha", label: "hCaptcha"},
                                {value: "turnstile", label: "Cloudflare Turnstile"},
                            ]}
                        />
                    </label>
                    <label>
                        配置服务
                        <CustomSelect value={configProvider} onChange={setConfigProvider} options={[
                            {value: "static", label: "静态题"}, {
                                value: "recaptcha",
                                label: "reCAPTCHA v2"
                            }, {value: "recaptcha_v3", label: "reCAPTCHA v3"}, {
                                value: "hcaptcha",
                                label: "hCaptcha"
                            }, {value: "turnstile", label: "Cloudflare Turnstile"}
                        ]}/>
                    </label>
                    {configProvider === "static" ? (
                        <p className="muted">题目图片放在 Core 工作目录 captcha/static/，同目录 answer.json
                            使用 {`{"example.png":"你的答案"}`} 格式，答案区分大小写。</p>
                    ) : (
                        <>
                            {[["site_key", "Site Key"], ["secret", "Secret Key"], ["hostname", "本站主机名（不含协议和端口）"]].map(([field, label]) => {
                                const provider = configProvider;
                                const config = draft.captcha_configs?.[provider] || {};
                                return <label key={field}>{label}<input type={field === "secret" ? "password" : "text"}
                                                                        value={config[field] || ""}
                                                                        placeholder={field === "secret" && config.secret_configured ? "已保存，留空保留" : ""}
                                                                        onChange={e => set("captcha_configs", {
                                                                            ...draft.captcha_configs,
                                                                            [provider]: {
                                                                                ...config,
                                                                                [field]: e.target.value
                                                                            }
                                                                        })}/></label>;
                            })}
                            {configProvider === "recaptcha_v3" &&
                                <label>最低评分（0–1）<input type="number" min="0" max="1" step="0.1"
                                                           value={draft.captcha_configs?.recaptcha_v3?.min_score ?? 0.5}
                                                           onChange={e => set("captcha_configs", {
                                                               ...draft.captcha_configs,
                                                               recaptcha_v3: {
                                                                   ...draft.captcha_configs?.recaptcha_v3,
                                                                   min_score: Number(e.target.value)
                                                               }
                                                           })}/></label>}
                        </>
                    )}
                    {[["captcha_for_authorization", "每次统一授权需要人机验证"], ["captcha_for_passkey", "通行密钥需要人机验证"], ["captcha_for_2fa", "2FA 第二次验证需要人机验证"]].map(([key, label]) =>
                        <div className="setting-row" key={key}><strong>{label}</strong><Toggle label={label}
                                                                                               checked={!!draft[key]}
                                                                                               onChange={value => set(key, value)}/>
                        </div>)}
                    <p className="muted">
                        密码登录和发送验证码需要人机验证；通行密钥及授权流程由上方开关控制。
                    </p>
                </>
            )}
            {error && <p className="error">{error}</p>}
            <div className="form-actions">
                <button
                    className="primary"
                    disabled={!q.data || busy}
                    onClick={async () => {
                        setBusy(true);
                        setError("");
                        try {
                            await api(
                                "admin/factors/settings",
                                {
                                    ...draft,
                                    ...(tab === "captcha" && draft.captcha_provider === "static" && q.data?.captcha_provider !== "static"
                                        ? {static_mode: "image"}
                                        : {}),
                                },
                                "POST",
                            );
                            await qc.invalidateQueries({queryKey: ["factor-settings"]});
                            success("安全配置已保存");
                        } catch (x) {
                            if ((x as Error).message !== "操作已取消")
                                setError((x as Error).message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    {busy ? "保存中…" : "保存设置"}
                </button>
            </div>
        </section>
    );
}
