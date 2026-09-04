import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// TODO: remove before release — local testing only.
// Forces the phone detail layout in the browser so the revamped page can be
// reviewed with `yarn app:web` instead of a device build. Typed as boolean on
// purpose, so flipping it to false does not turn the line below into
// unreachable code. Narrow the window under 768px for realistic proportions.
const DEBUG_PHONE_LAYOUT_ON_WEB: boolean = true;

// The revamped detail layout ships to phones only. Desktop, web, mobile web and
// wide native (iPad, landscape) keep the existing single-column page untouched.
export function useMobileDetailLayout() {
  const { gtMd } = useMedia();
  if (DEBUG_PHONE_LAYOUT_ON_WEB) {
    return true;
  }
  return platformEnv.isNative && !gtMd;
}
