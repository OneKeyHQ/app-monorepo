import { useCallback, useEffect, useRef } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import type { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';

type IMarketTokenDetailNavigationTarget =
  | {
      screen: ETabMarketRoutes.MarketDetailV2;
      params: ITabMarketParamList[ETabMarketRoutes.MarketDetailV2];
    }
  | {
      screen: ETabMarketRoutes.MarketNativeDetail;
      params: ITabMarketParamList[ETabMarketRoutes.MarketNativeDetail];
    }
  | {
      screen: ETabMarketRoutes.MarketStockDetail;
      params: ITabMarketParamList[ETabMarketRoutes.MarketStockDetail];
    };

type IMarketTokenDetailRouteParams = Partial<
  ITabMarketParamList[ETabMarketRoutes.MarketDetailV2]
> &
  Partial<ITabMarketParamList[ETabMarketRoutes.MarketNativeDetail]> & {
    stockId?: string;
    isNative?: boolean | string;
    showFavoriteButton?: boolean | string;
    stockPreviewLogoUrl?: string;
    stockPreviewName?: string;
    stockPreviewSymbol?: string;
  };

const NAVIGATION_RETRY_DELAYS = [120, 360];

function normalizeRouteBooleanParam(
  value: boolean | string | undefined,
  defaultValue: boolean,
) {
  if (typeof value === 'string') {
    return value === 'true';
  }
  return value ?? defaultValue;
}

function parseOptionalRouteBooleanParam(value: string | null) {
  return value === null ? undefined : value === 'true';
}

export function getMarketTokenDetailNavigationTargetFromHash(
  hash: string = globalThis.location?.hash ?? '',
): IMarketTokenDetailNavigationTarget | undefined {
  const hashPath = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path, query = ''] = hashPath.split('?');
  const segments = path.replace(/^\/+|\/+$/g, '').split('/');

  if (
    segments[0] !== 'market' ||
    !['stock', 'token'].includes(segments[1]) ||
    !segments[2]
  ) {
    return undefined;
  }

  try {
    const searchParams = new URLSearchParams(query);
    const isNative = parseOptionalRouteBooleanParam(
      searchParams.get('isNative'),
    );
    const showFavoriteButton = parseOptionalRouteBooleanParam(
      searchParams.get('showFavoriteButton'),
    );
    const disableTrade = parseOptionalRouteBooleanParam(
      searchParams.get('disableTrade'),
    );
    const skipMarketDataFetch = parseOptionalRouteBooleanParam(
      searchParams.get('skipMarketDataFetch'),
    );
    const marketTokenId = searchParams.get('marketTokenId') || undefined;
    const marketVariantId = searchParams.get('marketVariantId') || undefined;
    const marketTokenCategory =
      searchParams.get('marketTokenCategory') || undefined;
    const from = searchParams.get('from');

    if (segments[1] === 'stock') {
      const stockId = decodeURIComponent(segments[2]);
      const stockPreviewLogoUrl =
        searchParams.get('stockPreviewLogoUrl') || undefined;
      const stockPreviewName =
        searchParams.get('stockPreviewName') || undefined;
      const stockPreviewSymbol =
        searchParams.get('stockPreviewSymbol') || undefined;
      const tokenAddress = searchParams.get('tokenAddress') || undefined;
      const network = searchParams.get('network') || undefined;

      return {
        screen: ETabMarketRoutes.MarketStockDetail,
        params: {
          stockId,
          ...(stockPreviewSymbol ? { stockPreviewSymbol } : undefined),
          ...(stockPreviewName ? { stockPreviewName } : undefined),
          ...(stockPreviewLogoUrl ? { stockPreviewLogoUrl } : undefined),
          ...(tokenAddress ? { tokenAddress } : undefined),
          ...(network ? { network } : undefined),
          ...(isNative === undefined ? undefined : { isNative }),
          ...(from ? { from: from as EEnterWay } : undefined),
          ...(disableTrade === undefined ? undefined : { disableTrade }),
          ...(showFavoriteButton === undefined
            ? undefined
            : { showFavoriteButton }),
        },
      };
    }

    const network = decodeURIComponent(segments[2]);
    const tokenAddress = segments[3]
      ? decodeURIComponent(segments[3])
      : undefined;

    if (!tokenAddress) {
      return {
        screen: ETabMarketRoutes.MarketNativeDetail,
        params: {
          network,
          isNative: true,
          ...(marketTokenId ? { marketTokenId } : undefined),
          ...(marketVariantId ? { marketVariantId } : undefined),
          ...(marketTokenCategory ? { marketTokenCategory } : undefined),
          ...(skipMarketDataFetch === undefined
            ? undefined
            : { skipMarketDataFetch }),
          ...(from ? { from: from as EEnterWay } : undefined),
          ...(disableTrade === undefined ? undefined : { disableTrade }),
          ...(showFavoriteButton === undefined
            ? undefined
            : { showFavoriteButton }),
        },
      };
    }

    return {
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        network,
        tokenAddress,
        ...(marketTokenId ? { marketTokenId } : undefined),
        ...(marketVariantId ? { marketVariantId } : undefined),
        ...(marketTokenCategory ? { marketTokenCategory } : undefined),
        ...(skipMarketDataFetch === undefined
          ? undefined
          : { skipMarketDataFetch }),
        ...(isNative === undefined ? undefined : { isNative }),
        ...(from ? { from: from as EEnterWay } : undefined),
        ...(disableTrade === undefined ? undefined : { disableTrade }),
        ...(showFavoriteButton === undefined
          ? undefined
          : { showFavoriteButton }),
      },
    };
  } catch {
    return undefined;
  }
}

