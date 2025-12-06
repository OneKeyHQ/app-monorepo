import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

import { useGetReferralCodeWalletInfo } from './useGetReferralCodeWalletInfo';

import type { IReferralCodeWalletInfo } from './types';

type IWalletWithWalletInfo = {
  wallet: IDBWallet;
  walletInfo: IReferralCodeWalletInfo | null;
};

type IWalletWithValidInfo = {
  wallet: IDBWallet;
  walletInfo: IReferralCodeWalletInfo;
};

function buildWalletBoundKey(networkId: string, address: string): string {
  const normalizedAddress =
    normalizeTokenContractAddress({
      networkId,
      contractAddress: address,
    }) || address;
  return `${networkId}:${normalizedAddress}`;
}

export function useFetchWalletsWithBoundStatus() {
  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();

  const fetchWalletsWithBoundStatus = useCallback(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
      nestedHiddenWallets: false,
    });

    // Filter valid wallets (HD and hardware wallets)
    const validWallets = wallets.filter(
      (w) =>
        (accountUtils.isHdWallet({ walletId: w.id }) ||
          accountUtils.isHwWallet({ walletId: w.id })) &&
        !accountUtils.isHwHiddenWallet({ wallet: w }),
    );

    // Early return if no valid wallets
    if (validWallets.length === 0) {
      return [];
    }

    // Get wallet info for each valid wallet
    const walletInfos: IWalletWithWalletInfo[] = await Promise.all(
      validWallets.map(async (w) => {
        const info = await getReferralCodeWalletInfo(w.id);
        return { wallet: w, walletInfo: info };
      }),
    );

    // Filter wallets with valid info
    const walletsWithInfo = walletInfos.filter(
      (item): item is IWalletWithValidInfo => item.walletInfo !== null,
    );

    if (walletsWithInfo.length === 0) {
      return [];
    }

    // Build batch check items with normalized addresses
    const batchCheckItems = walletsWithInfo.map((item) => {
      const { networkId, address } = item.walletInfo;
      return {
        address:
          normalizeTokenContractAddress({
            networkId,
            contractAddress: address,
          }) || address,
        networkId,
      };
    });

    // Batch check all wallets' bound status via API
    let batchResult: Record<string, boolean> = {};
    try {
      batchResult =
        await backgroundApiProxy.serviceReferralCode.batchCheckWalletsBoundReferralCode(
          batchCheckItems,
        );
      console.log(
        '===>>> batchCheckWalletsBoundReferralCode result:',
        batchResult,
      );
    } catch (error) {
      console.log(
        '===>>> batchCheckWalletsBoundReferralCode error, treating all as not bound:',
        error,
      );
    }

    // Build result and update local database
    const walletsWithBoundStatus = await Promise.all(
      walletsWithInfo.map(async (item) => {
        const key = buildWalletBoundKey(
          item.walletInfo.networkId,
          item.walletInfo.address,
        );
        const isBound = batchResult[key] ?? false;

        // Update local database
        await backgroundApiProxy.serviceReferralCode.setWalletReferralCode({
          walletId: item.wallet.id,
          referralCodeInfo: {
            walletId: item.wallet.id,
            address: item.walletInfo.address,
            networkId: item.walletInfo.networkId,
            pubkey: item.walletInfo.pubkey ?? '',
            isBound,
          },
        });

        return {
          wallet: item.wallet,
          isBound,
        };
      }),
    );

    return walletsWithBoundStatus;
  }, [getReferralCodeWalletInfo]);

  const { result: walletsWithStatus, isLoading } = usePromiseResult(
    fetchWalletsWithBoundStatus,
    [fetchWalletsWithBoundStatus],
  );

  return {
    walletsWithStatus,
    isLoading,
  };
}
