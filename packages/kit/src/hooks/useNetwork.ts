/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from 'react';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { useAppSelector } from './redux';

function useNetwork({ networkId }: { networkId?: string }) {
  if (networkId === 'all') {
    debugger;
  }
  const networkInRedux = useAppSelector((s) =>
    s.runtime.networks?.find((n) => n.id === networkId),
  );
  const [networkInDb, setNetworkInDb] = useState<Network | undefined>(
    networkInRedux,
  );
  useEffect(() => {
    (async () => {
      if (!networkId) {
        return;
      }
      if (networkInRedux) {
        return;
      }
      const result = await backgroundApiProxy.engine.getNetwork(networkId);
      setNetworkInDb(result);
    })();
  }, [networkId, networkInRedux]);
  return { network: networkInRedux ?? networkInDb };
}

export { useNetwork };
