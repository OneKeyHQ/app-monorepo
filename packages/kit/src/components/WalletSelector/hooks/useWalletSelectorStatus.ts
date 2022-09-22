import * as React from 'react';

// @ts-ignore
import DrawerStatusContext from '@react-navigation/drawer/lib/module/utils/DrawerStatusContext';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { useAppSelector, usePrevious } from '../../../hooks';

function useWalletSelectorStatus() {
  const isVertical = useIsVerticalLayout();
  const { isDesktopWalletSelectorVisible } = useAppSelector(
    (s) => s.accountSelector,
  );
  const drawerStatus = React.useContext(DrawerStatusContext);
  // const drawerStatus = useDrawerStatus(); // cause error on iPad

  const isDrawerOpen = drawerStatus === 'open';
  const visible = isVertical ? isDrawerOpen : isDesktopWalletSelectorVisible;
  const visiblePrev = usePrevious(visible);
  const isOpenFromClose = !visiblePrev && visible;
  return {
    visible,
    isOpenFromClose,
  };
}

export { useWalletSelectorStatus };
