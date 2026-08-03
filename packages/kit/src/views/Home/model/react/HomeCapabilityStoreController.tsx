import { useEffect } from 'react';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import { useHomeWalletTabSupport } from '../../hooks/useHomeWalletTabSupport';

import { useHomeStoreSourcePublisher } from './useHomeStoreSourcePublisher';

export function HomeCapabilityStoreController() {
  const {
    activeAccount: { network, vaultSettings },
  } = useActiveAccount({ num: 0 });
  const facts = useHomeWalletTabSupport({
    network,
    vaultSettings,
  });
  const { publishHomeCapabilitySource } = useHomeStoreSourcePublisher();

  useEffect(() => {
    if (facts) {
      publishHomeCapabilitySource({ facts });
    }
  }, [facts, publishHomeCapabilitySource]);

  return null;
}
