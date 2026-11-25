# JobCard AI — 部署记录

## 线上地址（已验证可用）

- 运行链接（Devpost 提交用）：https://g0f3l-raw.sakupa.com/jobcard/
- 带 Sakupa 横幅的包装页：https://g0f3l.sakupa.com/jobcard/
- 免费有效期至：**2026-12-25 10:44 北京时间**（2026-12-25T02:44:48Z），覆盖投稿截止（12-01）与评审期（12-10 至 12-16）。到期前可用 `refresh` 续期 30 天。
- 最新部署：**2026-11-25 显示问题修复版上线**，deployment `77952901-37e3-4590-ae2e-a5a053f05b51`，3 个文件上传（jobcard/index.html、jobcard/js/ai.js、jobcard/js/app.js），finalize 200，有效期续到 **2026-12-25T13:26:51Z**。修复：页脚改为按模式动态文案（真实模式不再显示模拟说明）；`deviceStatus()` 竞态修复，路由面板在真实模式下显示真实引擎设备状态。线上仍跑真实 Firebase AI Logic（固定 debug token），不再是 mock。

## 部署方式

- 挂在已有计算器站点 g0f3l 的子路径 `/jobcard/` 下，不是独立站点。
- 原因：2026-11-25 领独立站失败——出口网络免费名额整体饱和，80 次尝试全部 429；改走子路径后一次成功。
- 部署文件在 `~/workspace/sakupa-claim/site/`：根目录是计算器（index.html + speed-to-lead-starter.json，**绝不能动**），`jobcard/` 是本应用（index.html + css/ + js/，共 10 个文件）。
- 部署方法：**直接调 Sakupa API + curl 传文件，不要用 MCP deploy**。MCP 客户端（v1.6.4）的 fetch PUT 在本沙箱里持续失败（413 / 网络边界错误），而 curl PUT 同一地址一次就通。持久版脚本在 `~/workspace/sakupa-claim/deploy-jobcard.mjs`（2026-11-25 重建，替代被清空的 /tmp/sakupa-deploy2.mjs；用法 `node deploy-jobcard.mjs [--dry-run]`）。脚本要点：① API 请求必须带 `x-sakupa-mcp-version: 1.6.4` 头，否则 426；② manifest 覆盖 site/ 下全部文件（服务端按 contentHash 只返回有变化的文件作 uploadTargets，增量上传）；③ uploadTarget 的 path 带 `staging/<siteId>/<deploymentId>/` 前缀，匹配本地文件时要去掉前 3 段并用精确匹配（之前用 endsWith 匹配曾把根 index.html 错传到 jobcard 槽位导致 413）；④ 凭证从 `~/.sakupa` 读，绝不打印。
- 线上 served 内容与本地一致（除 Sakupa 注入的一行 iframe 桥接 script 外）；计算器 starter JSON 线上 md5 与本地一致，未受影响。

## 待办

- **Firebase 真实引擎换接（已完成并上线，2026-11-25）**：真实调用已逐项实测通过（见 SWAP-TO-REAL.md 顶部 round-2 结果：三单 + 周报全部 HTTP 200，金额无误；模型因后端下线 2.0-flash-lite 已改钉 3.5-flash-lite；processJob 的 _init 失败不再卡死 UI）；真实版已部署上线（deployment `8ec9ca9e-69f2-45ac-9658-4676724a00ce`，有效期至 2026-12-25T10:41:57Z），线上验证：计算器 starter JSON md5 不变，jobcard 文件与本地一致（仅 index.html 差 Sakupa 注入的一行桥接 script），部署包在浏览器里显示 LIVE 徽章、配置与固定 token 均已加载。**未竟**：真机 on-device 路径只能在真实 Chrome 139+（装好 Nano）上验，放在录演示视频那一步。
- 部署脚本注意：持久版在 `~/workspace/sakupa-claim/deploy-jobcard.mjs`（2026-11-25 重建，替代被清空的 /tmp/sakupa-deploy2.mjs；API：`POST /v1/sites/{siteId}/deployments` → curl PUT 各文件 → `POST /v1/deployments/{id}/finalize`；请求须带 `x-sakupa-mcp-version: 1.6.4` 头否则 426；manifest 路径匹配用 staging 路径去掉前 3 段；凭证只从 `~/.sakupa` 读，绝不打印）。测试脚手架在 `~/workspace/autonomous-income/buildhybridai-2026-test/`（real-test.mjs、engine-node-test.mjs、browser-check.mjs、live-pill-check.mjs + 浏览器 profile，token 存在该 profile 的 IndexedDB 里）。
- GitHub 仓库 + Devpost 提交：由父代理推进（仓库待建，账号 @9081-ux 已找回）。
