import { useEffect, useRef } from 'react';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../components/AccountSelector/AccountSelectorProvider';
import { useActiveAccount } from '../states/jotai/contexts/accountSelector';

function HardwareService() {
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const isInitialized = useRef(false);

  useEffect(() => {
    if (
      accountUtils.isHwWallet({ walletId: wallet?.id }) &&
      !isInitialized.current
    ) {
      isInitialized.current = true;
      void backgroundApiProxy.serviceHardware.init();
    }
  }, [wallet?.id]);

  return null;
}

export function HardwareServiceProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <HardwareService />
    </AccountSelectorProviderMirror>
  );
}
