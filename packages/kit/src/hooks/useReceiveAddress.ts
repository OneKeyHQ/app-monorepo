import { useMemo } from 'react';

import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { usePromiseResult } from './usePromiseResult';

export function useReceiveAddress({
  networkAccount,
  allNetworkAccountInfo,
  networkId,
}: {
  networkAccount: INetworkAccount | undefined;
  allNetworkAccountInfo: IAllNetworkAccountInfo | undefined;
  networkId: string;
}) {
  const [{ enableBTCFreshAddress }] = useSettingsPersistAtom();

  const { result } = usePromiseResult(
    async () => {
      if (!networkUtils.isBTCNetwork(networkId) || !enableBTCFreshAddress) {
        if (networkAccount) {
          return {
            receiveAddress: networkAccount.address || '',
            receiveAddressPath: undefined,
          };
        }
        if (allNetworkAccountInfo) {
          return {
            receiveAddress: allNetworkAccountInfo.apiAddress || '',
            receiveAddressPath: undefined,
          };
        }
      }

      return backgroundApiProxy.serviceAccount.getReceiveAddress({
        networkAccount,
        allNetworkAccountInfo,
        networkId,
      });
    },
    [enableBTCFreshAddress, networkAccount, allNetworkAccountInfo, networkId],
    {
      initResult: {
        receiveAddress: '',
        receiveAddressPath: undefined,
      },
    },
  );

  return result;
}
