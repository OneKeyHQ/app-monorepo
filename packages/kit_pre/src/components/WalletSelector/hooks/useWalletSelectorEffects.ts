import { useEffect } from 'react';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { deviceUtils } from '../../../utils/hardware';

import { useWalletSelectorStatus } from './useWalletSelectorStatus';

function useWalletSelectorEffects() {
  const { visible, existsHardwareWallet } = useWalletSelectorStatus();

  useEffect(() => {
    debugLogger.accountSelector.info('WalletSelectorTrigger mount');
    return () => {
      debugLogger.accountSelector.info('WalletSelectorTrigger unmounted');
    };
  }, []);

  useEffect(() => {
    debugLogger.accountSelector.info(
      `WalletSelector visible=${visible.toString()}`,
    );
    if (visible && existsHardwareWallet) {
      // open wallet selector refresh device connect status
      deviceUtils.syncDeviceConnectStatus();
    }
  }, [existsHardwareWallet, visible]);
}

export function WalletSelectorEffectsSingleton() {
  useWalletSelectorEffects();
  return null;
}

export { useWalletSelectorEffects };
