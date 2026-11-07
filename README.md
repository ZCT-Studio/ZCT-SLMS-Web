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

| 变量                          | 说明                                                |
|-----------------------------|---------------------------------------------------|
| `ZCT_SLMS_WEB_PORT`         | 前端端口，默认 `17316`                                   |
| `ZCT_SLMS_WEB_API_URL`      | 浏览器直连的后端源地址；留空使用同域 `/api`                         |
| `ZCT_SLMS_WEB_PROXY_URL`    | 容器可访问的后端地址，默认 `http://host.docker.internal:17112` |
| `ZCT_SLMS_WEB_FORWARD_MODE` | `proxy` 代理、`redirect` 重定向、`off` 关闭 API 访问         |
| `ZCT_SLMS_WEB_REDIRECT_URL` | 重定向模式下浏览器可访问的后端地址                                 |

`/api/v1/ping` 转发到后端的 `/api/v1/ping`，保留路径和查询参数。同域部署可使用代理；分域部署设置 `ZCT_SLMS_WEB_API_URL`
后，浏览器直接连接后端，此时可关闭前端转发。

后端同在 Docker 网络时，使用服务名和容器端口作为 `ZCT_SLMS_WEB_PROXY_URL`。本地 `.env` 不提交到 Git。

修改配置或更新代码后执行 `docker compose up -d --build`；停止使用 `docker compose down`。

国内镜像构建：

```sh
docker compose build --build-arg ZCT_SLMS_BUILD_NODE_IMAGE=docker.1ms.run/library/node:22-alpine --build-arg ZCT_SLMS_BUILD_NGINX_IMAGE=docker.1ms.run/library/nginx:alpine --build-arg ZCT_SLMS_BUILD_NPM_REGISTRY=https://registry.npmmirror.com/
docker compose up -d --no-build
```

镜像地址可替换为部署环境中可用的镜像源。

## 本地开发

```sh
npm ci
npm run dev
```

默认端口 `17316`，开发代理连接 `http://localhost:17112`。通过 `.env.local` 设置 `VITE_ZCT_SLMS_WEB_DEV_PROXY_URL`
可修改开发后端地址。

## 主要功能

- 应用、卡密、用户、子用户、余额与兑换码管理。
- 工单、Markdown 和图片材料、支持工作台及内容审查。
- 平台配置、第三方登录、通行密钥、动态令牌与恢复码。
- 多账号切换、移动端侧边栏和响应式列表。

功能和权限由后端控制；短信、邮件、第三方登录等服务需由管理员配置。通行密钥需使用 HTTPS 或 localhost。

## 许可证

见 [LICENSE](LICENSE)。

## 静态 Demo

推送 `v` 开头的 tag（如 `v1.0.0`）时，GitHub Actions 构建并部署一次 GitHub Pages Demo。普通分支推送、PR 和非 `v` 标签不会部署。仓库
Pages 来源需选择 GitHub Actions；环境规则需允许发布标签部署。

Demo 使用独立入口、Hash 路由和虚拟数据。首先展示登录界面，所有登录方式点击后直接免登录进入演示，无后端请求、凭据、支付或真实授权服务。操作仅改变页面内存，刷新恢复；角色切换仅为浏览展示。Demo
的 CSP 禁止网络连接和表单外发。

本地开发使用 `npm run dev:demo`；静态构建使用 `npm run build:demo`，产物为 `dist-demo/`，随后使用 `npm run preview:demo`
预览。项目子目录部署通过 `VITE_ZCT_SLMS_WEB_BASE_PATH` 指定基础路径。

Demo 与正式版共用登录框、身份/登录方式标签、品牌、统计卡片、应用摘要、移动导航及弹窗组件，样式使用同一套 CSS；第三方演示入口包含
Microsoft、GitHub、Google 和 Telegram，点击仅进入本地虚拟界面。

## CI 产物

- 通用静态文件：`ZCT-SLMS-Web`，适用于各系统的静态 Web 服务器；`v*` 发布附带 `ZCT-SLMS-Web.zip` 和 `ZCT-SLMS-Web.tar.gz`
  ，解压后静态文件位于顶层 `ZCT-SLMS-Web/` 文件夹内。
- Docker：`linux/amd64`（x64）与 `linux/arm64`，发布为 `ghcr.io/zct-studio/zct-slms-web` 的同一个多架构镜像，拉取时按主机架构选择。

普通 CI 构建不推送镜像；`v*` 标签推送镜像并创建 Release，稳定版本更新 `latest`。Demo Pages 保持独立工作流，仅 `v*` 标签部署。

## 前后端分域部署

后台“注册登录”中，前端可访问地址用于登录完成后的返回、邮件链接和通行密钥；后端可访问地址用于 Microsoft/GitHub OAuth
回调。后端可访问地址留空时使用前端同域 API。

例如前端 `https://web.example.com`、后端 `https://api.example.com`，GitHub
回调填写 `https://api.example.com/api/v1/auth/connect/callback/github`。后端仅允许配置的站点来源跨域访问。首次切换时先通过现有同域/代理连接保存两项地址，再切换前端的
API 配置。

静态部署编辑 `runtime-config.js`：`window.__ZCT_SLMS_CONFIG__ = { apiBaseUrl: "https://api.example.com" };`，无需重新构建。Docker
设置 `ZCT_SLMS_WEB_API_URL=https://api.example.com`；可关闭前端代理。请勿向运行时配置写入密钥。必须从已配置的站点前端地址发起
OAuth；结果使用短时一次性票据和浏览器验证器交换，不依赖第三方 Cookie。OAuth 流程仍需由同一个后端实例处理。

## 环境变量命名

运行变量统一为 `ZCT_SLMS_WEB_*`（前端）和 `ZCT_SLMS_CORE_*`（后端），构建参数统一为 `ZCT_SLMS_BUILD_*`。Vite 专用变量使用
`VITE_ZCT_SLMS_WEB_*`。Docker、GitHub 和 vcpkg 的标准变量保留工具要求的原名。完整分组、默认值和说明见 `.env.example`
；旧变量名称不再读取。

## 发布包内容

静态包的 `ZCT-SLMS-Web/` 中包含 `index.html`、`assets/`、`runtime-config.js`、`api-docs.html`、`.env.example`、`README.md` 和
`LICENSE`。将静态文件放到 Web 服务器，启用 SPA 回退到 `index.html`；分域部署编辑 `runtime-config.js`。普通静态服务器不会读取
`.env`；环境变量示例用于 Docker 或源码构建，不能代替运行时配置。

Docker 镜像内已包含静态页面、运行时配置脚本和 Nginx API 转发配置；宿主机环境变量模板随静态发布包和源码提供。GitHub Pages
Demo 保持完全静态，不包含部署环境模板。发布包与镜像均不包含本地 `.env`。

Web 显示版本统一修改根目录 `VERSION`，构建时自动读取；运行构建或开发命令时会将版本同步到 `package.json` 和
`package-lock.json`；修改 VERSION 后也可执行 `node scripts/sync-version.mjs` 立即同步。支持 `2.2.0-beta.1` 等预发布版本。

推送 `v*` 发布标签时，CI 要求标签去掉 `v` 后与 `VERSION` 完全一致；不一致会报错并阻止镜像、Release 和 Demo 发布。
