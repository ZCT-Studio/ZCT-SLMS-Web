# TingCloud Verifier WebUI

React 19 + TypeScript 管理界面，连接 TingCloudVerifier 的 `/api/v1`。会话保存在当前浏览器标签页的 sessionStorage；关闭标签页后需重新登录。

## Docker

确保后端已启动并允许容器访问。默认代理至宿主机 `http://host.docker.internal:17112`，按后端实际监听地址修改：

```powershell
$env:BACKEND_URL="http://host.docker.internal:17112"
docker compose up -d --build
```

访问 http://localhost:17316。可用 `WEB_PORT` 修改暴露端口。后端如果也在 Docker 网络中，使用其服务名和容器端口作为 `BACKEND_URL`，并将两者接入同一 Docker 网络。`docker compose down` 停止。

## 开发

```powershell
npm install --no-audit --no-fund
$env:VITE_BACKEND_URL="http://localhost:17112"
npm run dev
```

开发服务器默认使用 `17316`，将 `/api` 代理至后端。确认后端配置实际端口及监听地址。UI 不内置后端，也不创建演示数据。

## 功能与限制

支持管理员、Owner、子用户和支持账号。包含应用详情与介绍编辑、卡密管理、用户与子用户管理、邀请码和余额码、工单及内容审查、平台与安全配置。账号安全提供独立的动态令牌（二维码）、通行密钥、恢复码页面；管理员可开启双重验证和各项密码恢复方式。支持账号仅能处理工单及查看公开内容审查。

概览统计基于当前选中应用的卡密列表；不展示虚构历史趋势。新用户余额默认为 0；子用户生成的卡密同步扣主用户余额。明文卡密、邀请码、余额码及恢复码只在生成结果中显示，请及时保存。敏感操作先提交，再弹窗确认当前密码。具体权限和配置由后端校验。

短信、SMTP、Microsoft、GitHub 和第三方人机验证需要管理员填写真实服务凭据及回调地址；通行密钥要求 HTTPS 或本机 localhost。升级后端时请备份数据库、配置和认证主密钥，详见后端 `docs/admin-security.md`。


### 国内镜像构建

如 Docker Hub 或 npm 下载缓慢，可使用构建参数指定镜像：

```powershell
docker compose build --build-arg NODE_IMAGE=docker.1ms.run/library/node:22-alpine --build-arg NGINX_IMAGE=docker.1ms.run/library/nginx:alpine --build-arg NPM_REGISTRY=https://registry.npmmirror.com/
docker compose up -d --no-build
```

镜像站可用性可能变化，也可将上述参数替换为其他可访问的镜像。构建完成后正常启动无需再次指定参数。
