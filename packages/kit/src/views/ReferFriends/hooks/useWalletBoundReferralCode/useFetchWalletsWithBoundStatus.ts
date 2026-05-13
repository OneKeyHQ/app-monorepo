import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IBatchCheckWalletV2Item } from '@onekeyhq/shared/src/referralCode/type';
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

export type IWalletReferralBindListStatus =
  | 'bound'
  | 'bindable'
  | 'expired'
  | 'unknown';

export type IWalletWithReferralBindStatus = {
  wallet: IDBWallet;
  isBound: boolean;
  bindable?: boolean;
  reason?: string;
  status: IWalletReferralBindListStatus;
};

function getWalletReferralBindListStatus({
  isBound,
  bindable,
  reason,
}: {
  isBound: boolean;
  bindable?: boolean;
  reason?: string;
}): IWalletReferralBindListStatus {
  if (isBound) {
    return 'bound';
  }
  if (reason === 'exceeded_bind_window') {
    return 'expired';
  }
  if (bindable !== true) {
    return 'unknown';
  }
  return 'bindable';
}

function getNormalizedAddress({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}) {
  return (
    normalizeTokenContractAddress({
      networkId,
      contractAddress: address,
    }) || address
  );
}

export function useFetchWalletsWithBoundStatus() {
  const getReferralCodeWalletInfo = useGetReferralCodeWalletInfo();

  const fetchWalletsWithBoundStatus = useCallback(async () => {
    const { wallets } = await backgroundApiProxy.serviceAccount.getWallets({
      nestedHiddenWallets: false,
    });

    // Filter valid wallets (HD and hardware wallets)
    const baseValidWallets = wallets.filter(
      (w) =>
        (accountUtils.isHdWallet({ walletId: w.id }) ||
          accountUtils.isHwWallet({ walletId: w.id })) &&
        !accountUtils.isHwHiddenWallet({ wallet: w }),
    );

    // Exclude deactivated Bot Wallets — referral binding requires receiving
    // signed messages and is not allowed on deactivated wallets.
    const deactivationFlags = await Promise.all(
      baseValidWallets.map(async (w) => {
        if (!accountUtils.isBotWallet({ walletId: w.id })) {
          return false;
        }
        return backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
          walletId: w.id,
        });
      }),
    );
    const validWallets = baseValidWallets.filter(
      (_, index) => !deactivationFlags[index],
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
    const batchCheckItems = walletsWithInfo.map((item) => ({
      address: getNormalizedAddress(item.walletInfo),
      networkId: item.walletInfo.networkId,
    }));

    // The V2 API is authoritative because it carries both bound and bind-window status.
    let batchV2Result: Record<string, IBatchCheckWalletV2Item> = {};
    let didFetchStatus = false;
    try {
      batchV2Result =
        await backgroundApiProxy.serviceReferralCode.batchCheckWalletsBoundReferralCodeV2(
          batchCheckItems,
        );
      didFetchStatus = true;
    } catch {
      // Treat missing V2 status as unknown instead of using legacy local state.
    }

    // Build UI-only status; do not update local binding data here.
    const walletsWithBoundStatus = await Promise.all(
      walletsWithInfo.map(async (item) => {
        const normalizedAddress = getNormalizedAddress(item.walletInfo);
        const v2Item =
          batchV2Result[`${item.walletInfo.networkId}:${normalizedAddress}`];
        if (!didFetchStatus || !v2Item) {
          const fallbackStatus: IWalletWithReferralBindStatus = {
            wallet: item.wallet,
            isBound: false,
            status: 'unknown',
          };
          return fallbackStatus;
        }

        const isBound = Boolean(
          v2Item.bound || v2Item.reason === 'already_bound',
        );
        const isExpired = v2Item.reason === 'exceeded_bind_window';
        const bindable = !isBound && !isExpired;
        const bindWindowReason = isBound ? undefined : v2Item.reason;

        const itemResult: IWalletWithReferralBindStatus = {
          wallet: item.wallet,
          isBound,
          bindable,
          reason: bindWindowReason,
          status: getWalletReferralBindListStatus({
            isBound,
            bindable,
            reason: bindWindowReason,
          }),
        };
        return itemResult;
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
