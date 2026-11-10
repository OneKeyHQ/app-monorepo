import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { IMarketTokenDetailRouteParams } from '@onekeyhq/shared/src/routes';

import { buildMarketTokenDetailPreview } from '../utils/marketDetailPreview';
import { resolveMarketTopCoinNavigationTarget } from '../utils/resolveMarketTopCoinNavigationTarget';

type IPendingAssetParams = Partial<IMarketTokenDetailRouteParams>;

export function usePendingMarketAsset({
  params,
  setParams,
}: {
  params: IPendingAssetParams;
  setParams: (params: IPendingAssetParams) => void;
}) {
  const { pendingMarketAsset, marketTokenId, network, tokenAddress, isNative } =
    params;
  const lookup = useMemo(
    () =>
      pendingMarketAsset && marketTokenId
        ? { assetId: marketTokenId, network, tokenAddress, isNative }
        : undefined,
    [pendingMarketAsset, marketTokenId, network, tokenAddress, isNative],
  );
  const currentLookupRef = useRef(lookup);
  currentLookupRef.current = lookup;
  const [failedLookup, setFailedLookup] = useState<typeof lookup>();
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setFailedLookup(undefined);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!lookup) return;
    let cancelled = false;
    const preferredToken =
      lookup.network && (lookup.tokenAddress || lookup.isNative)
        ? {
            networkId: lookup.network,
            tokenAddress: lookup.tokenAddress ?? '',
            isNative: lookup.isNative,
          }
        : undefined;
    const isCurrent = () => !cancelled && currentLookupRef.current === lookup;
    void resolveMarketTopCoinNavigationTarget({
      assetId: lookup.assetId,
      preferredToken,
    })
      .then((token) => {
        if (!isCurrent()) return;
        if (token) {
          setParams({
            pendingMarketAsset: undefined,
            network: token.networkId,
            tokenAddress: token.tokenAddress,
            isNative: token.isNative,
            marketTokenId: token.marketTokenId,
            marketVariantId: token.marketVariantId,
            legacyTokenPreview: buildMarketTokenDetailPreview(token),
          });
        } else if (preferredToken) {
          setParams({
            pendingMarketAsset: undefined,
            marketTokenId: undefined,
            marketVariantId: undefined,
            marketTokenCategory: undefined,
          });
        } else {
          setFailedLookup(lookup);
        }
      })
      .catch(() => {
        if (isCurrent()) setFailedLookup(lookup);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, lookup, setParams]);

  return {
    isResolving: Boolean(lookup),
    retry: lookup && failedLookup === lookup ? retry : undefined,
  };
}
