import { memo, useCallback } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useProviderSideBarValue from '../../Provider/hooks/useProviderSideBarValue';
import { Stack } from '../../Stack';

import HeaderIconButton from './HeaderIconButton';

function HeaderCollapseButton({
  isRootScreen = true,
}: {
  isRootScreen?: boolean;
}) {
  const {
    leftSidebarCollapsed: isCollpase,
    setLeftSidebarCollapsed: setIsCollapse,
  } = useProviderSideBarValue();

  const onPressCall = useCallback(() => {
    setIsCollapse?.(!isCollpase);
  }, [isCollpase, setIsCollapse]);

  const paddingLeft =
    platformEnv.isDesktopMac && isRootScreen && isCollpase ? '$20' : '$0';

  return (
    <Stack pl={paddingLeft}>
      <HeaderIconButton onPress={onPressCall} icon="SidebarOutline" />
    </Stack>
  );
}

export default memo(HeaderCollapseButton);
