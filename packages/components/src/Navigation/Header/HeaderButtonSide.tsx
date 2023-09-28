import { memo, useCallback } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useProviderSideBarValue from '../../Provider/hooks/useProviderSideBarValue';

import HeaderButtonIcon from './HeaderButtonIcon';

function HeaderButtonSide({ isRootScreen }: { isRootScreen?: boolean }) {
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
    <HeaderButtonIcon
      paddingLeft={paddingLeft}
      onPress={onPressCall}
      name="SidebarOutline"
    />
  );
}

export default memo(HeaderButtonSide);