function isCurrentMarketTokenDetailTarget(
  target: IMarketTokenDetailNavigationTarget,
) {
  const route = rootNavigationRef.current?.getCurrentRoute?.();
  if (route?.name !== target.screen) {
    return false;
  }

  const params =
    route.params && typeof route.params === 'object'
      ? (route.params as IMarketTokenDetailRouteParams)
      : undefined;

  if (!params) {
    return false;
  }

  const defaultIsNative = target.screen === ETabMarketRoutes.MarketNativeDetail;
  if (
    normalizeRouteBooleanParam(params.isNative, defaultIsNative) !==
    normalizeRouteBooleanParam(target.params.isNative, defaultIsNative)
  ) {
    return false;
  }

  if (
    normalizeRouteBooleanParam(params.showFavoriteButton, true) !==
    normalizeRouteBooleanParam(target.params.showFavoriteButton, true)
  ) {
    return false;
  }

  if (
    normalizeRouteBooleanParam(params.disableTrade, false) !==
    normalizeRouteBooleanParam(target.params.disableTrade, false)
  ) {
    return false;
  }

  if (params.from !== target.params.from) {
    return false;
  }

  if (target.screen === ETabMarketRoutes.MarketStockDetail) {
    return (
      params.stockId === target.params.stockId &&
      params.network === target.params.network &&
      params.tokenAddress === target.params.tokenAddress &&
      params.stockPreviewSymbol === target.params.stockPreviewSymbol &&
      params.stockPreviewName === target.params.stockPreviewName &&
      params.stockPreviewLogoUrl === target.params.stockPreviewLogoUrl
    );
  }

  if (
    params.marketTokenId !== target.params.marketTokenId ||
    params.marketVariantId !== target.params.marketVariantId ||
    params.marketTokenCategory !== target.params.marketTokenCategory ||
    normalizeRouteBooleanParam(params.skipMarketDataFetch, false) !==
      normalizeRouteBooleanParam(target.params.skipMarketDataFetch, false)
  ) {
    return false;
  }

  if (params.network !== target.params.network) {
    return false;
  }

  if (target.screen === ETabMarketRoutes.MarketDetailV2) {
    return params.tokenAddress === target.params.tokenAddress;
  }

  return true;
}

export const useExtensionMarketTokenDetailHashNavigation =
  platformEnv.isExtensionUiExpandTab
    ? () => {
        const handledHashRef = useRef<string | undefined>(undefined);
        const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
          undefined,
        );
        const retryRunIdRef = useRef(0);

        const clearRetryTimer = useCallback(() => {
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = undefined;
          }
        }, []);

        const navigateFromHash = useCallback((expectedHash: string) => {
          const currentHash = globalThis.location?.hash ?? '';
          if (currentHash !== expectedHash) {
            return true;
          }

          const target =
            getMarketTokenDetailNavigationTargetFromHash(currentHash);
          if (!target) {
            handledHashRef.current = undefined;
            return true;
          }

          const isCurrentTarget = isCurrentMarketTokenDetailTarget(target);
          if (handledHashRef.current === currentHash && isCurrentTarget) {
            return true;
          }

          const navigation = rootNavigationRef.current;
          if (!navigation) {
            return false;
          }

          if (isCurrentTarget) {
            handledHashRef.current = currentHash;
            return true;
          }

          navigation.navigate(ERootRoutes.Main, {
            screen: ETabRoutes.Market,
            params: {
              screen: target.screen,
              params: target.params,
            },
          });

          return false;
        }, []);

        const startNavigationFromHash = useCallback(() => {
          clearRetryTimer();

          const hash = globalThis.location?.hash ?? '';
          const target = getMarketTokenDetailNavigationTargetFromHash(hash);
          if (!target) {
            handledHashRef.current = undefined;
            return;
          }

          const runId = retryRunIdRef.current + 1;
          retryRunIdRef.current = runId;
          let retryIndex = 0;

          const run = () => {
            if (retryRunIdRef.current !== runId) {
              return;
            }

            const done = navigateFromHash(hash);
            if (done || retryIndex >= NAVIGATION_RETRY_DELAYS.length) {
              retryTimerRef.current = undefined;
              return;
            }

            retryTimerRef.current = setTimeout(
              run,
              NAVIGATION_RETRY_DELAYS[retryIndex],
            );
            retryIndex += 1;
          };

          run();
        }, [clearRetryTimer, navigateFromHash]);

        useEffect(() => {
          startNavigationFromHash();
          globalThis.addEventListener('hashchange', startNavigationFromHash);
          return () => {
            retryRunIdRef.current += 1;
            clearRetryTimer();
            globalThis.removeEventListener(
              'hashchange',
              startNavigationFromHash,
            );
          };
        }, [clearRetryTimer, startNavigationFromHash]);
      }
    : () => {};

export function ExtensionMarketTokenDetailHashNavigation() {
  useExtensionMarketTokenDetailHashNavigation();
  return null;
}
