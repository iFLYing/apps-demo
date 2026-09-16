# AI 小样集市 · 部署到 Render

本服务是**独立部署**的 Web 应用，**账号体系与 login-dsm 完全隔离**（自带 `users/sessions` 表 + 角色鉴权），请勿混用两套账号。

## 技术栈
- Node 22 原生 `http` + `node:sqlite`（需 `--experimental-sqlite` 启动）
- SSE 实现多端实时同步（反馈/计数实时刷新）
- 零运行时依赖（`npm install` 为空操作）

## 本地运行
```bash
cd ai-demos-hub
node --experimental-sqlite server.mjs
# 打开 http://localhost:8765
# 审核台管理员：admin / admin123（建议用 ADMIN_PASSWORD 环境变量覆盖）
```

## 部署到 Render（免费版）

### 方式 A：Blueprint 一键部署（推荐）
1. 把本目录推送到你的 GitHub / GitLab 仓库。
2. Render 控制台 → **New → Blueprint** → 连接仓库 → 选择本目录下的 `render.yaml`。
3. 在环境变量里填写 `ADMIN_PASSWORD`（可选但建议）。
4. 点击 Create，等待构建完成即可获得 `https://ai-demos-hub.onrender.com`。

### 方式 B：手动建 Web Service
1. Render → **New → Web Service** → 连接仓库。
2. 设置：
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node --experimental-sqlite server.mjs`
   - Node Version: `22`
   - Plan: `Free`
3. Advanced → Add Environment Variable：
   - `NODE_ENV = production`
   - `ADMIN_PASSWORD = 你的强密码`（建议）
4. 健康检查：服务会自动用 `healthCheckPath: /api/health`。

## 关于数据持久化
- 免费版文件系统是**临时的**：每次重新部署会重置数据库，启动时会自动重新播种 9 个内置小样。
- 用户提交的「小样 / 反馈 / 账号」在重新部署后会清空——这符合演示站定位。
- 若需数据跨部署保留：把 plan 升级到付费，并挂载一个 Persistent Disk（mountPath 设为 `/data`，本项目已支持 `DATA_DIR` 环境变量）。

## 功能清单
- 首页：小样网格、场景/AI属性筛选、搜索、排序
- 详情页：体验入口、评分、反馈、留资、相似推荐
- 登录/注册（独立账号）
- 创作者后台 `/studio.html`：提交与管理自己的小样
- 审核台 `/review.html`：管理员审核、上下线
- 数据看板 `/dashboard.html`：统计 + SSE 实时反馈流

## 默认账号
- 管理员：`admin` / `admin123`（或环境变量 `ADMIN_PASSWORD`）
- 创作者：注册即得
