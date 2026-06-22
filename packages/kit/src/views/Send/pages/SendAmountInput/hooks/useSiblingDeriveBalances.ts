import { useCallback, useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { resolveSiblingBalanceParsed } from './siblingBalanceUtils';

export type ISiblingDeriveBalance = {
  accountId: string;
  account: INetworkAccount;
  deriveType: IAccountDeriveTypes;
  deriveInfo: IAccountDeriveInfo;
  balanceParsed: string;
  availableBalance: BigNumber;
};

export type ISiblingDeriveBalancesResult = {
  siblings: ISiblingDeriveBalance[];
  // True if any sibling's balance fetch failed. Lets callers tell a network
  // failure apart from "this deriveType genuinely has no funds".
  hadError: boolean;
};

const CACHE_TTL_MS = 30_000;

type ICache = {
  data: ISiblingDeriveBalance[];
  fetchedAt: number;
  key: string;
};

type IParams = {
  networkId: string;
  indexedAccountId: string;
  // Empty string for native tokens (e.g. BTC, where
  // vaultSettings.isNativeTokenContractAddressEmpty is true). Non-empty for
  // ERC20-style contracts.
  tokenAddress: string;
  // Global inscription-protection setting. Part of the spendable-balance
  // contract, so it must be both an input to the fetch and part of the cache
  // key — otherwise toggling it mid-flow keeps serving stale sibling balances.
  inscriptionProtection: boolean;
};

// Fetches the available balance of the same token under every other deriveType
// belonging to the same indexedAccount, so callers can offer "auto-switch to a
// derivetype that actually has funds" UX. Lazy on purpose: only call `fetch()`
// when there is a real reason (e.g. user typed an amount that exceeds the
// current account's balance), to avoid 4 RPC roundtrips per page load.
//
// **Balance contract**: uses `fetchTokensDetails({ withFrozenBalance,
// withCheckInscription })` — the *same* path SendAmountInputContainer uses
// for the current account's `maxBalance`. This is load-bearing: if siblings
// were fetched via the raw token-list API, frozen UTXOs or
// inscription-protected UTXOs would inflate sibling balance vs. what the
// current page would actually show after switching, causing the form to
// auto-switch to an account that still can't cover the amount.
export function useSiblingDeriveBalances({
  networkId,
  indexedAccountId,
  tokenAddress,
  inscriptionProtection,
}: IParams) {
  const cacheRef = useRef<ICache | null>(null);

  const cacheKey = `${networkId}|${indexedAccountId}|${tokenAddress}|${inscriptionProtection}`;

  const fetch = useCallback(async (): Promise<ISiblingDeriveBalancesResult> => {
    if (!networkId || !indexedAccountId) {
      return { siblings: [], hadError: false };
    }

    const cache = cacheRef.current;
    if (
      cache &&
      cache.key === cacheKey &&
      Date.now() - cache.fetchedAt < CACHE_TTL_MS
    ) {
      return { siblings: cache.data, hadError: false };
    }

    try {
      const { networkAccounts } =
        await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId,
            indexedAccountId,
            excludeEmptyAccount: true,
          },
        );

      const candidates = networkAccounts.filter((item) => item.account?.id);

      let hadError = false;
      const balances = await Promise.all(
        candidates.map(async (item) => {
          const account = item.account;
          if (!account) return null;
          try {
            const checkInscriptionProtectionEnabled =
              await backgroundApiProxy.serviceSetting.checkInscriptionProtectionEnabled(
                {
                  networkId,
                  accountId: account.id,
                },
              );
            const withCheckInscription =
              checkInscriptionProtectionEnabled && inscriptionProtection;

            const resp =
              await backgroundApiProxy.serviceToken.fetchTokensDetails({
                accountId: account.id,
                networkId,
                contractList: [tokenAddress],
                withFrozenBalance: true,
                withCheckInscription,
              });
            const detail = resp?.[0];
            // No detail = the account genuinely holds none of this token.
            // That is a real "0", not an error.
            if (!detail) return null;

            const balanceParsed = resolveSiblingBalanceParsed(detail);

            return {
              accountId: account.id,
              account,
              deriveType: item.deriveType,
              deriveInfo: item.deriveInfo,
              balanceParsed,
              availableBalance: new BigNumber(balanceParsed),
            } satisfies ISiblingDeriveBalance;
          } catch {
            // A failed fetch means this sibling's balance is unknown — flag
            // it so callers don't read the omission as "no funds".
            hadError = true;
            return null;
          }
        }),
      );

      const data = balances.filter(
        (b): b is ISiblingDeriveBalance => b !== null,
      );
      // Only cache a fully-successful result, so a degraded fetch is retried
      // on the next call instead of being frozen for the whole TTL.
      if (!hadError) {
        cacheRef.current = { data, fetchedAt: Date.now(), key: cacheKey };
      }
      return { siblings: data, hadError };
    } catch {
      return { siblings: [], hadError: true };
    }
  }, [
    cacheKey,
    networkId,
    indexedAccountId,
    tokenAddress,
    inscriptionProtection,
  ]);

  return { fetch };
}
