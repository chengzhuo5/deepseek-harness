/**
 * Session-completion browser notification: watches the sessions list for
 * running→idle edges and raises a system Notification when the page is in the
 * background. The edge tracker is deliberately the same pattern the runtime's
 * `syncCompletedNotifications` uses (first observation records the bit and
 * never fires), so a fresh page load or a reconnected stream never spams a
 * notification for work that finished before this page was looking.
 */

import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'

/** Notification-permission gate, abstracted for test benches. */
export interface NotificationPermissionSource {
  /** Current permission state of the browser Notification API. */
  permission(): NotificationPermission
  /** Ask the browser for permission (must ride a user gesture in real browsers). */
  requestPermission(): Promise<NotificationPermission>
}

/** System-notification sink, abstracted for test benches. */
export interface NotificationSink {
  /** True when the browser tab is not the active surface (the only time a system notification helps). */
  isPageHidden(): boolean
  /**
   * Show one system notification.
   * @param title - notification title (session display title).
   * @param body - localized completion copy.
   * @param onClick - navigation action when the user activates the notification.
   */
  show(title: string, body: string, onClick: () => void): void
}

/** The sessions-list edge source: what the watcher needs from the runtime. */
export interface SessionListSource {
  /** Current list snapshot (rows carry the running bit). */
  snapshot(): SessionListState
  /** Subscribe to list changes; returns the unsubscribe function. */
  subscribe(fn: () => void): () => void
}

/** Notify when one session's work finishes and the user is away. */
export class SessionCompletionWatcher {
  private readonly prevRunning = new Map<string, boolean>()
  private dispose: (() => void) | null = null

  /**
   * @param sessions - list source carrying each session's running bit.
   * @param permission - browser notification permission gate.
   * @param sink - system-notification sink (page-visibility + show).
   * @param title - display title resolver for one session row.
   * @param body - localized completion copy.
   */
  constructor(
    private readonly sessions: SessionListSource,
    private readonly permission: NotificationPermissionSource,
    private readonly sink: NotificationSink,
    private readonly title: (row: SessionSummary) => string,
    private readonly body: string,
    private readonly open: (sessionId: SessionId) => void,
  ) {}

  /** Start watching; returns a disposer that unsubscribes and clears tracked state. */
  start(): () => void {
    if (this.dispose !== null) throw new Error('SessionCompletionWatcher already started')
    const unsubscribe = this.sessions.subscribe(() => { this.scan() })
    this.dispose = () => {
      unsubscribe()
      this.prevRunning.clear()
      this.dispose = null
    }
    return this.dispose
  }

  private scan(): void {
    const state = this.sessions.snapshot()
    const seen = new Set<string>()
    for (const id of state.ids) {
      const row = state.byId[id]
      if (row === undefined) continue
      // Blank sessions never ran; subagents are internal work whose finish is
      // not the top-level task's completion.
      if (row.blank || row.origin === 'subagent') continue
      seen.add(id)
      const prev = this.prevRunning.get(id)
      if (prev === undefined) {
        this.prevRunning.set(id, row.running)
        continue
      }
      if (prev && !row.running) {
        this.raise(row)
      }
      this.prevRunning.set(id, row.running)
    }
    for (const id of this.prevRunning.keys()) {
      if (!seen.has(id)) this.prevRunning.delete(id)
    }
  }

  private raise(row: SessionSummary): void {
    if (!this.sink.isPageHidden()) return
    if (this.permission.permission() !== 'granted') return
    const sessionId = row.id as SessionId
    this.sink.show(this.title(row), this.body, () => { this.open(sessionId) })
  }
}
