// Cross-platform "the user is leaving / putting the app in background" trigger.
// Used to force-flush cold-start cache writes that would otherwise sit in
// the 2 s debounce window when the app is suddenly closed/backgrounded.
//
// Native: AppState 'background' (same semantic as before this helper existed,
//   the listener was inline in packages/kit-bg/.../utils/index.ts).
// Web/Desktop: visibilitychange === 'hidden' + pagehide (covers tab switch,
//   tab close, navigation away, lock screen).

import platformEnv from '../platformEnv';

let registered = false;

/** Register a single flush trigger. Idempotent — subsequent calls are no-ops.
 *  Pass the function that should run when the app is about to lose focus. */
export function registerColdStartFlushTrigger(onFlush: () => void): void {
  if (registered) return;
  registered = true;

  if (platformEnv.isNative) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AppState } =
        require('react-native') as typeof import('react-native');
      AppState.addEventListener('change', (state) => {
        if (state === 'background') {
          onFlush();
        }
      });
    } catch {
      /* react-native not available in non-RN env */
    }
    return;
  }

  if (platformEnv.isWeb || platformEnv.isDesktop) {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          onFlush();
        }
      });
    }
    if (typeof globalThis !== 'undefined' && 'addEventListener' in globalThis) {
      (globalThis as unknown as Window).addEventListener('pagehide', onFlush);
    }
  }
}
