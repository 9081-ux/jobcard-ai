# JobCard AI — Firebase + Devpost 手机/电脑一步步操作指南

给用户本人的操作指南（2026-11-25 准备）。GitHub 已解决（@9081-ux，登录成功），
剩下只有这两件是用户能做的。全部免费，不用银行卡，不用填任何密码给 Muse。

---

## 先做哪件？先做 Firebase（最关键）

没有 Firebase 配置，JobCard AI 只能跑模拟模式，评委眼里就是弱版。
Devpost 报名 5 分钟就能做完，可以第二件做。

---

## 第一件：Firebase 建项目、开 AI Logic、拿 Web 配置（约 10 分钟）

全程用谷歌邮箱 huangjun9081@gmail.com 登录。电脑浏览器做最顺手，手机浏览器也可以。

### 1. 建项目

1. 打开 https://console.firebase.google.com/ ，用 huangjun9081@gmail.com 登录。
2. 点 **Add project**（创建项目）。
3. 项目名填 `jobcard-ai`，点 Continue。
4. 问要不要开 Google Analytics：选 **不启用**（Not right now / Disable），点 Create project。
5. 等它建好，点 Continue 进项目主页。

### 2. 开 AI Logic，选免费的 Gemini Developer API

1. 左边菜单找到 **AI Services → AI Logic**（中文界面叫“AI 服务 → AI Logic”），点 **Get started**。
2. 出现选择时，选 **Gemini Developer API**。这是免费档，不用绑卡。
   - 千万别选另一个（Agent Platform / Vertex AI），那个要绑卡付费。
3. 跟着向导点下一步，它会自动开通需要的两个 API，等它完成。
   - 向导里如果提到 App Check：不用你另外操作，留默认，继续往下走；
     如果它让你建 reCAPTCHA 之类的东西，停下来，把屏幕上的话原样告诉 Muse。
   - 向导里如果出现一个 Gemini API key：**不要把它发给任何人，也不要贴进代码**，
     那不是要给 Muse 的东西，跳过它继续。

### 3. 注册 Web 应用，复制 6 项配置发给 Muse

1. 点左上角齿轮 **⚙️ Project settings**（项目设置）→ **General**（常规）。
2. 往下翻到 **Your apps**，点网页图标 **</>**（Add app → Web）。
3. 昵称填 `jobcard-ai-web`，点 Register app。
4. 页面会显示一段 `firebaseConfig`，里面有 6 项，**全部复制发给 Muse**：
   `apiKey`、`authDomain`、`projectId`、`storageBucket`、`messagingSenderId`、`appId`。
   - 只发这 6 项就行，不用发别的。
   - apiKey 是公开标识符，可以发给 Muse；但**不要把它发到公开群聊或贴到网上**。

### 做到哪一步卡住了？

- 哪个按钮找不到：把那一页截图发给 Muse，告诉 Muse你停在哪一步。
- 任何页面问你要银行卡/绑卡：停下来，别填，先告诉 Muse。
- 配置发过来后，Muse 接真实引擎、逐项实测、重新部署，不用你再动手。

---

## 第二件：Devpost 注册 + 报名比赛（约 5 分钟）

1. 打开 https://devpost.com/ ，点右上角 **Sign up**，选 **用 Google 账号注册**，
   用 huangjun9081@gmail.com 登录。
2. 再打开 https://firebasehybridaihackathon.devpost.com/ ，点 **Join hackathon**（报名参赛）。
   - 注意：只注册 Devpost 账号不算报名，必须在这个比赛页点 Join hackathon 才算报上名。
3. 报完名告诉 Muse 一声“报上了”，不用填队伍——一个人参赛，不用组队。

---

## 时间线（对照用）

- 投稿截止：**2026-12-01 06:00 北京时间**。
- 配置一到：Muse 当天换接真实引擎并实测。
- 11-28 前部署自测，11-29 录演示视频 + 推 GitHub 公开仓库，11-30 上午提交并验状态。
- 额度申请不用填（只用免费层）；最后一批额度申请截止 2026-11-26 02:00 与本项目无关。

## 依据

- Firebase 官方 Get started（2026-11-25 核查）：建项目不用开 Analytics；
  AI Services → AI Logic → Get started → 选 Gemini Developer API（免费档，
  另一档 Vertex/Agent Platform 需 Blaze 付费）；向导自动开通所需 API。
  https://firebase.google.com/docs/ai-logic/get-started
- Devpost 官方帮助：报名比赛须在比赛页点 Join hackathon，
  只注册 Devpost 账号不算报名。https://help.devpost.com/article/119-registering-for-a-hackathon
- 项目内文件：~/workspace/autonomous-income/buildhybridai-2026/SWAP-TO-REAL.md
  （给开发者的换接说明）、DEPLOY.md（部署记录：修复版已上线，56/56 测试通过）。
