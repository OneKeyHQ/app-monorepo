import { memo, useCallback } from 'react';

import { MotiView } from 'moti';
import { getTokenValue } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useProviderSideBarValue from '../../../hocs/Provider/hooks/useProviderSideBarValue';

import HeaderIconButton from './HeaderIconButton';

function HeaderCollapseButton({
  isRootScreen = true,
}: {
  isRootScreen?: boolean;
}) {
  const {
    leftSidebarCollapsed: isCollapse,
    setLeftSidebarCollapsed: setIsCollapse,
  } = useProviderSideBarValue();

  const onPressCall = useCallback(() => {
    setIsCollapse?.(!isCollapse);
  }, [isCollapse, setIsCollapse]);

  const paddingLeft = getTokenValue(
    platformEnv.isDesktopMac && isRootScreen && isCollapse ? '$20' : '$0',
    'size',
  );
  return (
    <MotiView
      testID="Desktop-AppSideBar-Container"
      animate={{ paddingLeft }}
      transition={{
        type: 'spring',
        damping: 20,
        mass: 0.1,
      }}
    >
      <HeaderIconButton onPress={onPressCall} icon="SidebarOutline" />
    </MotiView>
  );
}

export default memo(HeaderCollapseButton);
