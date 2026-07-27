import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { sortTokensByOrder } from '@onekeyhq/shared/src/utils/tokenUtils';
import { isValidNumberValue } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type {
  IAccountToken,
  IFetchTokenDetailItem,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { useTokenDetailsContext } from './TokenDetailsContext';

export type IAggregateTokenDetailsRow = {
  token: IAccountToken;
  tokenDetail?: IFetchTokenDetailItem;
};

type IAggregateTokenDetailsEntry = IAggregateTokenDetailsRow & {
  fiatValueBN: BigNumber;
};

// Aggregate-token member rows sorted the same way the tab list and the network
// dropdown sort them: fiat value descending, then zero-balance members, then
// members with no data yet (no address / disabled network), the latter two
// groups falling back to the server-config order. Details are read from the
// TokenDetails context (live per-tab fetches) and seeded from the route
// `tokenMap` snapshot so rows render on first paint.
export function useAggregateTokenDetails({
  tokens,
  tokenMap,
}: {
  tokens: IAccountToken[];
  tokenMap?: Record<string, ITokenFiat>;
}) {
  const { tokenDetails, tokenAccountMap } = useTokenDetailsContext();

  return useMemo(() => {
    const getDetail = (
      token: IAccountToken,
    ): IFetchTokenDetailItem | undefined => {
      const detailKey = `${
        token.accountId ||
        tokenAccountMap[`${token.networkId || ''}_${token.address}`] ||
        ''
      }_${token.networkId || ''}`;
      const contextDetail = tokenDetails[detailKey]?.data;
      if (contextDetail) {
        return contextDetail;
      }
      const seed = tokenMap?.[token.$key];
      if (seed) {
        return {
          info: token,
          ...seed,
        };
      }
      return undefined;
    };

    // Decorate once — one detail lookup + BigNumber per member — then sort and
    // partition over the precomputed values.
    const entries: IAggregateTokenDetailsEntry[] = tokens.map((token) => {
      const tokenDetail = getDetail(token);
      const fiatValue = new BigNumber(tokenDetail?.fiatValue ?? -1);
      return {
        token,
        tokenDetail,
        fiatValueBN: fiatValue.isNaN() ? new BigNumber(-1) : fiatValue,
      };
    });

    let sortedEntries = entries.toSorted((a, b) =>
      b.fiatValueBN.comparedTo(a.fiatValueBN),
    );

    const negativeIndex = sortedEntries.findIndex((entry) =>
      entry.fiatValueBN.isNegative(),
    );
    const zeroIndex = sortedEntries.findIndex((entry) =>
      entry.fiatValueBN.isZero(),
    );

    if (negativeIndex > -1 || zeroIndex > -1) {
      let entriesWithNonZeroBalance: IAggregateTokenDetailsEntry[] = [];
      let entriesWithZeroBalance: IAggregateTokenDetailsEntry[] = [];
      let entriesWithoutBalance: IAggregateTokenDetailsEntry[] = [];

      if (negativeIndex > -1) {
        const entriesWithBalance = sortedEntries.slice(0, negativeIndex);
        entriesWithoutBalance = sortedEntries.slice(negativeIndex);
        if (zeroIndex > -1) {
          entriesWithNonZeroBalance = entriesWithBalance.slice(0, zeroIndex);
          entriesWithZeroBalance = entriesWithBalance.slice(zeroIndex);
        } else {
          entriesWithNonZeroBalance = entriesWithBalance;
        }
      } else if (zeroIndex > -1) {
        entriesWithNonZeroBalance = sortedEntries.slice(0, zeroIndex);
        entriesWithZeroBalance = sortedEntries.slice(zeroIndex);
      }

      const reorderByConfig = (group: IAggregateTokenDetailsEntry[]) => {
        const entryByKey = new Map(
          group.map((entry) => [entry.token.$key, entry]),
        );
        return sortTokensByOrder({
          tokens: group.map((entry) => entry.token),
        }).flatMap((token) => {
          const entry = entryByKey.get(token.$key);
          return entry ? [entry] : [];
        });
      };

      sortedEntries = [
        ...entriesWithNonZeroBalance,
        ...reorderByConfig(entriesWithZeroBalance),
        ...reorderByConfig(entriesWithoutBalance),
      ];
    }

    const rows: IAggregateTokenDetailsRow[] = sortedEntries.map(
      ({ token, tokenDetail }) => ({ token, tokenDetail }),
    );

    let totalFiatValue = new BigNumber(0);
    let totalBalance = new BigNumber(0);
    let hasFiatValue = false;
    let hasBalanceData = false;
    let currency: string | undefined;

    for (const { tokenDetail } of sortedEntries) {
      if (tokenDetail) {
        hasBalanceData = true;
        if (isValidNumberValue(tokenDetail.fiatValue)) {
          totalFiatValue = totalFiatValue.plus(tokenDetail.fiatValue);
          hasFiatValue = true;
        }
        if (isValidNumberValue(tokenDetail.balanceParsed)) {
          totalBalance = totalBalance.plus(tokenDetail.balanceParsed);
        }
        if (!currency && tokenDetail.currency) {
          currency = tokenDetail.currency;
        }
      }
    }

    return {
      rows,
      totalFiatValueBN: hasFiatValue ? totalFiatValue : undefined,
      totalFiatValue: hasFiatValue ? totalFiatValue.toFixed() : undefined,
      totalBalanceParsed: hasBalanceData ? totalBalance.toFixed() : undefined,
      currency,
      hasBalanceData,
    };
  }, [tokens, tokenMap, tokenDetails, tokenAccountMap]);
}
