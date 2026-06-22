// Cross-platform "the user is leaving / putting the app in background" trigger.
// Used to force-flush cold-start cache writes that would otherwise sit in
// the 2 s debounce window when the app is suddenly closed/backgrounded.
//
// Native: AppState 'background' (same semantic as before this helper existed,
//   the listener was inline in packages/kit-bg/.../utils/index.ts).
// Web/Desktop: visibilitychange === 'hidden' + pagehide + freeze (covers tab
//   switch, tab close, navigation away, lock screen, and the Page Lifecycle
//   API 'frozen' state that mobile Safari / Chromium can enter without
//   firing visibilitychange).

import platformEnv from '../platformEnv';

type FlushSubscriber = () => Promise<void> | void;

// Set-of-subscribers: multiple callers can register independent flush hooks
// and all of them fire on each lifecycle event. The first successful
// registration is responsible for attaching the underlying DOM / AppState
// listeners; subsequent calls only add to the Set.
const subscribers = new Set<FlushSubscriber>();
let listenersAttached = false;

function notifyAll(): void {
  // Snapshot to be safe against subscribers that unregister during iteration.
  const snapshot = Array.from(subscribers);
  for (const fn of snapshot) {
    try {
      // Intentionally do not await: lifecycle handlers (especially pagehide)
      // run synchronously and the browser will not wait for returned
      // Promises. See pagehide handler comment for the full caveat.
      void fn();
    } catch {
      /* swallow — one bad subscriber should not block the rest */
    }
  }
}

function attachListeners(): boolean {
  if (platformEnv.isNative) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AppState } =
        require('react-native') as typeof import('react-native');
      AppState.addEventListener('change', (state) => {
        if (state === 'background') {
          notifyAll();
        }
      });
      return true;
    } catch {
      /* react-native not available in non-RN env */
      return false;
    }
  }

  if (platformEnv.isWeb || platformEnv.isDesktop) {
    let anyAttached = false;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          notifyAll();
        }
      });
      // Page Lifecycle API: mobile Safari / Chromium can freeze a
      // backgrounded tab to reclaim memory WITHOUT firing visibilitychange
      // again, so we need an explicit 'freeze' hook to catch that path.
      document.addEventListener('freeze', () => {
        notifyAll();
      });
      anyAttached = true;
    }
    if (typeof globalThis !== 'undefined' && 'addEventListener' in globalThis) {
      // NOTE (pagehide best-effort caveat): subscribers may kick off async
      // IDB writes from here, but the browser does NOT await Promises
      // returned from pagehide / unload handlers. Any IDB transaction that
      // has not committed by the time the document is torn down can be
      // aborted. This handler is therefore best-effort; durability comes
      // from the earlier visibilitychange === 'hidden' path which usually
      // fires first and gives the IDB transaction time to commit. We
      // intentionally do NOT register 'beforeunload' here — modern browsers
      // surface a confirmation prompt to the user when listeners are
      // attached, which would degrade UX. For Electron desktop the
      // window-close path is handled in the main process and should call
      // into the renderer's flush endpoint directly; there is no reliable
      // renderer-side 'before-quit' hook reachable from this module.
      (globalThis as unknown as Window).addEventListener('pagehide', () => {
        notifyAll();
      });
      anyAttached = true;
    }
    return anyAttached;
  }

  return false;
}

/** Register a flush subscriber. Returns an unsubscribe function.
 *  Multiple callers can register independently; all subscribers run on
 *  every lifecycle event. The underlying DOM / AppState listeners are
 *  attached lazily on the first successful registration. */
export function registerColdStartFlushTrigger(
  onFlush: FlushSubscriber,
): () => void {
  subscribers.add(onFlush);

  if (!listenersAttached) {
    // Only latch the flag once the attach actually succeeded, so a failed
    // attempt (e.g. SSR / non-DOM env / addEventListener throwing) does not
    // permanently block subsequent registrations from retrying.
    if (attachListeners()) {
      listenersAttached = true;
    }
  }

  return () => {
    subscribers.delete(onFlush);
  };
}
