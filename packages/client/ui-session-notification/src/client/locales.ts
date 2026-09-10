/** `session-notification` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'session-notification'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'bell.aria': '任务完成时浏览器通知',
  'bell.title.off': '开启完成通知（需要浏览器权限）',
  'bell.title.on': '任务完成时已开启浏览器通知',
  'bell.title.denied': '浏览器通知权限已被拒绝，请在浏览器设置中允许',
  'notification.body': '会话任务已完成',
} as const

/** English dictionary, key-identical to the Chinese source of truth. */
export const en: Record<SessionNotificationKey, string> = {
  'bell.aria': 'Browser notification when the task finishes',
  'bell.title.off': 'Turn on completion notifications (browser permission required)',
  'bell.title.on': 'Completion notifications are on',
  'bell.title.denied': 'Notification permission was denied; allow it in browser settings',
  'notification.body': 'Session task finished',
}

/** Key domain of the `session-notification` namespace (zh is the source of truth). */
export type SessionNotificationKey = keyof typeof zh
