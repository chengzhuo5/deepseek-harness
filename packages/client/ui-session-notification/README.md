---
description: "Web Session-header bell arming browser notifications: a system notification when a session's task finishes while the page is in the background."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-session-notification

English | [中文](README.zh.md)

## Summary

This package reaches a user who left the tab: it watches the `sessions` list and, when a session's task finishes while the page is in the background, raises a browser system notification titled with the session's display name. A Session-header bell is the only permission entry point — browsers present the permission prompt only on a user gesture — and it reflects the current permission state. Activating a notification focuses the window and opens the session.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin in the Web composition; the row takes no config. The Session header grows a bell after the job list, and the first notification arrives only after the user grants permission through it.

### What to expect

The bell reflects the browser permission: off (click to request), on, denied (disabled — the browser will not prompt again for a page it rejected), or unsupported (hidden, on surfaces without the Notification API). When a watched session's work finishes while `document.hidden` is true and permission is granted, a system notification appears with the session's display title and the localized completion copy; activating it closes the notification, focuses the window, and opens the session. Sessions finish silently while the page is visible — the user is already looking at the work.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin registers the bell on `conversation.session.header.actions` through the standard slot/inject currency and the `session-notification` dictionaries as one effect. The completion watcher is a plain class ([`src/client/session-notification.ts`](src/client/session-notification.ts)) over three injected dependencies: the `sessions` list snapshot source, the notification-permission gate, and a notification sink carrying page visibility. The edge tracker records each session's running bit on first observation and fires only on a later running→idle transition, so a page load or reconnected stream never announces work that finished before the page was looking; rows with `origin: 'subagent'` and blank rows are excluded entirely, and a session removed from the list leaves the tracked set, re-entering as a fresh first observation. The bell is the only permission path: the watcher stays silent until the grant lands, and the browser's own permission changes reach it on the next visibility event. The node half is an empty `apply` that keeps the plugin on the host roster.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Agent Note: session-completion browser notification](../../../.agents/notes/implemented/feature/2026-08-21-session-completion-browser-notification.md) — the feature's design rationale, including the alternatives rejected.
- [Web client architecture](../../../.agents/notes/implemented/architecture/2026-07-19-gui-web-client-architecture.md) — how browser plugin rows load and register slots.

-----

<a id="model-experience"></a>
## Model Experience

None, as the bell and the notifications are browser chrome; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The notification lives in the page.** This is not a service-worker or push channel: closing the tab silences it, and no current host channel provides push delivery.
- **Grant state is the browser's.** A permission revoked in browser settings is picked up on the next page load or visibility change, not instantaneously in the bell's state.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The edge-detection design and the rejected alternatives (every-turn notifications, the sidebar's `completed` bit, boot-time permission requests) are recorded in the [feature Agent Note](../../../.agents/notes/implemented/feature/2026-08-21-session-completion-browser-notification.md).

</details>

**Runtime invariant:** No companion is published. The plugin is a read-only projection of the `sessions` list snapshot onto the browser Notification API: it emits no cordis events and owns no cross-plugin mutable relation, and its dictionary and slot registrations prove disposal through the HMR-safety spec.
