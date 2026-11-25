# #BuildHybridAI 2026 — RULES.md

核实时间：2026-11-25 09:42 CST（北京时间）
来源（官方页全文已读）：
- 规则页：https://firebasehybridaihackathon.devpost.com/rules
- FAQ 页：https://firebasehybridaihackathon.devpost.com/details/faqs
- 主办：Google LLC；承办：Devpost, Inc.；在线赛，免费参赛，无需购买。

## 1. 中国居民参赛资格 — ✅ 确认可参赛

官方排除名单（规则页 §3 + FAQ 原文，一字不差）：
> 排除 Brazil、Italy、Quebec、Crimea、Cuba、Iran、Syria、North Korea、Sudan、Belarus、Russia，以及美国财政部 OFAC 指定的其他国家；另排除受美国出口管制/制裁的人员、Google/Devpost 员工及家属、政府机构雇员。

- **中国不在排除名单里。** 资格按居住地（residence）判定，不按国籍。
- 参赛者须达到居住地成年年龄（台湾地区 20 岁），有互联网接入。
- 结论：黄俊（成都，中国大陆居民）可以参赛。✅ 继续。

## 2. 时间线（已换算北京时间 CST = UTC+8）

| 节点 | PT 时间 | 北京时间 |
|---|---|---|
| 投稿开放 | 11-11 13:30 PT | 11-12 05:30 |
| **投稿截止** | **11-30 14:00 PT** | **12-01 06:00** |
| 评审 | 12-10 09:00 – 12-16 14:00 PT | 12-11 01:00 – 12-17 06:00 |
| 结果公布 | 约 12-21 12:00 PT | 约 12-22 04:00 |

- 截止时间固定，不可延期；截止后提交锁定，之后推到仓库的 commit 不计入评审。
- 演示视频尽早上传（YouTube 处理要几小时）。

## 3. 评审标准（Stage 2，四项等权重，各 1–5 分）

1. Technological Implementation（技术实现）
2. Design（设计）
3. Potential Impact（潜在影响）
4. Quality of the Idea（创意质量）
- 先过 Stage 1：提交完整、合理回应挑战（pass/fail）。
- 平局按上述标准顺序裁决。评委可借助专家组 + AI 辅助分析；不公布个人分数与反馈；裁决为终局。

## 4. 奖金（总 $30,000）

- Grand Prize 大奖：$10,000（+ Firebase 团队访谈、专访博客、社媒宣传）
- 1st Runner-Up：$7,000；2nd Runner-Up：$4,000
- Best iOS / Best Android / Best Web/Chrome：各 $3,000
- 一个项目可拿 1 个大奖 + 最多 1 个平台奖。
- 领奖：须在 10 个工作日内交回表格，60 天内发放；非美国获奖者须交 W-8BEN（美国交 W-9），自行承担税费与转账费。

## 5. 要做什么（What to Create）

- 用 Firebase AI Logic 做的生成式 AI 应用，可搭配 App Check、Remote Config、Firestore、Auth 等 Firebase 产品。
- 平台至少选一（多平台优先）：
  - Web（Chrome）：Gemini Nano 4 via Firebase AI Logic；须支持 Web 应用或 Chrome 扩展
  - Android：Gemini Nano 4 via Firebase AI Logic
  - iOS：Apple Foundation Models via Firebase AI Logic
- **全部 AI 推理必须走 Firebase AI Logic**；不得直接调其他模型 API。
- App Check 是 AI Logic 的必需项；提交中可用 debug token；**绝不在公开仓库里提交 App Check debug token、service account key、.env 文件**。
- 应用至少支持英文；所有提交材料须为英文（或附英文翻译）。
- 须能稳定安装运行，功能与视频/描述一致。
- 须提供可访问的运行项目（网站链接、可用 demo、测试构建），免费、无限制，供评委测试至评审期结束；评委不强制测试，可能只看描述、图片、视频。
- 新项目或 11-11 之后大幅更新的已有项目均可；可用框架、库、starter 模板、AI 编程助手，须披露既有代码；须附“提交期内做了什么”的总结。
- 多个提交可以，但每个须独特且实质不同。

