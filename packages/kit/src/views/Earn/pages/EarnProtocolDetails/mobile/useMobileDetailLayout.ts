import { useMedia } from '@onekeyhq/components';

// TODO: remove before release — local testing only.
// Forces the phone detail layout in the browser so the revamped page can be
// reviewed with `yarn app:web` instead of a device build. Typed as boolean on
// purpose, so flipping it to false does not turn the line below into
// unreachable code. Narrow the window under 768px for realistic proportions.
const DEBUG_PHONE_LAYOUT_ON_WEB: boolean = false;

// The revamped detail layout ships to phone-wide screens: phones, and web and
// the extension under 768 px, where Market swaps to its phone layout too (demo
// 10-28). Desktop, wide web and wide native (iPad, landscape) keep the
// existing page.
export function useMobileDetailLayout() {
  const { gtMd } = useMedia();
  if (DEBUG_PHONE_LAYOUT_ON_WEB) {
    return true;
  }
  return !gtMd;
}
