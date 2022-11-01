import { useMemo } from 'react';

import { OnekeyNetwork } from '@onekeyhq/engine/src/presets/networkIds';
import { Network } from '@onekeyhq/engine/src/types/network';

import { useManageNetworks } from '../../../hooks';

const ethNetwokId = OnekeyNetwork.eth;

export function useDefaultNetWork() {
  const { enabledNetworks: networks } = useManageNetworks();
  return useMemo(() => {
    const ethNetWork = networks.find((n) => n.id === ethNetwokId);
    return ethNetWork as Network;
  }, [networks]);
}
