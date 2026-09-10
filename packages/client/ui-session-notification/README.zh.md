---
description: "Web Session 标题栏的通知铃铛：会话任务在页面处于后台时完成时弹出浏览器系统通知。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-session-notification

[English](README.md) | 中文

## 概述

本包触达已经离开标签页的用户：它观察 `sessions` 列表，当某个会话的任务在页面处于后台时完成，便弹出一条以该会话显示名作为标题的浏览器系统通知。Session 标题栏的铃铛是唯一的权限入口——浏览器只在用户手势上展示权限询问——并反映当前的权限状态。激活通知会聚焦窗口并打开该会话。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

把本插件挂载进 Web 组合即可；该行不接收任何配置。Session 标题栏会在任务列表之后多出一个铃铛，且第一条通知只会在用户通过它授予权限之后出现。

### 预期行为

铃铛反映浏览器权限：未开启（点击可请求）、已开启、已拒绝（禁用——浏览器不会在被拒绝的页面上再次询问）或不支持（在无 Notification API 的表面上隐藏）。当被观察的会话在 `document.hidden` 为真且权限已授予时完成任务，系统通知会以会话显示标题与本地化的完成文案出现；激活通知会关闭通知、聚焦窗口并打开该会话。页面可见时任务静默完成——用户本就在看着工作。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

插件通过标准 slot/inject 通货把铃铛注册在 `conversation.session.header.actions` 上，并把 `session-notification` 词典作为单个 effect 注册。完成观察器是一个普通类（[`src/client/session-notification.ts`](src/client/session-notification.ts)），依赖三个注入项：`sessions` 列表快照源、通知权限闸门，以及携带页面可见性的通知汇。边沿追踪器在首次观察时记录每个会话的 running 位，只在其后的 running→idle 转变上触发，因此页面加载或流重连绝不会宣告页面开始观察之前就已完成的工作；`origin: 'subagent'` 的行与空白行被整体排除，从列表移除的会话退出追踪集合，重新进入时视作全新的首次观察。铃铛是唯一的权限路径：观察器在授权落地前保持静默，浏览器侧的权限变更会在下一次可见性事件到达。node 半是空的 `apply`，让插件留在宿主名册上。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [Agent Note：会话完成浏览器通知](../../../.agents/notes/implemented/feature/2026-08-21-session-completion-browser-notification.zh.md)——功能的设计依据，包括被否决的备选方案。
- [Web 客户端架构](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.zh.md)——浏览器插件行如何加载并注册 slot。

-----

<a id="model-experience"></a>
## 模型体验

无。铃铛与通知都是浏览器 chrome，本包没有任何内容到达模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **通知依附于页面。** 这不是 service-worker 或推送通道：关闭标签页即静音，当前也没有宿主通道提供推送投递。
- **授权状态归浏览器所有。** 在浏览器设置中撤销的权限会在下一次页面加载或可见性变化时被拾取，而不是即时反映到铃铛状态上。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

边沿检测设计与被否决的备选方案（每轮通知、侧栏的 `completed` 位、启动时请求权限）记录在[功能 Agent Note](../../../.agents/notes/implemented/feature/2026-08-21-session-completion-browser-notification.zh.md) 中。

</details>

**运行时不变式：** 不发布伴生入口。本包是把 `sessions` 列表快照只读投影到浏览器 Notification API 上：不发出 Cordis 事件，不持有跨插件可变关系，其词典与 slot 注册通过 HMR 安全 spec 证明可处置性。
