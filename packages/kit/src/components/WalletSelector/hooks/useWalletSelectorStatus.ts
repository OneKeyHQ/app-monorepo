import { useDrawerStatus } from '@react-navigation/drawer';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { useAppSelector, usePrevious } from '../../../hooks';

function useWalletSelectorStatus() {
  const isVertical = useIsVerticalLayout();
  const { isDesktopWalletSelectorVisible } = useAppSelector(
    (s) => s.accountSelector,
  );
  // TODO useDrawerStatus() may throw error called by outside Drawer component,
  //    you can sync drawerStatus to Redux
  const drawerStatus = useDrawerStatus();

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
