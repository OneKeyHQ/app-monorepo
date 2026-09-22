import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// TODO: remove before release — local testing only.
// Forces the phone layout in the browser so the revamped page can be reviewed
// with `yarn app:web` instead of a device build. Typed as boolean on purpose,
// so flipping it to false does not turn the line below into unreachable code.
// Narrow the window under 768px for realistic proportions.
const DEBUG_PHONE_LAYOUT_ON_WEB: boolean = false;

// The revamped positions page ("My portfolio", OK-61377) ships to phones only.
// Desktop, web, mobile web and wide native (iPad, landscape) keep the existing
// PortfolioTabContent page untouched — the same gate the detail page uses.
export function useMyPortfolioLayout() {
  const { gtMd } = useMedia();
  if (DEBUG_PHONE_LAYOUT_ON_WEB) {
    return true;
  }
  return platformEnv.isNative && !gtMd;
}
