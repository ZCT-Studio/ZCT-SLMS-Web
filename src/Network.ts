// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 ZCT Studio

type RuntimeConfig = { apiBaseUrl?: string };
declare global {
    interface Window {
        __ZCT_SLMS_CONFIG__?: RuntimeConfig
    }
}

function base() {
    const raw = window.__ZCT_SLMS_CONFIG__?.apiBaseUrl || (import.meta as ImportMeta & {
        env: Record<string, string>
    }).env.VITE_ZCT_SLMS_WEB_API_URL || "";
    if (!raw) return "";
    const url = new URL(raw);
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password || !(url.protocol === "https:" || (url.protocol === "http:" && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw Error("后端可访问 API 地址必须为 HTTPS 源地址，本机允许 HTTP");
    return url.origin;
}

export function apiUrl(path: string) {
    if (!path.startsWith('/api/')) throw Error('API 路径无效');
    return base() + path;
}

const bindingPrefix = 'zct_slms-oauth-binding:';

export function oauthBrowserVerifier(challenge: string) {
    const row = JSON.parse(localStorage.getItem(bindingPrefix + challenge) || 'null');
    if (!row || row.expires < Date.now() || row.backend !== base()) throw Error('登录浏览器验证已过期，请重新发起');
    return String(row.verifier);
}

export function forgetOauthBinding(challenge: string) {
    localStorage.removeItem(bindingPrefix + challenge);
}

export async function apiFetch(path: string, init: RequestInit = {}) {
    if (path === '/api/v1/auth/connect/start' || path === '/api/v1/auth/factors/oauth/start') {
        const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, '0')).join('');
        const challenge = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))), v => v.toString(16).padStart(2, '0')).join('');
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith(bindingPrefix)) {
                try {
                    if (JSON.parse(localStorage.getItem(key)!).expires < Date.now()) localStorage.removeItem(key)
                } catch {
                    localStorage.removeItem(key)
                }
            }
        }
        localStorage.setItem(bindingPrefix + challenge, JSON.stringify({
            verifier,
            expires: Date.now() + 600000,
            backend: base()
        }));
        init = {
            ...init,
            body: JSON.stringify({...JSON.parse(String(init.body || '{}')), browser_challenge: challenge})
        };
    }
    return fetch(apiUrl(path), {...init, credentials: 'omit'});
}
