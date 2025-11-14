import { YStack } from '@onekeyhq/components';
import type { IYStackProps } from '@onekeyhq/components';

export const REFER_FRIENDS_PAGE_MAX_WIDTH = 1280;

export function ReferFriendsPageContainer({
  children,
  ...props
}: IYStackProps) {
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
