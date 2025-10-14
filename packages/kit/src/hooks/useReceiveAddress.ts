import { useMemo } from 'react';

import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

export function useReceiveAddress({
  networkAccount,
  networkId,
}: {
  networkAccount: INetworkAccount | undefined;
  networkId: string;
}) {
  const [{ enableBTCFreshAddress }] = useSettingsPersistAtom();

  return useMemo(() => {
    if (enableBTCFreshAddress) {
      if (networkUtils.isBTCNetwork(networkId)) {
        return {
          receiveAddress:
            networkAccount?.addressDetail.receiveAddress ||
            networkAccount?.address ||
            '',
          receiveAddressPath: networkAccount?.addressDetail.receiveAddressPath,
        };
      }
    }
    return {
      receiveAddress: networkAccount?.address || '',
      receiveAddressPath: undefined,
    };
  }, [enableBTCFreshAddress, networkId, networkAccount]);
}
