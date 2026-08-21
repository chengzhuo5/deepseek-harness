import { useEffect, useState } from 'react'
import { IconBellOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import css from './NotificationBell.module.css'

/** Full props for the session-header completion-notification bell. */
export type NotificationBellProps =
  PropsRuntime<'conversation.session.header.actions'> & PropsLocale<typeof NS>

/** Permission states the bell can show; 'unsupported' = no Notification API. */
type BellState = 'off' | 'on' | 'denied' | 'unsupported'

/** Map the browser permission to the bell's visual state. */
function bellState(permission: NotificationPermission | undefined): BellState {
  if (permission === undefined) return 'unsupported'
  if (permission === 'granted') return 'on'
  if (permission === 'denied') return 'denied'
  return 'off'
}

/**
 * Session-header bell: requests browser notification permission on click and
 * reflects the current permission state. The completion watcher (registered by
 * the plugin apply body) only fires once permission is granted, so this button
 * is the only permission entry point.
 */
export function NotificationBell({ t }: NotificationBellProps) {
  const [state, setState] = useState<BellState>(() =>
    bellState(typeof Notification === 'undefined' ? undefined : Notification.permission))

  // Reflect permission changes that happen outside this component (browser
  // settings, another tab) while the bell is mounted.
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    const update = (): void => { setState(bellState(Notification.permission)) }
    document.addEventListener('visibilitychange', update)
    return () => { document.removeEventListener('visibilitychange', update) }
  }, [])

  const title = state === 'on' ? t('bell.title.on')
    : state === 'denied' ? t('bell.title.denied')
      : t('bell.title.off')

  return (
    <button
      type="button"
      className={css.bell}
      aria-label={t('bell.aria')}
      title={title}
      disabled={state === 'unsupported' || state === 'denied'}
      onClick={() => {
        if (typeof Notification === 'undefined') return
        void Notification.requestPermission().then((permission) => {
          setState(bellState(permission))
        })
      }}
    >
      <IconBellOutline16 />
    </button>
  )
}
