import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import { useHomeWalletTabSupport } from '../../hooks/useHomeWalletTabSupport';

export function HomeCapabilityStoreController() {
  const {
    activeAccount: { network, vaultSettings },
  } = useActiveAccount({ num: 0 });
  useHomeWalletTabSupport({
    enableCapabilityAuthority: true,
    network,
    vaultSettings,
  });
  return null;
}
