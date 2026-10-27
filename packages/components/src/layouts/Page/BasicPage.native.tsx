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

// Native pages render their content immediately. The Android lazy-load overlay
// (a spinner that deferred children) predates native page transitions and now
// only flashed during the slide-in; iOS already rendered directly.
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
