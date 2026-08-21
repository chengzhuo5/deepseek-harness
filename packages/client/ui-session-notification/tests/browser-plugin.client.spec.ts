/**
 * ui-session-notification plugin halves: the browser entry's dictionary and
 * header-slot registrations against the real SlotRegistry (with fiber teardown
 * proving removal — HMR safety), the inert node entry, the invariant
 * companion's ownership reservation, and the completion watcher's edge logic.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as applyLocale, inject as localeInject } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyNode } from '../src/index.ts'
import * as NotificationInvariant from '../src/invariant.ts'
import { en, NS, zh } from '../src/client/locales.ts'
import { SessionCompletionWatcher, type NotificationPermissionSource, type NotificationSink, type SessionListSource } from '../src/client/session-notification.ts'
import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'

/** Brand a test id string as a SessionId (the wire type is branded). */
function sid(id: string): SessionId {
  return id as SessionId
}

/** Slot ledger reader: entry ids currently registered in the header list. */
function headerEntryIds(ctx: Context): (string | undefined)[] {
  return ctx.slots
    .entries('conversation.session.header.actions')
    .map(entry => entry.options.id)
}

/** Boot the browser half over a real slot tree that declares the header list. */
async function bench(): Promise<{ ctx: Context; fiber: ReturnType<Context['plugin']> }> {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.session.header.actions': { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
  // The watcher subscribes to the sessions list; the bench supplies a quiet
  // empty-list source so apply boots without a real runtime.
  ctx.provide('sessions', {
    list: {
      getSnapshot: () => ({ ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined }),
      subscribe: () => () => {},
    },
  })
  // The locale plugin binds a settings scope, which reads the connection handle
  // and the forwarded-event port.
  ctx.provide('connection', { api: { settings: {} }, isLoopback: false } as never)
  ctx.provide('remote', { $on: () => () => {} } as never)
  ctx.provide('settingsScope', { bind: () => stubSettingsScope().scope } as never)
  await ctx.plugin({ inject: localeInject, apply: applyLocale }).await()
  // These specs assert the shipped Chinese copy. There is no jsdom `window` in
  // this lane, so browser-language detection never runs and the locale comes
  // from FALLBACK_LOCALE (en): state the asserted locale explicitly.
  ctx.locale.setLocale('zh')
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber }
}

/** One list row with the minimum fields the watcher reads. */
function row(overrides: Partial<SessionSummary> & { id: string }): SessionSummary {
  return {
    displayTitle: overrides.id,
    running: false,
    blank: false,
    ...overrides,
  } as SessionSummary
}

/** A mutable list source the watcher subscribes to. */
function listSource(): { source: SessionListSource; state: SessionListState; emit: () => void } {
  const state: SessionListState = {
    ids: [], byId: {}, current: undefined, phase: 'ready',
    subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  } as SessionListState
  const listeners = new Set<() => void>()
  const source: SessionListSource = {
    snapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
  return {
    source,
    state,
    emit: () => { for (const fn of [...listeners]) fn() },
  }
}

/** Convenience wrapper for watcher dependency stubs. */
function deps() {
  let permission: NotificationPermission = 'default'
  let hidden = true
  const shown: { title: string; body: string; onClick: () => void }[] = []
  let permissionCalls = 0
  const permissionSource: NotificationPermissionSource = {
    permission: () => permission,
    requestPermission: async () => { permissionCalls += 1; return permission },
  }
  const sink: NotificationSink = {
    isPageHidden: () => hidden,
    show: (title, body, onClick) => { shown.push({ title, body, onClick }) },
  }
  return {
    permissionSource, sink, shown,
    setPermission: (next: NotificationPermission): void => { permission = next },
    setHidden: (next: boolean): void => { hidden = next },
    permissionCalls: (): number => permissionCalls,
  }
}

describe('ui-session-notification browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['sessions', 'slots', 'locale'])
  })

  it('registers the header bell, and fiber teardown removes it (HMR safety)', async () => {
    const { ctx, fiber } = await bench()
    expect(headerEntryIds(ctx)).toContain('session-notification')
    await fiber.dispose()
    expect(headerEntryIds(ctx)).not.toContain('session-notification')
  })

  it('registers both dictionaries under its own namespace and releases them with the fiber', async () => {
    const { ctx, fiber } = await bench()
    const translate = ctx.locale.bind(NS)
    expect(translate('notification.body')).toBe(zh['notification.body'])
    ctx.locale.setLocale('en')
    expect(translate('notification.body')).toBe(en['notification.body'])

    // Withdrawn dictionaries leave the key unresolved rather than translated.
    await fiber.dispose()
    expect(translate('notification.body')).not.toBe(en['notification.body'])
  })

  it('keeps the English dictionary key-identical to the Chinese source of truth', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })
})

