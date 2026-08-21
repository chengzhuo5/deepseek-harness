# Agent Note: 会话完成浏览器通知

Status: implemented

[English](2026-08-21-session-completion-browser-notification.md) | 中文

## 问题

Web 端的人类用户把长任务交给会话后切走——另一个标签页、另一个窗口、另一个应用——任务完成时没有任何信号。会话列表行有运行圆点，但只在页面处于前台时可见；用户一旦离开，唯一知道任务结束的办法就是回来看一眼。

runtime 已经追踪了关键的那条边缘：`SessionManager.syncCompletedNotifications` 观察每个会话的运行位，在 true→false 变迁时武装一条「离开期间完成」提醒（sidebar 的绿点）。但那条提醒活在页面内部。系统通知——浏览器的 Notification API——才是触达已离开标签页的用户的常规手段。

## 决策

[`dsh-client-ui-session-notification`](../../../../packages/client/ui-session-notification/README.zh.md) 观察 `sessions` 列表快照，在会话的运行→空闲边缘弹出一条浏览器系统通知——但只在以下两条同时成立时：

1. `document.hidden` 为真——用户没有在看页面，通知是唯一能触达他的通道。
2. `Notification.permission === 'granted'`。

通知以会话显示标题为标题；点击通知会聚焦窗口并打开该会话。

`conversation.session.header.actions` 里的铃铛是唯一的权限入口。浏览器只在用户手势下显示权限询问，所以插件不能在启动时请求权限；点击铃铛就是这个手势，观察器在授权落地前永不触发。铃铛反映权限状态，被拒绝后禁用——浏览器不会再为已拒绝的页面弹询问。

### 边缘检测

观察器复刻 `syncCompletedNotifications` 已经证明的模式：对会话的首次观察只记录运行位，永不触发。因此全新加载的页面或重连的流，不会为本页开始看之前就已结束的工作误发通知。`origin: 'subagent'` 的行与空白行被完全排除：子代理的结束不是顶层任务的完成，空白会话从未运行过。

观察器是一个依赖注入的普通类（`SessionListSource`、`NotificationPermissionSource`、`NotificationSink`），让边缘逻辑无需 jsdom 即可单元测试，而铃铛的权限路径与观察器把关用的是同一个源。

### 这不是什么

这不是 service worker 或推送通知通道：通知由打开的页面经 Notification API 发出，关闭标签页即静默。当前没有任何宿主通道提供推送投递，发明一条不在范围内。

## 备选方案

- **每轮结束都通知，页面可见也通知。** 否决：正在看页面的用户已经看到工作；对可见工作弹系统通知是噪音。
- **复用 sidebar 的 `completed` 提醒位。** 该位只为未选中会话武装，且服务于页面内 chrome；通知针对的是页面隐藏场景，与选中无关，底层运行边缘数据无论如何是同一个源。
- **启动时自动请求权限。** 被平台否决：没有用户手势浏览器不会显示询问。

## 必做验证

- 观察器单元测试：首次观察基线、边缘触发、页面可见抑制、权限把关、subagent/空白排除、点击打开、移除会话清理、重复启动拒绝。
- HMR safety：header 铃铛注册在 fiber 拆除时移除。
- 双语 README 与本 note 保持配对一致；`verify-translation-pairing` 通过。
- `pnpm run test:gui` 通过；`pnpm build` 完成。
