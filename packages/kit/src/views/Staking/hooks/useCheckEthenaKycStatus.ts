import { useCallback, useEffect } from 'react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function useCheckEthenaKycStatus({
  provider,
  refreshEarnDetailData,
}: {
  provider: string;
  refreshEarnDetailData: () => void;
}) {
  const { serviceAccount, serviceStaking } = backgroundApiProxy;
  const getAllEvmAccounts = useCallback(async () => {
    const { accounts } = await serviceAccount.getAllAccounts();
    const evmAccounts = Array.from(
      new Set(
        accounts
          .filter((i) => !accountUtils.isWatchingAccount({ accountId: i.id }))
          .filter((i) => i.impl === IMPL_EVM)
          .map((i) => i.address)
          .filter((address) => address && address.trim() !== ''),
      ),
    );
    return evmAccounts.map((address) => ({
      accountAddress: address,
      networkId: getNetworkIdsMap().eth,
    }));
  }, [serviceAccount]);

  useEffect(() => {
    async function checkEthenaKycStatus() {
      if (!earnUtils.isEthenaProvider({ providerName: provider })) {
        return;
      }

      const ethenaKycAddresses = await serviceStaking.getEthenaKycAddress();
      if (ethenaKycAddresses) {
        return;
      }

      const allEvmAccounts = await getAllEvmAccounts();
      const result = await serviceStaking.checkEthenaKycStatusByAccounts({
        accounts: allEvmAccounts,
      });
      if (result) {
        setTimeout(() => {
          void refreshEarnDetailData();
        }, 500);
      }
    }

    void checkEthenaKycStatus();
  }, [getAllEvmAccounts, provider, serviceStaking, refreshEarnDetailData]);

  return null;
}
