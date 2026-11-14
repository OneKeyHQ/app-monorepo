import { useCallback, useEffect } from 'react';

import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export function useCheckEthenaKycStatus({
  provider,
  refreshEarnDetailData,
}: {
  provider: string;
  refreshEarnDetailData: () => void;
}) {
  const { serviceAccount, serviceStaking } = backgroundApiProxy;
  const getAccountsForKyc = useCallback(
    async ({
      accountImpl,
      networkId,
    }: {
      accountImpl: string;
      networkId: string;
    }) => {
      const { accounts } = await serviceAccount.getAllAccounts();
      const evmAccounts = Array.from(
        new Set(
          accounts
            .filter((i) => !accountUtils.isWatchingAccount({ accountId: i.id }))
            .filter((i) => i.impl === accountImpl)
            .map((i) => i.address)
            .filter((address) => address && address.trim() !== ''),
        ),
      );
      return evmAccounts.map((address) => ({
        accountAddress: address,
        networkId,
      }));
    },
    [serviceAccount],
  );

  useEffect(() => {
    async function checkEthenaKycStatus() {
      const policy = getEarnProtocol(provider).getKycAccountScanPolicy();
      if (!policy || policy.kind !== 'ethena') {
        return;
      }

      const ethenaKycAddresses = await serviceStaking.getEthenaKycAddress();
      if (ethenaKycAddresses) {
        return;
      }

      const allEvmAccounts = await getAccountsForKyc(policy);
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
  }, [getAccountsForKyc, provider, serviceStaking, refreshEarnDetailData]);

  return null;
}
