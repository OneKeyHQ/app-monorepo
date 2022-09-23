import { useIsVerticalLayout } from '@onekeyhq/components';

import { useAppSelector, usePrevious } from '../../../hooks';

function useWalletSelectorStatus() {
  const isVertical = useIsVerticalLayout();
  const { isDesktopWalletSelectorVisible, isMobileWalletSelectorDrawerOpen } =
    useAppSelector((s) => s.accountSelector);

  const visible = isVertical
    ? isMobileWalletSelectorDrawerOpen
    : isDesktopWalletSelectorVisible;

  const visiblePrev = usePrevious(visible);
  const isOpenFromClose = !visiblePrev && visible;
  return {
    visible,
    isOpenFromClose,
  };
}

export { useWalletSelectorStatus };
