import type { ReactNode } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';

import {
  Page,
  XStack,
  useIsOverlayPage,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

interface ITabPageHeaderContainerProps {
  children: ReactNode;
}

export function TabPageHeaderContainer({
  children,
}: ITabPageHeaderContainerProps) {
  const { top } = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isOverlayPage = useIsOverlayPage();

  // Skip top margin for modal pages on iOS, as modal has its own safe area handling
  const isIOSModalPage = platformEnv.isNativeIOS && isOverlayPage;
  // On iOS 26 the screen options force headerTransparent: true so the
  // page content extends under where the navigation bar would have sat.
  // safe-area top alone (~50pt) doesn't clear that; we need the full
  // header height (~94pt = safe area + bar). Falls back to the original
  // safe-area behavior on iOS <26 / Android.
  const topInset = platformEnv.isNativeIOS26Plus ? headerHeight : top;
  const shouldApplyTopMargin =
    !isIOSModalPage && (topInset || platformEnv.isNativeAndroid);

  return (
    <>
      <Page.Header headerShown={false} />
      <XStack
        alignItems="center"
        justifyContent="space-between"
        px="$5"
        minHeight="$12"
        py="$2"
        {...(shouldApplyTopMargin ? { pt: topInset || '$2' } : {})}
      >
        {children}
      </XStack>
    </>
  );
}
