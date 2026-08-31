import { useEffect, useRef, useState } from 'react';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

export interface IMarketTradingViewSymbolIdentity {
  symbol: string;
  tokenAddress: string;
  networkId: string;
  decimal: number;
  initialHyperLiquidPriceScale?: number;
}

export function buildMarketTradingViewIdentityKey({
  symbol,
  tokenAddress,
  networkId,
  decimal,
}: IMarketTradingViewSymbolIdentity) {
  const normalizedTokenAddress =
    normalizeTokenContractAddress({
      networkId,
      contractAddress: tokenAddress.trim(),
    }) ?? '';
  return `${networkId}:${normalizedTokenAddress}:${symbol}:${decimal}`;
}

export function useMarketTradingViewFrameIdentity({
  staticTradingViewUrl,
  identity,
  symbolSyncSupport,
}: {
  staticTradingViewUrl: string;
  identity: IMarketTradingViewSymbolIdentity;
  symbolSyncSupport: boolean | undefined;
}) {
  const identityKey = buildMarketTradingViewIdentityKey(identity);
  const [frameState, setFrameState] = useState(() => ({
    staticTradingViewUrl,
    identity,
    identityKey,
  }));

  useEffect(() => {
    setFrameState((current) => {
      const staticUrlChanged =
        current.staticTradingViewUrl !== staticTradingViewUrl;
      const shouldReloadWarmupIdentity =
        !current.identity.networkId.trim() &&
        Boolean(identity.networkId.trim()) &&
        current.identityKey !== identityKey;
      const shouldReloadUnsupportedIdentity =
        symbolSyncSupport === false && current.identityKey !== identityKey;
      if (
        !staticUrlChanged &&
        !shouldReloadWarmupIdentity &&
        !shouldReloadUnsupportedIdentity
      ) {
        return current;
      }

      return {
        staticTradingViewUrl,
        identity,
        identityKey,
      };
    });
  }, [identity, identityKey, staticTradingViewUrl, symbolSyncSupport]);

  return frameState;
}

export function buildMarketTradingViewUrl({
  baseUrl,
  identity,
}: {
  baseUrl: string;
  identity: IMarketTradingViewSymbolIdentity;
}) {
  const url = new URL(baseUrl);
  url.searchParams.set('decimal', identity.decimal.toString());
  url.searchParams.set('networkId', identity.networkId);
  url.searchParams.set('address', identity.tokenAddress);
  url.searchParams.set('symbol', identity.symbol);
  if (identity.initialHyperLiquidPriceScale) {
    url.searchParams.set(
      'initialPriceScale',
      identity.initialHyperLiquidPriceScale.toString(),
    );
    url.searchParams.set('initialPriceScaleSymbol', identity.symbol);
    url.searchParams.set(
      'initialHyperliquidPriceScale',
      identity.initialHyperLiquidPriceScale.toString(),
    );
    url.searchParams.set('initialHyperliquidPriceScaleSymbol', identity.symbol);
  }
  return url.toString();
}

export function useMarketSymbolSync({
  webRef,
  identity,
  frameIdentity,
  documentGeneration,
  enabled,
  deliveryDelayMs = 0,
}: {
  webRef: React.RefObject<IWebViewRef | null>;
  identity: IMarketTradingViewSymbolIdentity;
  frameIdentity: IMarketTradingViewSymbolIdentity;
  documentGeneration: number;
  enabled: boolean;
  deliveryDelayMs?: number;
}) {
  const identityKey = buildMarketTradingViewIdentityKey(identity);
  const frameIdentityKey = buildMarketTradingViewIdentityKey(frameIdentity);
  const deliveredIdentityKeyRef = useRef(frameIdentityKey);
  const lastFrameIdentityKeyRef = useRef(frameIdentityKey);
  const lastDocumentGenerationRef = useRef(documentGeneration);

  useEffect(() => {
    if (
      lastFrameIdentityKeyRef.current !== frameIdentityKey ||
      lastDocumentGenerationRef.current !== documentGeneration
    ) {
      lastFrameIdentityKeyRef.current = frameIdentityKey;
      lastDocumentGenerationRef.current = documentGeneration;
      deliveredIdentityKeyRef.current = frameIdentityKey;
    }

    if (!enabled) {
      return;
    }

    if (!webRef.current || deliveredIdentityKeyRef.current === identityKey) {
      return;
    }

    const deliverSymbolChange = () => {
      if (!webRef.current) {
        return;
      }
      webRef.current.sendMessageViaInjectedScript({
        type: 'SYMBOL_CHANGE',
        payload: {
          symbol: identity.symbol,
          force: true,
          market: {
            address: identity.tokenAddress,
            networkId: identity.networkId,
            decimal: identity.decimal.toString(),
            ...(identity.initialHyperLiquidPriceScale
              ? {
                  initialPriceScale:
                    identity.initialHyperLiquidPriceScale.toString(),
                  initialPriceScaleSymbol: identity.symbol,
                }
              : {}),
          },
        },
      });
      deliveredIdentityKeyRef.current = identityKey;
    };

    if (deliveryDelayMs <= 0) {
      deliverSymbolChange();
      return;
    }

    const timeout = setTimeout(deliverSymbolChange, deliveryDelayMs);
    return () => clearTimeout(timeout);
  }, [
    deliveryDelayMs,
    documentGeneration,
    enabled,
    frameIdentityKey,
    identity,
    identityKey,
    webRef,
  ]);
}
