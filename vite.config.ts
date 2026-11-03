import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, ".", "");
  const demo = mode === "demo";
  return {
    base: demo ? env.VITE_ZCT_SLMS_WEB_BASE_PATH || "/" : "/",
    publicDir: demo ? false : "public",
    build: { outDir: demo ? "dist-demo" : "dist" },
    plugins: [react(), tailwindcss(), ...(demo ? [{ name: "static-demo-entry", transformIndexHtml: { order: "pre" as const, handler(html: string) { return html.replace('<script src="%BASE_URL%runtime-config.js"></script>', '').replace('/src/main.tsx', '/src/demo/main.tsx').replace('<head>', command === 'build' ? '<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; connect-src \'none\'; img-src \'self\' data:; style-src \'self\' \'unsafe-inline\'; script-src \'self\'; font-src \'self\'; object-src \'none\'; form-action \'none\'; base-uri \'self\'">' : '<head>').replace('<title>', '<title>Demo | '); } } }] : [])],
    server: {
      port: Number(env.ZCT_SLMS_WEB_PORT || 17316),
      strictPort: true,
      proxy: demo ? undefined : {
        "/api": {
          target: env.VITE_ZCT_SLMS_WEB_DEV_PROXY_URL || "http://localhost:17112",
          changeOrigin: true,
        },
      },
    },
  };
});