## 6. 交付物清单

- [ ] Devpost 上至少选一个平台（Web / Android / iOS）
- [ ] 文字描述：如何使用 Firebase AI Logic、功能、价值主张
- [ ] 公开 GitHub 或 GitLab 仓库：含开源许可证（Apache 优先，任意开源许可均可，须在仓库 About 可见）、全部源码与资产、运行说明；仓库须能看出 Firebase AI Logic 被 import 并在运行时真实调用，而不只是 README 里提到
- [ ] 演示视频：≤3 分钟，公开 YouTube 链接，英文或英文字幕，展示项目在目标平台上真实运行；前 30 秒讲清创意（面向谁、解决什么问题、Firebase AI Logic 如何实现）；只评估前 3 分钟
- [ ] 工作项目 URL（强烈建议，非强制）
- [ ] （如为已有应用）提交期内新增内容的总结
- [ ] 测试说明：如需登录，须在测试说明里给账号；不得含生产 API key、Google Cloud 机密、PII

## 7. 混合推理要求（核心得分点）

- 评委要看到设备端 + 云端两种推理，并评分“混合推理用得是否有效”。
- 可按功能选模式：敏感数据只走设备端（on-device only），其他功能走混合或云端。
- 模式：PREFER_ON_DEVICE（有本地模型时走设备端，否则回退云端）、prefer cloud、on-device only、cloud only；每个配置单独建 model 实例。
- 设备端：Chrome/Android 上 Gemini Nano 4，iOS 上 Apple Foundation Models；云端：Firebase AI Logic 支持的 Gemini 模型。
- Chrome 开 Gemini Nano 4：Prompt API，须在 chrome://flags 开启 "Gemma 4 for Built-in AI"；仅支持 Nano 的 Chrome 版本与设备可用。
- 官方建议：先跑通一个能用的应用；demo 不必完美；第 1 个能用的版本就是成就。

## 8. 费用与额度（免费路线可行）

- 全部必需工具（含 Firebase AI Logic、Gemini Nano 4）免费层可用；文本推理在用量限额内免费。
- 需计费的模型（图片生成、TTS 等）须通过 Google Account Quota 表格申请（先注册比赛再填表）：https://forms.gle/uPcDhaYW3iVo2AYw5
- 额度账号有效期自发放起 4 天；不保证获批，由 Google 酌情决定；超出额度/有效期的费用自理。
- Sprint 3（最后一批）：申请截止 Wed Nov 25 10:00 AM PT（= 北京时间 11-26 02:00），账号 11-27 发出；每人/每项目/每 Sprint 限 1 个账号。
- **本项目决策：只用免费层模型（设备端 Gemini Nano 4 + 云端免费层 Gemini 文本模型），不申请额度账号，不产生费用。** 因此无需用户填 Quota 表。

## 9. 需要用户本人做的步骤（不要代编账号密码）

- Devpost 账号注册（用户 Gmail）+ 报名比赛
- Firebase 项目创建（用户 Google 账号登录 Firebase 控制台）+ Web 应用配置（apiKey 等，公开的 Web 配置可写入代码；机密不提交）
- GitHub 公开仓库创建（账号待确认：juniverse118？）+ 推送代码
- YouTube 演示视频上传（公开）+ 提交表单填写
- 获奖后 W-8BEN 表格（如获奖）

## 10. 红线

- 不抄 starter 模板：从零写代码（规则允许模板与 AI 助手，但按本项目铁律从零写）。
- 不提交任何机密：debug token、service account key、.env、生产 API key、PII。
- 不编数字、不承诺收入；应用内所有示例数据须标注为示例。
- 免费路线：不产生任何费用。
