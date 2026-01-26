import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  FIRST_BTC_TAPROOT_ADDRESS_PATH,
  FIRST_EVM_ADDRESS_PATH,
} from '@onekeyhq/shared/src/engine/engineConsts';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { IReferralCodeWalletInfo } from './types';

export function useGetReferralCodeWalletInfo() {
  return useCallback(
    async (
      queryWalletId: string | undefined,
    ): Promise<IReferralCodeWalletInfo | null> => {
      if (!queryWalletId) {
        return null;
      }

      const walletId = queryWalletId;
      let wallet: IDBWallet | undefined;

      if (
        !accountUtils.isHdWallet({ walletId }) &&
        !accountUtils.isHwWallet({ walletId })
      ) {
        return null;
      }

      try {
        wallet = await backgroundApiProxy.serviceAccount.getWallet({
          walletId,
        });
        if (accountUtils.isHwHiddenWallet({ wallet })) {
          return null;
        }
      } catch {
        return null;
      }

      const isBtcOnlyWallet =
        await backgroundApiProxy.serviceHardware.isBtcOnlyWallet({ walletId });

      if (isBtcOnlyWallet) {
        const firstBtcTaprootAccountId = `${walletId}--${FIRST_BTC_TAPROOT_ADDRESS_PATH}`;
        try {
          const networkId = getNetworkIdsMap().btc;
          const account = await backgroundApiProxy.serviceAccount.getAccount({
            accountId: firstBtcTaprootAccountId,
            networkId,
          });
          if (!account) {
            return null;
          }
          return {
            wallet,
            walletId,
            networkId,
            accountId: firstBtcTaprootAccountId,
            address: account.address,
            pubkey: account.pub,
            isBtcOnlyWallet,
          };
        } catch {
          return null;
        }
      }

      // get first evm account, if btc only firmware, get first btc taproot account
      const firstEvmAccountId = `${walletId}--${FIRST_EVM_ADDRESS_PATH}`;
      try {
        const networkId = getNetworkIdsMap().eth;
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId: firstEvmAccountId,
          networkId,
        });
        if (!account) {
          return null;
        }
        return {
          wallet,
          walletId,
          networkId,
          accountId: firstEvmAccountId,
          address: account.address,
          pubkey: account.pub,
          isBtcOnlyWallet,
        };
      } catch {
        return null;
      }
    },
    [],
  );
}
