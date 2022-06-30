import { useEffect, useState } from 'react';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

function useNetwork({ networkId }: { networkId?: string }) {
  const [network, setNetwork] = useState<Network | undefined>();
  useEffect(() => {
    (async () => {
      if (!networkId) {
        return;
      }
      const result = await backgroundApiProxy.engine.getNetwork(networkId);
      setNetwork(result);
    })();
  }, [networkId]);
  return { network };
}

export { useNetwork };
