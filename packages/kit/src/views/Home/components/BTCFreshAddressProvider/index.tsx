import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

export function BTCFreshAddressProvider() {
  const {
    activeAccount: { network, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const previousIndexedAccountId = usePrevious(indexedAccount?.id);

  useEffect(() => {
    if (!indexedAccount?.id) {
      return;
    }
    if (network?.id) {
      void backgroundApiProxy.serviceAccountProfile.syncBTCFreshAddressByIndexedAccountId(
        {
          indexedAccountId: indexedAccount.id,
          networkId: network.id,
        },
      );
    }
  }, [indexedAccount?.id, previousIndexedAccountId, network?.id]);

  return null;
}
