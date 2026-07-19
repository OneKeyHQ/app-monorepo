import { useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import type { ICurrencyItem } from '@onekeyhq/shared/types';

import { convertFiat } from '../../utils/fiatConvert';

import type { INativeHomeBalanceAuthorityStatus } from './nativeHomeBalanceAuthority';

interface INativeHomeAmountSourceAuthority {
  included: boolean;
  scopeKey: string | undefined;
  status: INativeHomeBalanceAuthorityStatus;
}

interface INativeHomeBalanceAmountPresentation {
  status: 'confirmed' | 'final' | 'loading';
  valueUsd: string | undefined;
}

interface INativeHomeBalanceAmountCommit {
  ownerKey: string;
  scopeKey: string;
  valueUsd: string;
}

interface INativeHomeConfirmedBalanceCache {
  byOwner: Record<string, string>;
  currency?: string;
  latest: string;
}

interface IResolveNativeHomeBalanceAmountPresentationOptions {
  confirmedValueUsd: string | undefined;
  deFi: INativeHomeAmountSourceAuthority;
  liveValueUsd: string;
  ownerKey: string;
  perps: INativeHomeAmountSourceAuthority;
  portfolio: INativeHomeAmountSourceAuthority;
  scopeKey: string | undefined;
}

function isCurrentIncludedSourceReady({
  source,
  scopeKey,
}: {
  source: INativeHomeAmountSourceAuthority;
  scopeKey: string;
}): boolean {
  return (
    !source.included ||
    (source.scopeKey === scopeKey && source.status === 'success')
  );
}

function convertNativeHomeConfirmedBalanceToUsd({
  confirmedCurrency,
  confirmedValue,
  currencyMap,
  displayCurrency,
}: {
  confirmedCurrency: string | undefined;
  confirmedValue: string | undefined;
  currencyMap: Record<string, ICurrencyItem>;
  displayCurrency: string;
}) {
  if (
    confirmedValue === undefined ||
    !new BigNumber(confirmedValue).isFinite()
  ) {
    return undefined;
  }
  return convertFiat({
    value: confirmedValue,
    sourceCurrency: confirmedCurrency ?? displayCurrency,
    targetCurrency: USD_CURRENCY_ID,
    currencyMap,
  });
}

function convertNativeHomeBalanceUsdToDisplay({
  currencyMap,
  displayCurrency,
  valueUsd,
}: {
  currencyMap: Record<string, ICurrencyItem>;
  displayCurrency: string;
  valueUsd: string | undefined;
}) {
  return valueUsd === undefined
    ? undefined
    : convertFiat({
        value: valueUsd,
        sourceCurrency: USD_CURRENCY_ID,
        targetCurrency: displayCurrency,
        currencyMap,
      });
}

function applyNativeHomeBalanceAmountCommit(
  previous: INativeHomeConfirmedBalanceCache,
  commit: Pick<INativeHomeBalanceAmountCommit, 'ownerKey' | 'valueUsd'>,
  {
    currencyMap,
    displayCurrency,
  }: {
    currencyMap: Record<string, ICurrencyItem>;
    displayCurrency: string;
  },
): INativeHomeConfirmedBalanceCache {
  const sourceCurrency = previous.currency ?? displayCurrency;
  const normalizedByOwner = Object.fromEntries(
    Object.entries(previous.byOwner).map(([ownerKey, value]) => [
      ownerKey,
      new BigNumber(value).isFinite()
        ? convertFiat({
            value,
            sourceCurrency,
            targetCurrency: USD_CURRENCY_ID,
            currencyMap,
          })
        : value,
    ]),
  );
  return {
    latest: commit.valueUsd,
    byOwner: {
      ...normalizedByOwner,
      [commit.ownerKey]: commit.valueUsd,
    },
    currency: USD_CURRENCY_ID,
  };
}

function resolveNativeHomeBalanceAmountPresentation({
  confirmedValueUsd,
  deFi,
  liveValueUsd,
  ownerKey,
  perps,
  portfolio,
  scopeKey,
}: IResolveNativeHomeBalanceAmountPresentationOptions): {
  commit: INativeHomeBalanceAmountCommit | undefined;
  presentation: INativeHomeBalanceAmountPresentation;
} {
  const isFullyReady = Boolean(
    ownerKey &&
    scopeKey &&
    isCurrentIncludedSourceReady({ source: portfolio, scopeKey }) &&
    isCurrentIncludedSourceReady({ source: deFi, scopeKey }) &&
    isCurrentIncludedSourceReady({ source: perps, scopeKey }),
  );
  if (isFullyReady && scopeKey) {
    return {
      commit: { ownerKey, scopeKey, valueUsd: liveValueUsd },
      presentation: { status: 'final', valueUsd: liveValueUsd },
    };
  }
  if (confirmedValueUsd !== undefined) {
    return {
      commit: undefined,
      presentation: { status: 'confirmed', valueUsd: confirmedValueUsd },
    };
  }
  return {
    commit: undefined,
    presentation: { status: 'loading', valueUsd: undefined },
  };
}

function useNativeHomeBalanceAmountPresentation({
  onCommit,
  ...options
}: IResolveNativeHomeBalanceAmountPresentationOptions & {
  onCommit: (commit: INativeHomeBalanceAmountCommit) => void;
}): INativeHomeBalanceAmountPresentation {
  const currentOwnerRef = useRef({
    ownerKey: options.ownerKey,
    scopeKey: options.scopeKey,
  });
  currentOwnerRef.current = {
    ownerKey: options.ownerKey,
    scopeKey: options.scopeKey,
  };
  const lastCommitRef = useRef<INativeHomeBalanceAmountCommit | undefined>(
    undefined,
  );
  const resolution = resolveNativeHomeBalanceAmountPresentation(options);
  useEffect(() => {
    const commit = resolution.commit;
    if (
      !commit ||
      currentOwnerRef.current.ownerKey !== commit.ownerKey ||
      currentOwnerRef.current.scopeKey !== commit.scopeKey
    ) {
      return;
    }
    const previous = lastCommitRef.current;
    if (
      previous?.ownerKey === commit.ownerKey &&
      previous.scopeKey === commit.scopeKey &&
      previous.valueUsd === commit.valueUsd
    ) {
      return;
    }
    lastCommitRef.current = commit;
    onCommit(commit);
  }, [onCommit, resolution.commit]);
  return resolution.presentation;
}

export {
  applyNativeHomeBalanceAmountCommit,
  convertNativeHomeBalanceUsdToDisplay,
  convertNativeHomeConfirmedBalanceToUsd,
  resolveNativeHomeBalanceAmountPresentation,
  useNativeHomeBalanceAmountPresentation,
};
export type {
  INativeHomeAmountSourceAuthority,
  INativeHomeBalanceAmountCommit,
  INativeHomeBalanceAmountPresentation,
  INativeHomeConfirmedBalanceCache,
  IResolveNativeHomeBalanceAmountPresentationOptions,
};
