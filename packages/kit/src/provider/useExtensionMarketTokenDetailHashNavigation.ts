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
    };

type IMarketTokenDetailRouteParams = Partial<
  ITabMarketParamList[ETabMarketRoutes.MarketDetailV2]
> &
  Partial<ITabMarketParamList[ETabMarketRoutes.MarketNativeDetail]> & {
    isNative?: boolean | string;
    showFavoriteButton?: boolean | string;
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

export function getMarketTokenDetailNavigationTargetFromHash(
  hash: string = globalThis.location?.hash ?? '',
): IMarketTokenDetailNavigationTarget | undefined {
  const hashPath = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path, query = ''] = hashPath.split('?');
  const segments = path.replace(/^\/+|\/+$/g, '').split('/');

  if (segments[0] !== 'market' || segments[1] !== 'token' || !segments[2]) {
    return undefined;
  }

  try {
    const searchParams = new URLSearchParams(query);
    const isNativeParam = searchParams.get('isNative');
    const showFavoriteButtonParam = searchParams.get('showFavoriteButton');
    const from = searchParams.get('from');
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
          ...(from ? { from: from as EEnterWay } : undefined),
          ...(showFavoriteButtonParam === null
            ? undefined
            : { showFavoriteButton: showFavoriteButtonParam === 'true' }),
        },
      };
    }

    return {
      screen: ETabMarketRoutes.MarketDetailV2,
      params: {
        network,
        tokenAddress,
        ...(isNativeParam === null
          ? undefined
          : { isNative: isNativeParam === 'true' }),
        ...(from ? { from: from as EEnterWay } : undefined),
        ...(showFavoriteButtonParam === null
          ? undefined
          : { showFavoriteButton: showFavoriteButtonParam === 'true' }),
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

  if (!params || params.network !== target.params.network) {
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

  if (params.from !== target.params.from) {
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
