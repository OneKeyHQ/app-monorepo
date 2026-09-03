import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Local-testing escape hatch, dev builds only. The revamped layout below only
// turns on for native phones, so reviewing it in a browser normally means
// building to a device. With this on, a narrow browser window counts as a
// phone — the width condition still applies, so resizing keeps switching
// between the two layouts, which is the point of testing here.
//
//   ?debugPhoneLayout=1  turn on      ?debugPhoneLayout=0  turn off
//
// The choice is remembered in localStorage, so it survives navigation and
// reloads. Equivalent, straight from the console:
//   localStorage.setItem('onekey_debug_phone_layout', '1')
// The phone layout then applies below the gtMd breakpoint (viewport < 768px).
const DEBUG_PHONE_LAYOUT_STORAGE_KEY = 'onekey_debug_phone_layout';

function readDebugPhoneLayoutOverride(): boolean {
  // isDev comes from NODE_ENV at build time, so this is a hard false in any
  // production bundle — the switch cannot be turned on in a shipped build.
  if (!platformEnv.isDev || !platformEnv.isRuntimeBrowser) {
    return false;
  }
  try {
    const fromQuery = new URLSearchParams(globalThis.location.search).get(
      'debugPhoneLayout',
    );
    if (fromQuery !== null) {
      const enabled = fromQuery !== '0' && fromQuery !== 'false';
      globalThis.localStorage.setItem(
        DEBUG_PHONE_LAYOUT_STORAGE_KEY,
        enabled ? '1' : '0',
      );
      return enabled;
    }
    return (
      globalThis.localStorage.getItem(DEBUG_PHONE_LAYOUT_STORAGE_KEY) === '1'
    );
  } catch {
    // Private mode, or storage disabled by policy: fall back to off.
    return false;
  }
}

// Captured once on import as well, because React Navigation rewrites the
// address bar and drops the query string as soon as you navigate in-app: this
// way ?debugPhoneLayout=1 on the entry URL is picked up and remembered even
// though the detail page mounts later.
readDebugPhoneLayoutOverride();

// The revamped detail layout ships to phones only. Desktop, web, mobile web and
// wide native (iPad, landscape) keep the existing single-column page untouched.
export function useMobileDetailLayout() {
  const { gtMd } = useMedia();
  const countsAsPhone = platformEnv.isNative || readDebugPhoneLayoutOverride();
  return countsAsPhone && !gtMd;
}