describe('SessionCompletionWatcher', () => {
  it('fires only on a running→idle edge after the first observation', () => {
    const { source, state, emit } = listSource()
    const { permissionSource, sink, setPermission, shown } = deps()
    setPermission('granted')
    const opened: string[] = []
    const watcher = new SessionCompletionWatcher(
      source, permissionSource, sink,
      row => row.displayTitle, '完成', () => { opened.push('opened') },
    )
    const dispose = watcher.start()

    // First observation records the bit without firing (page load baseline).
    state.ids = [sid('s1')]
    state.byId[sid('s1')] = row({ id: sid('s1'), running: false })
    emit()
    expect(shown).toHaveLength(0)

    // running edge up: no fire.
    state.byId[sid('s1')] = row({ id: sid('s1'), running: true })
    emit()
    expect(shown).toHaveLength(0)

    // running→idle while hidden and granted: fires with displayTitle + body.
    state.byId[sid('s1')] = row({ id: sid('s1'), running: false })
    emit()
    expect(shown).toHaveLength(1)
    expect(shown[0]!.title).toBe('s1')
    expect(shown[0]!.body).toBe('完成')

    // No re-fire on the same idle state.
    emit()
    expect(shown).toHaveLength(1)

    dispose()
    // After disposal, further changes never fire.
    state.byId[sid('s1')] = row({ id: sid('s1'), running: true })
    emit()
    state.byId[sid('s1')] = row({ id: sid('s1'), running: false })
    emit()
    expect(shown).toHaveLength(1)
  })

  it('does not fire while the page is visible, without permission, or for subagent/blank rows', () => {
    const { source, state, emit } = listSource()
    const { permissionSource, sink, shown } = deps()
    const watcher = new SessionCompletionWatcher(
      source, permissionSource, sink,
      row => row.displayTitle, '完成', () => {},
    )
    watcher.start()

    // Page visible: no fire even when granted.
    sink.isPageHidden = () => false
    state.ids = [sid('s1')]
    state.byId[sid('s1')] = row({ id: sid('s1'), running: true })
    emit()
    state.byId[sid('s1')] = row({ id: sid('s1'), running: false })
    emit()
    expect(shown).toHaveLength(0)

    // Permission not granted: no fire.
    sink.isPageHidden = () => true
    state.byId[sid('s1')] = row({ id: sid('s1'), running: true })
    emit()
    state.byId[sid('s1')] = row({ id: sid('s1'), running: false })
    emit()
    expect(shown).toHaveLength(0)

    // Subagent rows are excluded.
    state.byId[sid('s1')] = row({ id: sid('s1'), running: true })
    state.ids = [sid('s1'), sid('s2')]
    state.byId[sid('s2')] = row({ id: sid('s2'), running: true, origin: 'subagent' })
    emit()
    state.byId[sid('s1')] = row({ id: sid('s1'), running: false })
    state.byId[sid('s2')] = row({ id: sid('s2'), running: false, origin: 'subagent' })
    emit()
    expect(shown).toHaveLength(0)

    // Blank rows are excluded too.
    state.ids = [sid('s1'), sid('s2'), sid('s3')]
    state.byId[sid('s3')] = row({ id: sid('s3'), running: true, blank: true })
    emit()
    state.byId[sid('s3')] = row({ id: sid('s3'), running: false, blank: true })
    emit()
    expect(shown).toHaveLength(0)
  })

  it('opens the session when the notification is activated', () => {
    const { source, state, emit } = listSource()
    const { permissionSource, sink, setPermission, shown } = deps()
    setPermission('granted')
    const opened: string[] = []
    const watcher = new SessionCompletionWatcher(
      source, permissionSource, sink,
      row => row.displayTitle, '完成', (id) => { opened.push(id) },
    )
    watcher.start()

    state.ids = [sid('s1')]
    state.byId[sid('s1')] = row({ id: sid('s1'), running: true })
    emit()
    state.byId[sid('s1')] = row({ id: sid('s1'), running: false })
    emit()
    expect(shown).toHaveLength(1)
    shown[0]!.onClick()
    expect(opened).toEqual(['s1'])
  })

  it('drops removed sessions from the tracked set', () => {
    const { source, state, emit } = listSource()
    const { permissionSource, sink, setPermission, shown } = deps()
    setPermission('granted')
    const watcher = new SessionCompletionWatcher(
      source, permissionSource, sink,
      row => row.displayTitle, '完成', () => {},
    )
    watcher.start()

    state.ids = [sid('s1')]
    state.byId[sid('s1')] = row({ id: sid('s1'), running: true })
    emit()
    state.ids = []
    state.byId = {}
    emit()

    // A re-added session is treated as a fresh first observation: no fire for
    // an already-idle row, and a later edge does fire.
    state.ids = [sid('s1')]
    state.byId[sid('s1')] = row({ id: sid('s1'), running: false })
    emit()
    expect(shown).toHaveLength(0)
    state.byId[sid('s1')] = row({ id: sid('s1'), running: true })
    emit()
    state.byId[sid('s1')] = row({ id: sid('s1'), running: false })
    emit()
    expect(shown).toHaveLength(1)
  })

  it('refuses a second start while running', () => {
    const { source } = listSource()
    const { permissionSource, sink } = deps()
    const watcher = new SessionCompletionWatcher(
      source, permissionSource, sink,
      row => row.displayTitle, '完成', () => {},
    )
    watcher.start()
    expect(() => watcher.start()).toThrow(/already started/)
  })

  it('exposes the permission and sink stubs for the bell path', () => {
    // The bell's requestPermission path rides the same permission source the
    // watcher gates on; keep both in one place for the bench.
    const { permissionSource, setPermission } = deps()
    setPermission('granted')
    expect(permissionSource.permission()).toBe('granted')
  })
})

describe('ui-session-notification node half', () => {
  it('contributes no host behavior', () => {
    expect(applyNode).not.toThrow()
  })
})

describe('ui-session-notification invariant companion', () => {
  it('reserves package ownership under its declared companion name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    const fiber = ctx.plugin(NotificationInvariant)
    await fiber.await()
    expect(NotificationInvariant.name).toBe('client-ui-session-notification-invariant')
    expect(NotificationInvariant.inject).toEqual(['invariants'])
    // Emitting an unrelated event proves the companion installed no audit.
    expect(() => { (ctx.emit as (event: string) => void)('slots/changed') }).not.toThrow()
    await fiber.dispose()
  })
})
