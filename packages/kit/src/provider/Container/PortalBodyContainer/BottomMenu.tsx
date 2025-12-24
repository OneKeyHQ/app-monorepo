import { StyleSheet } from 'react-native';

import {
  EPortalContainerConstantName,
  Portal,
  YStack,
  useIsWebHorizontalLayout,
} from '@onekeyhq/components';
import { useAppSideBarStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { MoreActionButton } from '../../../components/MoreActionButton';

function BaseBottomMenu({ isCollapse }: { isCollapse: boolean }) {
  return (
    <YStack
      px="$3"
      pb="$3"
      pt={isCollapse ? 0 : '$2'}
      borderColor="$borderSubdued"
      borderTopWidth={isCollapse ? 0 : StyleSheet.hairlineWidth}
      bg="$bgSidebar"
      gap="$2"
      alignItems={isCollapse ? 'center' : undefined}
    >
      <MoreActionButton />
    </YStack>
  );
}

export function BottomMenu() {
  const [{ isCollapsed }] = useAppSideBarStatusAtom();
  const isShowBottomMenu = useIsWebHorizontalLayout();
  return isShowBottomMenu ? (
    <Portal.Body container={EPortalContainerConstantName.SIDEBAR_BANNER}>
      <BaseBottomMenu isCollapse={isCollapsed} />
    </Portal.Body>
  ) : null;
}
