import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, rootNavigationRef } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EEnterWay } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  type ITabMarketParamList,
} from '@onekeyhq/shared/src/routes';
import { readExtensionTokenPreview } from '@onekeyhq/shared/src/utils/marketTokenPreviewRoute';

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
    const resolveMarketAsset = parseOptionalRouteBooleanParam(
      searchParams.get('resolveMarketAsset'),
    );
    const marketTokenId = searchParams.get('marketTokenId') || undefined;
    const marketVariantId = searchParams.get('marketVariantId') || undefined;
    const marketTokenCategory =
      searchParams.get('marketTokenCategory') || undefined;
    const marketTokenSymbol =
      searchParams.get('marketTokenSymbol') || undefined;
    const from = searchParams.get('from');
    const marketTokenPreviewId =
      searchParams.get('marketTokenPreviewId') || undefined;

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
          ...(marketTokenPreviewId ? { marketTokenPreviewId } : undefined),
          ...(marketTokenId ? { marketTokenId } : undefined),
          ...(marketVariantId ? { marketVariantId } : undefined),
          ...(marketTokenCategory ? { marketTokenCategory } : undefined),
          ...(marketTokenSymbol ? { marketTokenSymbol } : undefined),
          ...(resolveMarketAsset === undefined
            ? undefined
            : { resolveMarketAsset }),
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
        ...(marketTokenPreviewId ? { marketTokenPreviewId } : undefined),
        ...(marketTokenId ? { marketTokenId } : undefined),
        ...(marketVariantId ? { marketVariantId } : undefined),
        ...(marketTokenCategory ? { marketTokenCategory } : undefined),
        ...(marketTokenSymbol ? { marketTokenSymbol } : undefined),
        ...(resolveMarketAsset === undefined
          ? undefined
          : { resolveMarketAsset }),
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
    (target.params.marketTokenPreviewId !== undefined &&
      params.marketTokenPreviewId !== target.params.marketTokenPreviewId) ||
    (target.params.legacyTokenPreview &&
      params.legacyTokenPreview?.selectedAt !==
        target.params.legacyTokenPreview.selectedAt) ||
    params.marketVariantId !== target.params.marketVariantId ||
    params.marketTokenCategory !== target.params.marketTokenCategory ||
    params.marketTokenSymbol !== target.params.marketTokenSymbol ||
    normalizeRouteBooleanParam(params.resolveMarketAsset, false) !==
      normalizeRouteBooleanParam(target.params.resolveMarketAsset, false) ||
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
        const intl = useIntl();
        const errorDialogRef = useRef<
          ReturnType<typeof Dialog.show> | undefined
        >(undefined);
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

        const navigateFromHash = useCallback(
          (
            expectedHash: string,
            preparedTarget: IMarketTokenDetailNavigationTarget,
          ) => {
            const currentHash = globalThis.location?.hash ?? '';
            if (currentHash !== expectedHash) {
              return true;
            }

            const target = preparedTarget;
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
          },
          [],
        );

        const startNavigationFromHash = useCallback(
          function startNavigation() {
            clearRetryTimer();
            void errorDialogRef.current?.close();
            errorDialogRef.current = undefined;

            const runId = retryRunIdRef.current + 1;
            retryRunIdRef.current = runId;

            const hash = globalThis.location?.hash ?? '';
            const target = getMarketTokenDetailNavigationTargetFromHash(hash);
            if (!target) {
              handledHashRef.current = undefined;
              return;
            }

            let retryIndex = 0;

            const run = () => {
              if (retryRunIdRef.current !== runId || !target) {
                return;
              }

              const done = navigateFromHash(hash, target);
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

            if (
              target.screen !== ETabMarketRoutes.MarketStockDetail &&
              target.params.marketTokenPreviewId
            ) {
              const tokenTarget = target;
              void readExtensionTokenPreview(
                target.params.marketTokenPreviewId,
                {
                  network: target.params.network,
                  tokenAddress:
                    'tokenAddress' in target.params
                      ? target.params.tokenAddress
                      : '',
                  isNative: normalizeRouteBooleanParam(
                    target.params.isNative,
                    target.screen === ETabMarketRoutes.MarketNativeDetail,
                  ),
                },
              ).then((preview) => {
                if (
                  retryRunIdRef.current !== runId ||
                  globalThis.location?.hash !== hash
                )
                  return;
                if (preview) {
                  tokenTarget.params.legacyTokenPreview = preview;
                } else if (
                  normalizeRouteBooleanParam(
                    tokenTarget.params.skipMarketDataFetch,
                    false,
                  )
                ) {
                  // Do not silently accept the old route or open an empty no-fetch
                  // detail. Retrying performs a new lookup, not a layout remount.
                  errorDialogRef.current = Dialog.show({
                    title: intl.formatMessage({
                      id: ETranslations.global_an_error_occurred,
                    }),
                    description: intl.formatMessage({
                      id: ETranslations.global_unknown_error_retry_message,
                    }),
                    onConfirmText: intl.formatMessage({
                      id: ETranslations.global_retry,
                    }),
                    onConfirm: async ({ close }) => {
                      await close();
                      if (
                        globalThis.location?.hash === hash &&
                        retryRunIdRef.current === runId
                      )
                        startNavigation();
                    },
                  });
                  return;
                } else {
                  // Explicitly clear the previous handoff when updating the same
                  // route; navigation may merge params rather than replace them.
                  tokenTarget.params.legacyTokenPreview = undefined;
                }
                run();
              });
            } else {
              run();
            }
          },
          [clearRetryTimer, intl, navigateFromHash],
        );

        useEffect(() => {
          startNavigationFromHash();
          globalThis.addEventListener('hashchange', startNavigationFromHash);
          return () => {
            retryRunIdRef.current += 1;
            clearRetryTimer();
            void errorDialogRef.current?.close();
            errorDialogRef.current = undefined;
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
