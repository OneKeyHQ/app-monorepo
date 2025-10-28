import { useEffect, useRef } from 'react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';

/**
 * Auto-switch to All Networks when switching from external wallet to hardware or QR wallet on Web DApp platform
 * This hook monitors wallet changes and automatically switches to "All Networks" (onekeyall)
 * when switching from an external wallet (third-party wallet) to a hardware wallet or QR wallet.
 *
 * Features:
 * - Only active on Web DApp platform (platformEnv.isWebDappMode)
 * - Triggers when: previous wallet is external AND current wallet is hw/qr
 * - Allows users to manually switch networks within the same HW/QR wallet
 * - Silent switch with no user notification
 * - Skips if already on All Networks to avoid redundant updates
 */
export function useAutoSwitchNetworkForHwQrWallet({ num }: { num: number }) {
  const { activeAccount } = useActiveAccount({ num });
  const [isReady] = useAccountSelectorStorageReadyAtom();
  const actions = useAccountSelectorActions();

  // Track previous wallet ID to detect wallet switches
  // Initialize with current wallet ID to prevent triggering on first render
  const previousWalletIdRef = useRef<string | undefined>(
    activeAccount.wallet?.id,
  );

  useEffect(() => {
    // Only execute on Web DApp platform
    if (!platformEnv.isWebDappMode) {
      return;
    }

    // Wait for storage initialization
    if (!isReady) {
      return;
    }

    const currentWalletId = activeAccount.wallet?.id;
    const previousWalletId = previousWalletIdRef.current;

    // Check if wallet has actually changed
    const walletChanged = previousWalletId !== currentWalletId;

    // Update previous wallet ID for next comparison
    previousWalletIdRef.current = currentWalletId;

    // Exit if wallet hasn't changed (user is just switching networks in same wallet)
    if (!walletChanged) {
      return;
    }

    // Check if previous wallet was an external wallet
    const wasPreviousExternal = accountUtils.isExternalWallet({
      walletId: previousWalletId,
    });

    // Exit if previous wallet was not external
    if (!wasPreviousExternal) {
      return;
    }

    // Check if current wallet is hardware or QR wallet
    const isCurrentHwQr = accountUtils.isHwOrQrWallet({
      walletId: currentWalletId,
    });

    // Exit if current wallet is not hw/qr
    if (!isCurrentHwQr) {
      return;
    }

    // Check if current network is already All Networks
    const isCurrentlyAllNetwork = networkUtils.isAllNetwork({
      networkId: activeAccount.network?.id,
    });

    // Skip if already on All Networks to avoid redundant updates
    if (isCurrentlyAllNetwork) {
      return;
    }

    // Auto-switch to All Networks when switching from external to hw/qr
    void actions.current.updateSelectedAccountNetwork({
      num,
      networkId: getNetworkIdsMap().onekeyall,
    });
  }, [
    activeAccount.wallet?.id,
    activeAccount.network?.id,
    isReady,
    actions,
    num,
  ]);
}
