import { YStack, useIsWebHorizontalLayout } from '@onekeyhq/components';

import { LazyMoreActionButton } from '../../../components/MoreActionButton/LazyMoreActionButton';

export function BottomMenu() {
  const isShowBottomMenu = useIsWebHorizontalLayout();
  return isShowBottomMenu ? (
    <YStack
      px="$3"
      pb="$3"
      pt={0}
      bg="$bgSidebar"
      gap="$2"
      alignItems="center"
      testID="bottom-menu-container"
    >
      <LazyMoreActionButton />
    </YStack>
  ) : null;
}
