import { useCallback, useRef } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IFetchAccountTokensResp,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

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
const FETCH_FLAG = 'send-auto-switch-derive';

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
};

function pickBalanceForToken({
  resp,
  tokenAddress,
}: {
  resp: IFetchAccountTokensResp;
  tokenAddress: string;
}): ITokenFiat | null {
  const buckets = [resp.allTokens, resp.tokens, resp.smallBalanceTokens].filter(
    (b): b is ITokenData => Boolean(b),
  );

  const wantNative = tokenAddress === '';

  for (const bucket of buckets) {
    const matching = bucket.data.find((t) =>
      wantNative ? t.isNative === true : t.address === tokenAddress,
    );
    if (matching) {
      const fiat = bucket.map[matching.$key];
      if (fiat) return fiat;
    }
  }
  return null;
}

// Fetches the available balance of the same token under every other deriveType
// belonging to the same indexedAccount, so callers can offer "auto-switch to a
// derivetype that actually has funds" UX. Lazy on purpose: only call `fetch()`
// when there is a real reason (e.g. user typed an amount that exceeds the
// current account's balance), to avoid 4 RPC roundtrips per page load.
export function useSiblingDeriveBalances({
  networkId,
  indexedAccountId,
  tokenAddress,
}: IParams) {
  const cacheRef = useRef<ICache | null>(null);

  const cacheKey = `${networkId}|${indexedAccountId}|${tokenAddress}`;

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
            const resp =
              await backgroundApiProxy.serviceToken.fetchAccountTokens({
                accountId: account.id,
                networkId,
                indexedAccountId,
                flag: FETCH_FLAG,
              });
            const fiat = pickBalanceForToken({ resp, tokenAddress });
            // No entry for this token = the account genuinely holds none of
            // it. That is a real "0", not an error.
            if (!fiat) return null;

            const balanceParsed = fiat.balanceParsed ?? '0';

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
  }, [cacheKey, networkId, indexedAccountId, tokenAddress]);

  return { fetch };
}
