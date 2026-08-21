# Agent Note: Session-completion browser notification

Status: implemented

English | [中文](2026-08-21-session-completion-browser-notification.zh.md)

## Problem

A human at the Web client who sends a long task and switches away — another tab, another window, another application — has no signal when the session's work finishes. The session list row shows a running dot, but only while the page is the active surface; the moment the user leaves, the only way to learn the task ended is to come back and look.

The runtime already tracks the exact edge that matters: `SessionManager.syncCompletedNotifications` observes each session's running bit and arms a "finished while away" reminder (the sidebar's green dot) on the true→false transition. But that reminder lives inside the page. A system notification — the browser's Notification API — is the standard way to reach a user who left the tab.

## Decision

[`dsh-client-ui-session-notification`](../../../../packages/client/ui-session-notification/README.md) watches the `sessions` list snapshot and, on a session's running→idle edge, raises a browser system notification — but only when both of these hold:

1. `document.hidden` is true — the user is not looking at the page, so the notification is the only delivery channel that reaches them.
2. `Notification.permission === 'granted'`.

The notification is titled with the session's display title; activating it focuses the window and opens the session.

The bell in `conversation.session.header.actions` is the only permission entry point. Browsers only present the permission prompt on a user gesture, so the plugin cannot request permission at boot; clicking the bell is the gesture, and the watcher never fires until that grant lands. The bell reflects the permission state and disables once denied, since the browser will not prompt again for a page it rejected.

### Edge detection

The watcher reuses the exact pattern `syncCompletedNotifications` proves: the first observation of a session only records its running bit and never fires. A fresh page load or a reconnected stream therefore never raises a notification for work that finished before this page was looking. Sessions with `origin: 'subagent'` and blank rows are excluded entirely: a subagent's finish is not the top-level task's completion, and a blank session never ran.

The watcher is a plain class over injected dependencies (`SessionListSource`, `NotificationPermissionSource`, `NotificationSink`), which keeps the edge logic unit-testable without jsdom while the bell's permission path rides the same source the watcher gates on.

### What this is not

This is not a service-worker or push notification channel: the notification is raised by the open page through the Notification API, so closing the tab silences it. No current host channel provides push delivery, and inventing one is out of scope.

## Alternatives considered

- **Notification on every turn end, visible page included.** Rejected: a user actively watching the page already sees the work; a system notification for visible work is noise.
- **Reuse the sidebar's `completed` reminder bit.** The bit only arms for non-selected sessions and exists for in-page chrome; the notification targets the page-hidden case regardless of selection, and the underlying running-edge data is the same source either way.
- **Auto-request permission at boot.** Rejected by the platform: the browser will not show the prompt without a user gesture.

## Required verification

- Watcher unit tests: first-observation baseline, edge fire, page-visible suppression, permission gating, subagent/blank exclusion, click-to-open, removed-session cleanup, double-start rejection.
- HMR safety: the header bell registration removes on fiber teardown.
- Bilingual README and this note stay pair-consistent; `verify-translation-pairing` passes.
- `pnpm run test:gui` green; `pnpm build` completes.
