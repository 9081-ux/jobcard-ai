# JobCard AI — 参赛应用创意（CONCEPT.md）

定稿时间：2026-11-25
目标：按争第一的标准做，不交只过门槛的弱版。

## 一句话

**JobCard AI — Offline-first AI field notes for home-service pros.**
上门维修师傅在没信号的地下室也能用的 AI 工单笔记：现场的活儿在设备端当场写好，回公司后云端自动汇总成周报。

## 为什么是这个创意（对准四项等权重评审标准）

| 评审标准 | 本创意如何得分 |
|---|---|
| Quality of the Idea（创意质量） | 混合推理的理由不是“噱头”，而是真实的工作场景：师傅在地下室、屋顶、偏远工地常常没信号，恰恰最需要 AI 的时候最没网。设备端解决“没网也能干活”，云端解决“跨工单才看得出的规律”。路由本身就是产品。 |
| Technological Implementation（技术实现） | 每个功能明确选模式：即时任务 PREFER_ON_DEVICE（Nano 在就走设备端，否则回退云端）；周汇总 ONLY_IN_CLOUD；并用 `LanguageModel.availability()` 实时检测设备端状态、展示下载进度、标明每次调用实际走的引擎与耗时。 |
| Design（设计） | 移动优先（师傅用手机）、干净专业；每个 AI 结果带引擎徽章（ON-DEVICE / CLOUD）与耗时；离线模拟开关；中英文界面以英文为主（规则要求至少支持英文，界面与材料全英文）。 |
| Potential Impact（潜在影响） | 明确受众：美国本地服务小企业（HVAC、水管、电工、清洁）——正是用户 Speed-to-Lead 已在服务的同一群人；省的是每天重复写工单、发客户消息、算账的时间；赛后可直接变成真实产品。 |

## 核心功能（v1 全部要真实可用）

1. **工单录入**：客户名、地址、工种（HVAC/Plumbing/Electrical/Cleaning/Other）、自由文本粗笔记；附 3 个标注 SAMPLE 的示例工单，一键填入，评委零输入即可体验。
2. **即时处理（设备端优先，PREFER_ON_DEVICE）**：结构化 JSON 输出——一句话摘要、工作完成项、耗材/零件清单、后续跟进项、发给客户的消息草稿、发票行（描述+数量+金额，笔记里没提金额的留空不编）。
3. **周汇总（云端 ONLY_IN_CLOUD）**：汇总已保存工单 → 本周摘要、开票总额（仅按笔记中金额加总，不编）、可跟进商机提示、客户报告草稿、下周建议。
4. **工单库**：保存的工单（localStorage 持久化），可查看/删除/重新处理。
5. **混合路由面板**：设备端状态（Nano 是否可用/下载进度）、在线/离线状态、每个功能的引擎与理由对照表、**离线模拟开关**（应用内模拟断网，明确标注 simulated；同时读取真实 `navigator.onLine`）。
6. **引擎徽章与耗时**：每次 AI 调用后显示实际路由（on-device / cloud fallback）与毫秒耗时；Nano 不可用时诚实显示原因并提供云端回退。

## 技术方案

- 平台：Web（Chrome 桌面，139+），Firebase AI Logic SDK v12.5.0+
- SDK：`firebase/ai` — `getAI(firebaseApp, { backend: new GoogleAIBackend() })`；`getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE })`（即时任务）；`InferenceMode.ONLY_IN_CLOUD`（周汇总）
- 设备端初始化：用户点击后调用 `model.initializeDeviceModel(progress => …)`，展示下载进度
- 结构化输出：responseSchema（JSON）——设备端支持
- Firebase 产品：AI Logic（核心）+ App Check（必需，开发用 debug provider；提交材料中说明，debug token 不进仓库）+ Remote Config（路由默认值，失败时本地默认值兜底）
- 云端模型：SDK 默认 Flash 模型（免费层文本推理，不指定需计费的模型名；不用图片生成/TTS，不申请额度账号）
- 持久化：localStorage（v1；Firestore/Auth 不做，避免给评委增加登录与权限失败面）
- 部署：静态托管（Sakupa），无需后端；Firebase Web 配置（apiKey 等公开配置）写入代码，机密不提交
- 代码：从零写，不读 starter 模板再抄；原生 HTML/CSS/JS + Firebase SDK（CDN ES modules，import map，版本锁定 ≥12.5.0）

## 演示脚本（视频 ≤3 分钟，见 VIDEO_SCRIPT.md）

0:00–0:30 创意：谁用、解决什么、混合推理如何实现（按官方建议，前 30 秒讲清）
0:30–1:30 现场录入示例工单 → 设备端即时处理（徽章+耗时）→ 打开离线模拟，设备端照样工作
1:30–2:30 切回在线 → 云端周汇总 → 工单库
2:30–3:00 路由面板讲解 + 收尾

## 风险与对策

- Nano 在评委机器上不可用 → PREFER_ON_DEVICE 自动回退云端，功能照常；界面诚实标注路由，附言说明
- 模型下载大/慢 → `initializeDeviceModel` 进度条 + 明确状态文案；演示前预下载
- Firebase 配置依赖用户 Google 账号 → 已列为需用户步骤，尽早启动（见下方）
- 演示视频录制需真实 Chrome 操作 → 用户 PC 或父级浏览器实录，不用 AI 生成视频冒充

## 需要用户本人做的步骤（已报父级，并行推进）

1. Devpost 注册（Gmail）+ 报名比赛
2. Firebase 控制台建项目 + 开 AI Logic（选 Gemini Developer API）+ Web 应用配置发我
3. GitHub 公开仓库（账号待确认）
4. 演示视频录制/上传 YouTube + 提交表单
