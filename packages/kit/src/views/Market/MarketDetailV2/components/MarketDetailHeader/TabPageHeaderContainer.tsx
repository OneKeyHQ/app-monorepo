import type { ReactNode } from 'react';

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
  const isOverlayPage = useIsOverlayPage();

  // Skip top margin for modal pages on iOS, as modal has its own safe area handling
  const isIOSModalPage = platformEnv.isNativeIOS && isOverlayPage;
  const shouldApplyTopMargin =
    !isIOSModalPage && (top || platformEnv.isNativeAndroid);

  return (
    <>
      <Page.Header headerShown={false} />
      <XStack
        alignItems="center"
        justifyContent="space-between"
        px="$5"
        h="$12"
        {...(shouldApplyTopMargin ? { mt: top || '$2' } : {})}
      >
        {children}
      </XStack>
    </>
  );
}
