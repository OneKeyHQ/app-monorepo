import { useEffect } from 'react';

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
 * Auto-switch to All Networks when hardware or QR wallet is selected on Web DApp platform
 * This hook monitors wallet changes and automatically switches to "All Networks" (onekeyall)
 * when a hardware wallet or QR wallet is detected.
 *
 * Features:
 * - Only active on Web DApp platform (platformEnv.isWebDappMode)
 * - Triggers on every hardware/QR wallet switch
 * - Silent switch with no user notification
 * - Skips if already on All Networks to avoid redundant updates
 */
export function useAutoSwitchNetworkForHwQrWallet({ num }: { num: number }) {
  const { activeAccount } = useActiveAccount({ num });
  const [isReady] = useAccountSelectorStorageReadyAtom();
  const actions = useAccountSelectorActions();

  useEffect(() => {
    void (async () => {
      // Only execute on Web DApp platform
      if (!platformEnv.isWebDappMode) {
        return;
      }

      // Wait for storage initialization
      if (!isReady) {
        return;
      }

      // Check if current wallet is hardware or QR wallet
      const isHwOrQr = accountUtils.isHwOrQrWallet({
        walletId: activeAccount.wallet?.id,
      });

      // Exit if not hardware/QR wallet
      if (!isHwOrQr) {
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

      // Auto-switch to All Networks
      await actions.current.updateSelectedAccountNetwork({
        num,
        networkId: getNetworkIdsMap().onekeyall,
      });
    })();
  }, [
    activeAccount.wallet?.id,
    activeAccount.network?.id,
    isReady,
    actions,
    num,
  ]);
}
