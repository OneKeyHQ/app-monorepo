import { useMemo } from 'react';

import { StatusBar } from 'react-native';

import { useThemeName } from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useIsModalPage } from '../../hocs';
import { Stack, YStack } from '../../primitives';

import { useIsIpadModalPage } from './hooks';
import {
  iPadModalPageContext,
  useIPadModalPageSizeChange,
} from './iPadModalPageContext';

import type { IBasicPageProps } from './type';

/**
 * Renders a status bar with the appropriate style based on the current theme and whether the page is a modal.
 *
 * Uses a light content style for dark themes or modal pages, and a dark content style otherwise.
 */
function PageStatusBar() {
  const isModalPage = useIsModalPage();
  const themeName: 'light' | 'dark' = useThemeName();

  if (themeName === 'dark') {
    return <StatusBar animated barStyle="light-content" />;
  }

  if (isModalPage) {
    return <StatusBar animated barStyle="light-content" />;
  }
  return <StatusBar animated barStyle="dark-content" />;
}

// Native pages no longer render a loading overlay.
//
// iOS dropped it in 06147be37d, once performWithoutAnimation (patched
// into react-native) stopped Fabric recycled-view frame corrections from being
// captured as implicit UIKit animations during modal presentation. Android kept
// a copy, but that copy was never tied to a readiness signal: it withheld
// children for 10ms, then covered the page with a spinner for a further 150ms
// plus an idle callback, on every `lazyLoad` page regardless of whether that
// page was actually slow to mount. Android also runs every navigation with
// `animation: 'none'` (see GlobalScreenOptions.native.ts), so there was no
// transition for the cover to protect — it only bought a guaranteed spinner
// flash and ~160ms of extra latency before first content.
//
// The `lazyLoad` prop that gated the overlay, and the `fullPage` prop whose
// min-height calculation lived inside it, are removed with it. See the commit
// message for why `fullPage` went unnoticed for a year.
export function BasicPage({
  children,
  testID,
  backgroundColor,
}: IBasicPageProps) {
  const { layout, onPageLayout } = useIPadModalPageSizeChange();
  const isIpadModalPage = useIsIpadModalPage();
  const content = useMemo(() => {
    return (
      <Stack
        backgroundColor={backgroundColor ?? '$bgApp'}
        flex={1}
        testID={testID}
      >
        {platformEnv.isNativeIOS ? <PageStatusBar /> : undefined}
        {children}
      </Stack>
    );
  }, [backgroundColor, children, testID]);
  return isIpadModalPage ? (
    <YStack flex={1} onLayout={onPageLayout}>
      <iPadModalPageContext.Provider value={layout}>
        {content}
      </iPadModalPageContext.Provider>
    </YStack>
  ) : (
    content
  );
}
