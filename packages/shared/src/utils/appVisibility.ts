import platformEnv from '../platformEnv';

// Single cached boolean fed by platform-native visibility/focus signals.
// Cheap to read from hot paths (no sync IPC, no DOM query per call).
//
// Web / desktop renderer → document.visibilitychange + window focus/blur
// Mobile (RN)            → AppState 'change' event
// Extension service worker / unknown → defaults to visible (no signal)
let _visible = true;
let _initialized = false;

function _initOnce(): void {
  if (_initialized) return;
  _initialized = true;

  try {
    if (platformEnv.isNative) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AppState } =
        require('react-native') as typeof import('react-native');
      _visible =
        AppState.currentState === 'active' || AppState.currentState === null;
      AppState.addEventListener('change', (state) => {
        _visible = state === 'active';
      });
      return;
    }

    if (
      platformEnv.isDesktop &&
      typeof globalThis !== 'undefined' &&
      globalThis.desktopApi?.onAppState
    ) {
      try {
        _visible = globalThis.desktopApi.isFocused?.() ?? true;
      } catch {
        _visible = true;
      }
      globalThis.desktopApi.onAppState((state) => {
        _visible = state === 'active';
      });
      return;
    }

    if (typeof document !== 'undefined') {
      _visible = document.visibilityState === 'visible';
      document.addEventListener('visibilitychange', () => {
        _visible = document.visibilityState === 'visible';
      });
      if (typeof globalThis.window !== 'undefined') {
        globalThis.window.addEventListener('focus', () => {
          _visible = true;
        });
        globalThis.window.addEventListener('blur', () => {
          _visible = false;
        });
      }
    }
  } catch {
    // Any subscription failure → never accidentally suppress work.
    _visible = true;
  }
}

export function isAppVisible(): boolean {
  _initOnce();
  return _visible;
}
