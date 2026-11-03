# ZCT-SLMS-Web

软件授权验证平台管理界面，连接 ZCT-SLMS 后端。

## 技术栈

React 19 · TypeScript · Vite · Tailwind CSS · Lucide · Motion · React Router · TanStack Query / Table

## 快速开始

安装 Docker，并启动后端。在项目根目录执行：

```sh
cp .env.example .env
docker compose up -d --build
```

访问 `http://localhost:17316`。首次管理员账号与密码从后端启动日志获取。

## 配置

在 `.env` 中设置：

| 变量 | 说明 |
| --- | --- |
| `WEB_PORT` | 前端端口，默认 `17316` |
| `BACKEND_URL` | 容器可访问的后端地址，默认 `http://host.docker.internal:17112` |
| `BACKEND_FORWARD_MODE` | `proxy` 代理、`redirect` 重定向、`off` 关闭 API 访问 |
| `BACKEND_PUBLIC_URL` | 重定向模式下浏览器可访问的后端地址 |

`/api/v1/ping` 转发到后端的 `/api/v1/ping`，保留路径和查询参数。推荐使用代理模式；关闭 API 访问后，登录与管理功能也无法连接后端。

后端同在 Docker 网络时，使用服务名和容器端口作为 `BACKEND_URL`。本地 `.env` 不提交到 Git。

修改配置或更新代码后执行 `docker compose up -d --build`；停止使用 `docker compose down`。

国内镜像构建：

```sh
docker compose build --build-arg NODE_IMAGE=docker.1ms.run/library/node:22-alpine --build-arg NGINX_IMAGE=docker.1ms.run/library/nginx:alpine --build-arg NPM_REGISTRY=https://registry.npmmirror.com/
docker compose up -d --no-build
```

镜像地址可替换为部署环境中可用的镜像源。

## 本地开发

```sh
npm ci
npm run dev
```

默认端口 `17316`，开发代理连接 `http://localhost:17112`。通过 `.env.local` 设置 `VITE_BACKEND_URL` 可修改开发后端地址。

## 主要功能

- 应用、卡密、用户、子用户、余额与兑换码管理。
- 工单、Markdown 和图片材料、支持工作台及内容审查。
- 平台配置、第三方登录、通行密钥、动态令牌与恢复码。
- 多账号切换、移动端侧边栏和响应式列表。

功能和权限由后端控制；短信、邮件、第三方登录等服务需由管理员配置。通行密钥需使用 HTTPS 或 localhost。

## 许可证

见 [LICENSE](LICENSE)。

## 静态 Demo

推送 `v` 开头的 tag（如 `v1.0.0`）时，GitHub Actions 构建并部署一次 GitHub Pages Demo。普通分支推送、PR 和非 `v` 标签不会部署。仓库 Pages 来源需选择 GitHub Actions；环境规则需允许发布标签部署。

Demo 使用独立入口、Hash 路由和虚拟数据。首先展示登录界面，所有登录方式点击后直接免登录进入演示，无后端请求、凭据、支付或真实授权服务。操作仅改变页面内存，刷新恢复；角色切换仅为浏览展示。Demo 的 CSP 禁止网络连接和表单外发。

本地开发使用 `npm run dev:demo`；静态构建使用 `npm run build:demo`，产物为 `dist-demo/`，随后使用 `npm run preview:demo` 预览。项目子目录部署通过 `VITE_BASE_PATH` 指定基础路径。

Demo 与正式版共用登录框、身份/登录方式标签、品牌、统计卡片、应用摘要、移动导航及弹窗组件，样式使用同一套 CSS；第三方演示入口仅保留 Microsoft 和 GitHub。
