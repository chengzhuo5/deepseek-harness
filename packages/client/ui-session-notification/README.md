# @deepseek-ai/dsh-client-ui-session-notification

English | [中文](README.zh.md)

Web session-completion notification owner: contributes one entry to `conversation.session.header.actions` — a bell that requests browser notification permission — and watches the `sessions` list for a session's running→idle edge. When a session's task finishes while the page is in the background and permission is granted, the browser raises a system notification titled with the session's display title; activating the notification focuses the window and opens that session.

The bell is the only permission entry point: the watcher gates every notification on `Notification.permission === 'granted'`, and browsers only show the permission prompt on a user gesture, which is what clicking the bell is. The bell reflects the permission state and disables once denied, since the browser no longer prompts for a page it rejected.

Edge detection mirrors the runtime's `syncCompletedNotifications` pattern: the first observation of a session only records its running bit, so a fresh page load or a reconnected stream never fires a notification for work that finished before this page was looking. Rows with `origin: 'subagent'` and blank rows never fire — a subagent's finish is not the top-level task's completion, and a blank session never ran. Notifications only fire while `document.hidden` is true, so a user actively watching the page is not interrupted by a system notification for work they are already seeing.

The behavior is specified by the [session-completion browser notification Agent Note](../../../.agents/notes/implemented/feature/2026-08-21-session-completion-browser-notification.md).

## Model Experience

None, as this package renders host-computed session state for a human and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **One notification per completion edge** — a session that finishes, is asked again, and finishes again notifies each time. This is deliberate (each task completion is a task completion), but a long autonomous chain of turns produces a notification per turn while the page stays hidden.
- **No service-worker notifications** — the notification is raised by the open page via the Notification API, so closing the tab silences it. A push-style notification (service worker + server push) is a separate transport that no current host channel provides.
