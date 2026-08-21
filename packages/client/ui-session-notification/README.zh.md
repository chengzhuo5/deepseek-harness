# @deepseek-ai/dsh-client-ui-session-notification

[English](README.md) | 中文

Web 会话完成通知特性的归属方：向 `conversation.session.header.actions` 贡献一个条目——请求浏览器通知权限的铃铛——并监听 `sessions` 列表中会话从运行到空闲的边缘。当页面处于后台、权限已授予、且某会话的任务完成时，浏览器弹出一条以该会话显示标题为标题的系统通知；点击通知会聚焦窗口并打开该会话。

铃铛是唯一的权限入口：观察器对每条通知都以 `Notification.permission === 'granted'` 把关，而浏览器只在用户手势下才显示权限询问，点击铃铛正是这个手势。铃铛反映权限状态，被拒绝后禁用——浏览器不会再为已拒绝的页面弹询问。

边缘检测复刻 runtime 的 `syncCompletedNotifications` 模式：对会话的首次观察只记录运行位，因此全新加载的页面或重连的流不会为「本页开始看之前就已结束」的工作误发通知。`origin: 'subagent'` 的行与空白行永不触发——子代理的结束不是顶层任务的完成，空白会话从未运行过。通知只在 `document.hidden` 为真时发出，正在看页面的用户不会因为已经看到的工作而被系统通知打扰。

行为由 [会话完成浏览器通知 Agent Note](../../../.agents/notes/implemented/feature/2026-08-21-session-completion-browser-notification.zh.md) 规定。

## 模型体验

无，因为本包为人类渲染宿主计算出的会话状态，不触及 prompt、消息、schema、流或工具结果。

#### KV Cache effect

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- **每条完成边缘一次通知** —— 会话完成后又被追问、再次完成后会再次通知。这是刻意的（每次任务完成都是一次完成），但长自主链在页面一直隐藏时每轮都出一条通知。
- **没有 service worker 通知** —— 通知由打开的页面经 Notification API 发出，关闭标签页即静默。推送式通知（service worker + 服务端推送）是另一套传输，当前没有任何宿主通道提供它。
