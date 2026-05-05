import { useMemo } from 'react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

export function useEarnAccountKey() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { account, indexedAccount, network } = activeAccount;

  const allNetworkId = getNetworkIdsMap().onekeyall;

  const earnAccountKey = useMemo(
    () =>
      earnUtils.buildEarnAccountKey({
        accountId: account?.id,
        indexAccountId: indexedAccount?.id,
        networkId: network?.id || allNetworkId,
      }),
    [account?.id, indexedAccount?.id, network?.id, allNetworkId],
  );

  return earnAccountKey;
}
