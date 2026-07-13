import platformEnv from '../platformEnv';

// Cross-platform visibility signal. Three entry points:
//
//   isAppVisible()              — cached boolean for hot paths
//   getCurrentVisibilityState() — live per-call read
//   onVisibilityStateChange(cb) — subscribe to transitions
//
// Platform signals:
//   Web / desktop renderer → document.visibilitychange + window focus/blur
//   Desktop (Electron)     → desktopApi.onAppState (main-process focus)
//   Mobile (RN)            → AppState 'change' event
//   Extension service worker / unknown → defaults to visible (no signal)

let _visible = true;
let _initialized = false;

function _initOnce(): void {
  if (_initialized) return;
  _initialized = true;
  try {
    onVisibilityStateChange((visible) => {
      _visible = visible;
    });
    _visible = getCurrentVisibilityState();
  } catch {
    // Any subscription failure → never accidentally suppress work.
    _visible = true;
  }
}

export function isAppVisible(): boolean {
  _initOnce();
  return _visible;
}

export function getCurrentVisibilityState(): boolean {
  if (platformEnv.isNative) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } =
      require('react-native') as typeof import('react-native');
    // currentState is null at launch while AppState retrieves it over the
    // bridge — treat null as active to avoid suppressing work during boot.
    // https://reactnative.dev/docs/appstate
    return AppState.currentState === 'active' || AppState.currentState === null;
  }
  if (platformEnv.isDesktop) {
    try {
      return globalThis.desktopApi?.isFocused?.() ?? true;
    } catch {
      return true;
    }
  }
  if (typeof document !== 'undefined') {
    return document.visibilityState === 'visible';
  }
  return true;
}

export function onVisibilityStateChange(
  callback: (visible: boolean) => void,
): () => void {
  if (platformEnv.isNative) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } =
      require('react-native') as typeof import('react-native');
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      callback(nextAppState === 'active');
    });
    return () => {
      subscription.remove();
    };
  }
  if (platformEnv.isDesktop && globalThis.desktopApi?.onAppState) {
    return globalThis.desktopApi.onAppState((state) => {
      callback(state === 'active');
    });
  }
  if (typeof document !== 'undefined') {
    const handleVisibilityStateChange = () => {
      callback(document.visibilityState === 'visible');
    };
    const windowFocus = () => callback(true);
    const windowBlur = () => callback(false);
    document.addEventListener(
      'visibilitychange',
      handleVisibilityStateChange,
      false,
    );
    if (typeof globalThis.window !== 'undefined') {
      globalThis.window.addEventListener('focus', windowFocus);
      globalThis.window.addEventListener('blur', windowBlur);
    }
    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityStateChange,
        false,
      );
      if (typeof globalThis.window !== 'undefined') {
        globalThis.window.removeEventListener('focus', windowFocus);
        globalThis.window.removeEventListener('blur', windowBlur);
      }
    };
  }
  return () => {};
}
