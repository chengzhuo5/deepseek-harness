/**
 * Session-completion browser-notification plugin, browser half: contributes
 * one session-header bell that requests notification permission, and starts a
 * completion watcher over the `sessions` list that raises a system
 * notification when a session's task finishes while the page is in the
 * background.
 */
import type { ClientContext, SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { NotificationBell } from './NotificationBell.tsx'
import { SessionCompletionWatcher, type NotificationPermissionSource, type NotificationSink, type SessionListSource } from './session-notification.ts'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { en, NS, zh, type SessionNotificationKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Session-completion notification copy. */
    'session-notification': SessionNotificationKey
  }
}

export type { NotificationBellProps } from './NotificationBell.tsx'
export { SessionCompletionWatcher } from './session-notification.ts'
export type { NotificationPermissionSource, NotificationSink, SessionListSource } from './session-notification.ts'

/** Required services: the sessions list (watcher + bell seat) and locale copy. */
export const inject = ['sessions', 'slots', 'locale']

/**
 * Client plugin body: register the dictionaries, the header bell, and the
 * completion watcher.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-session-notification: dictionaries')

  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'session-notification',
      // After the job list: completion notice comes after process work.
      order: 30,
      locale: NS,
    }, NotificationBell),
  )

  ctx.effect(() => {
    const permission: NotificationPermissionSource = {
      permission: () => (typeof Notification === 'undefined' ? 'denied' : Notification.permission),
      requestPermission: () => (typeof Notification === 'undefined'
        ? Promise.resolve('denied' as NotificationPermission)
        : Notification.requestPermission()),
    }
    const sink: NotificationSink = {
      isPageHidden: () => document.hidden,
      show: (title, body, onClick) => {
        const notification = new Notification(title, { body })
        notification.onclick = () => {
          notification.close()
          onClick()
          window.focus()
        }
      },
    }
    const sessions: SessionListSource = {
      snapshot: () => ctx.sessions.list.getSnapshot(),
      subscribe: fn => ctx.sessions.list.subscribe(fn),
    }
    const title = (row: SessionSummary): string => row.displayTitle
    const body = ctx.locale.bind(NS)('notification.body')
    const open = (sessionId: SessionId): void => { ctx.sessions.open(sessionId) }
    const watcher = new SessionCompletionWatcher(sessions, permission, sink, title, body, open)
    return watcher.start()
  }, 'ui-session-notification: completion watcher')
}
