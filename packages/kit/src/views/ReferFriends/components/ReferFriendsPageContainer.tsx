import type { ReactNode } from 'react';

import { YStack, useMedia } from '@onekeyhq/components';
import type { IYStackProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const REFER_FRIENDS_PAGE_MAX_WIDTH = 1280;

export function ReferFriendsPageContainer({
  children,
  ...props
}: IYStackProps): ReactNode {
  const { md } = useMedia();
  const isMobileLayout = platformEnv.isNative || md;
  if (isMobileLayout) {
    return children as ReactNode;
  }

  return (
    <YStack
      width="100%"
      maxWidth={REFER_FRIENDS_PAGE_MAX_WIDTH}
      alignSelf="center"
      {...props}
    >
      {children}
    </YStack>
  );
}
