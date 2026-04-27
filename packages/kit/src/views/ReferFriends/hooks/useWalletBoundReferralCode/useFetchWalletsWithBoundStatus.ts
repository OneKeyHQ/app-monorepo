import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IBatchCheckWalletV2Item } from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

import { resolveBatchWalletBindStatus } from './referralBindStatusUtils';
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

    // Try V2 batch check first, fall back to V1
    let batchV2Result: Record<string, IBatchCheckWalletV2Item> = {};
    let isV1Fallback = false;
    let didFetchStatus = false;
    try {
      batchV2Result =
        await backgroundApiProxy.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2(
          batchCheckItems,
        );
      didFetchStatus = true;
    } catch {
      // V2 not available, fall back to V1
      try {
        const v1Result =
          await backgroundApiProxy.serviceReferralCode.batchCheckWalletsBoundReferralCode(
            batchCheckItems,
          );
        for (const [key, isBound] of Object.entries(v1Result)) {
          batchV2Result[key] = {
            bound: isBound,
            bindable: !isBound,
            reason: isBound ? 'already_bound' : undefined,
          };
        }
        isV1Fallback = true;
        didFetchStatus = true;
      } catch {
        // Keep local status unchanged when both status APIs are unavailable.
      }
    }

    // Build result and update local database
    const walletsWithBoundStatus = await Promise.all(
      walletsWithInfo.map(async (item) => {
        const key = buildWalletBoundKey(
          item.walletInfo.networkId,
          item.walletInfo.address,
        );
        const v2Item = batchV2Result[key];

        const existing =
          isV1Fallback || !didFetchStatus
            ? await backgroundApiProxy.serviceReferralCode.getWalletReferralCode(
                {
                  walletId: item.wallet.id,
                },
              )
            : undefined;

        if (!didFetchStatus) {
          return {
            wallet: item.wallet,
            isBound: existing?.isBound ?? false,
            bindable: existing?.bindable ?? !existing?.isBound,
            reason: existing?.bindWindowReason,
          };
        }

        const resolvedStatus = resolveBatchWalletBindStatus({
          batchStatus: v2Item,
          isV1Fallback,
          cachedBindable: existing?.bindable,
        });

        // Update local database
        await backgroundApiProxy.serviceReferralCode.setWalletReferralCode({
          walletId: item.wallet.id,
          referralCodeInfo: {
            walletId: item.wallet.id,
            address: item.walletInfo.address,
            networkId: item.walletInfo.networkId,
            pubkey: item.walletInfo.pubkey ?? '',
            isBound: resolvedStatus.isBound,
            bindable: resolvedStatus.bindable,
            bindWindowReason: resolvedStatus.bindWindowReason,
          },
        });

        return {
          wallet: item.wallet,
          isBound: resolvedStatus.isBound,
          bindable: resolvedStatus.bindable,
          reason: resolvedStatus.bindWindowReason,
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
