import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

type IDeFiEnabledState = {
  networkId?: string;
  isEnabled: boolean;
};

export function useIsDeFiEnabled(networkId?: string, shouldCheck = true) {
  const [state, setState] = useState<IDeFiEnabledState>({
    isEnabled: false,
  });

  useEffect(() => {
    let shouldIgnore = false;

    const checkIsDeFiEnabled = async () => {
      if (!shouldCheck) {
        return;
      }

      if (!networkId) {
        setState({ networkId, isEnabled: false });
        return;
      }

      if (networkUtils.isAllNetwork({ networkId })) {
        setState({ networkId, isEnabled: true });
        return;
      }

      setState({ networkId, isEnabled: false });

      try {
        const enabledNetworks =
          await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();
        if (!shouldIgnore) {
          setState({
            networkId,
            isEnabled: !!enabledNetworks[networkId],
          });
        }
      } catch {
        if (!shouldIgnore) {
          setState({ networkId, isEnabled: false });
        }
      }
    };

    void checkIsDeFiEnabled();

    return () => {
      shouldIgnore = true;
    };
  }, [networkId, shouldCheck]);

  if (!shouldCheck) {
    return false;
  }

  if (!networkId) {
    return false;
  }

  if (networkUtils.isAllNetwork({ networkId })) {
    return true;
  }

  return state.networkId === networkId ? state.isEnabled : false;
}
