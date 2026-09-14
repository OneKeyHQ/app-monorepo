import { Page, Spinner, Stack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

/**
 * Suspense fallback for the lazily loaded Earn push pages (OK-59841).
 *
 * Those routes are registered with `headerShown: !platformEnv.isNative`, and
 * the nav bar is turned on by the page itself — `EarnPageContainer` renders
 * `<Page.Header headerShown />` on iOS 26. While the split-bundle segment is
 * still resolving, the screen therefore has no header at all, and the
 * `setOptions({ headerShown: true })` that follows lands after the push has
 * already presented the screen. react-native-screens then calls
 * `setNavigationBarHidden:NO animated:YES` (RNSScreenStackHeaderConfig.mm,
 * always animated), whose UIKit animation slides the bar in from above — the
 * "header falls from the top" QA reported on the first open of every DeFi page.
 *
 * Declaring the header here makes the bar part of the push from the first
 * frame; the real page then only updates the title, which is not a
 * visibility toggle and so is not animated.
 *
 * Gated to iOS 26+: on other native versions `EarnPageContainer` renders
 * `TabPageHeader` inside the body instead, and a native bar shown here would
 * have to be hidden again — the same toggle, in the other direction.
 */
export function EarnLazyPageFallback() {
  return (
    <Page>
      {platformEnv.isNativeIOS26Plus ? <Page.Header headerShown /> : null}
      <Page.Body>
        <Stack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </Stack>
      </Page.Body>
    </Page>
  );
}

// The routers are plain .ts modules and cannot spell JSX, so the element is
// built here and shared by every Earn route that needs it.
export const earnLazyPageFallback = <EarnLazyPageFallback />;
