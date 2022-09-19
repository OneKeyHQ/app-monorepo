import { useDrawerStatus } from '@react-navigation/drawer';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { useAppSelector, usePrevious } from '../../hooks';

function useWalletSelectorStatus() {
  const isVertical = useIsVerticalLayout();
  const { isDesktopSelectorVisible } = useAppSelector((s) => s.accountSelector);
  const isDrawerOpen = useDrawerStatus() === 'open';
  const visible = isVertical ? isDrawerOpen : isDesktopSelectorVisible;
  const visiblePrev = usePrevious(visible);
  const isOpenFromClose = !visiblePrev && visible;
  return {
    visible,
    isOpenFromClose,
  };
}

export { useWalletSelectorStatus };
