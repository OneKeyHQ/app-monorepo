import { YStack, useIsWebHorizontalLayout } from '@onekeyhq/components';
import { useAppSideBarStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { MoreActionButton } from '../../../components/MoreActionButton';

export function BottomMenu() {
  const [{ isCollapsed }] = useAppSideBarStatusAtom();
  const isShowBottomMenu = useIsWebHorizontalLayout();
  return isShowBottomMenu ? (
    <YStack
      px="$3"
      pb="$3"
      pt={isCollapsed ? 0 : '$2'}
      bg="$bgSidebar"
      gap="$2"
      alignItems={isCollapsed ? 'center' : undefined}
    >
      <MoreActionButton />
    </YStack>
  ) : null;
}
