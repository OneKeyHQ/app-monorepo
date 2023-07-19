import { useMemo } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import { WALLET_TYPE_HW } from '@onekeyhq/engine/src/types/wallet';

import { useAppSelector, usePrevious } from '../../../hooks';
import { useRuntimeWallets } from '../../../hooks/redux';

function useWalletSelectorStatus() {
  const isVertical = useIsVerticalLayout();
  const isDesktopWalletSelectorVisible = useAppSelector(
    (s) => s.accountSelector.isDesktopWalletSelectorVisible,
  );
  const isMobileWalletSelectorDrawerOpen = useAppSelector(
    (s) => s.accountSelector.isMobileWalletSelectorDrawerOpen,
  );
  const { wallets } = useRuntimeWallets();

  const existsHardwareWallet = useMemo(
    () => wallets.some((w) => w.type === WALLET_TYPE_HW),
    [wallets],
  );

  const visible = isVertical
    ? isMobileWalletSelectorDrawerOpen
    : isDesktopWalletSelectorVisible;

  const visiblePrev = usePrevious(visible);
  const isOpenFromClose = !visiblePrev && visible;
  return {
    visible,
    isOpenFromClose,
    existsHardwareWallet,
  };
}

export { useWalletSelectorStatus };
