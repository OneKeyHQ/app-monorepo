import { useMemo } from 'react';

import type { IServerNetwork } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useAccountSelectorContextData } from '../../../states/jotai/contexts/accountSelector';

export function useAccountSelectorAvailableNetworks(): IServerNetwork[] {
  const { serviceNetwork } = backgroundApiProxy;
  const { config } = useAccountSelectorContextData();

  const allNetworksRes = usePromiseResult(
    () => serviceNetwork.getAllNetworks(),
    [serviceNetwork],
  );
  const data = useMemo(
    () => config?.networks || allNetworksRes.result?.networks || [],
    [allNetworksRes.result?.networks, config?.networks],
  );
  return data;
}
