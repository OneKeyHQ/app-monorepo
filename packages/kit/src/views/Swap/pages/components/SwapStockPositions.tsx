import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Checkbox,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSwapProEnableCurrentSymbolAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketAccountPortfolioItem,
  IMarketAccountPortfolioResponse,
  IMarketBasicConfigNetwork,
} from '@onekeyhq/shared/types/marketV2';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapProSupportNetworksTokenList } from '../../hooks/useSwapPro';
import {
  SWAP_DESKTOP_CARD_SHADOW_NATIVE_STYLE,
  SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE,
} from '../../utils/swapDesktopCardShadow';

import SwapProPositionsList from './SwapProPositionsList';
import { SwapSmoothReveal } from './SwapSmoothReveal';
import { useSwapStockTradeContext } from './SwapStockTradeProvider';

type IPositions = ReturnType<typeof useSwapProSupportNetworksTokenList>;
type ICurrentPositionResult = {
  scope: string;
  position?: IMarketAccountPortfolioItem;
};
const STOCK_POSITION_RESULT_CACHE_MAX_SIZE = 20;
const PositionsContext = createContext<IPositions | undefined>(undefined);

// The stock detail page's portfolio polls every 15s. This list is checked at
// the same cadence; the loader's own runtime window still decides whether a
// check turns into a request, so an unchanged list costs nothing.
const STOCK_POSITIONS_REFRESH_INTERVAL_MS = 15_000;

export function SwapStockPositionsProvider({
  children,
  networks,
  ready,
}: PropsWithChildren<{
  networks: (IMarketBasicConfigNetwork | ISwapNetwork)[];
  ready: boolean;
}>) {
  const positions = useSwapProSupportNetworksTokenList(networks, ready, {
    stockOnly: true,
  });
  const isFocused = useRouteIsFocused();
  const { swapProLoadSupportNetworksTokenListRun } = positions;
  useEffect(() => {
    // Native keeps its own prefetch scheduler. Focus gating matches the market
    // portfolio's polling: a surface behind another one does not refresh.
    if (platformEnv.isNative || !ready || !isFocused) {
      return;
    }
    const timer = setInterval(() => {
      void swapProLoadSupportNetworksTokenListRun(networks, {
        stockOnly: true,
      });
    }, STOCK_POSITIONS_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isFocused, networks, ready, swapProLoadSupportNetworksTokenListRun]);
  return (
    <PositionsContext.Provider value={positions}>
      {children}
    </PositionsContext.Provider>
  );
}

export function useSwapStockPositions() {
  return useContext(PositionsContext);
}

export function SwapStockPositions({
  mobile = false,
  networks,
}: {
  mobile?: boolean;
  networks: (IMarketBasicConfigNetwork | ISwapNetwork)[];
}) {
  const intl = useIntl();
  const positions = useSwapStockPositions();
  const { stockId, tokenVariants } = useStockDetail();
  const { currentStockToken, selectStockSwapToken } =
    useSwapStockTradeContext();
  const [onlyCurrent, setOnlyCurrent] = useSwapProEnableCurrentSymbolAtom();
  const selectPositionToken = useCallback(
    (token: ISwapToken) => {
      const tokenStockTicker = token.stock?.underlyingAssetTicker
        ?.trim()
        .toUpperCase();
      const belongsToCurrentStock = Boolean(
        stockId &&
        (resolveMarketStockId(token) === stockId ||
          tokenStockTicker === stockId ||
          tokenVariants.some((variant) =>
            equalTokenNoCaseSensitive({ token1: variant, token2: token }),
          )),
      );
      const tokenWithStockIdentity =
        belongsToCurrentStock && token.stock
          ? {
              ...token,
              stock: {
                ...token.stock,
                stockId: token.stock.stockId ?? stockId,
              },
            }
          : token;
      selectStockSwapToken(tokenWithStockIdentity, {
        resetReceiveAmount: true,
      });
    },
    [selectStockSwapToken, stockId, tokenVariants],
  );
  const filterToken = useMemo(
    () =>
      mobile && onlyCurrent && currentStockToken
        ? positions?.positionTokenList.filter(
            (token) =>
              (stockId && resolveMarketStockId(token) === stockId) ||
              tokenVariants.some((variant) =>
                equalTokenNoCaseSensitive({ token1: variant, token2: token }),
              ) ||
              equalTokenNoCaseSensitive({
                token1: token,
                token2: currentStockToken,
              }),
          )
        : undefined,
    [
      currentStockToken,
      mobile,
      onlyCurrent,
      positions?.positionTokenList,
      stockId,
      tokenVariants,
    ],
  );
  if (!positions) return null;
  return (
    <YStack
      testID={mobile ? 'swap-stock-my-positions' : 'swap-stock-all-positions'}
      p={mobile ? '$0' : '$4'}
      borderWidth={mobile ? 0 : 1}
      borderColor="$borderSubdued"
      borderRadius={mobile ? '$0' : '$5'}
      gap={mobile ? '$0' : '$3'}
      elevationAndroid={mobile ? undefined : '$1'}
      $platform-web={mobile ? undefined : SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE}
      style={mobile ? undefined : SWAP_DESKTOP_CARD_SHADOW_NATIVE_STYLE}
    >
      <XStack
        h={mobile ? 48 : undefined}
        borderBottomWidth={mobile ? 1 : 0}
        borderColor="$borderSubdued"
      >
        <XStack
          h={mobile ? '100%' : undefined}
          alignItems="center"
          borderBottomWidth={mobile ? 2 : 0}
          borderColor="$borderActive"
        >
          <SizableText size="$bodyLgMedium">
            {intl.formatMessage({
              id: mobile
                ? ETranslations.title_my_positions
                : ETranslations.title_all_positions,
            })}
          </SizableText>
        </XStack>
      </XStack>
      {mobile ? (
        <XStack
          pt="$2"
          pb="$1"
          gap="$2"
          alignItems="center"
          onPress={() => setOnlyCurrent((value) => !value)}
          cursor="pointer"
        >
          <Checkbox
            testID="swap-toggle-swap-pro-enable-current-symbol-checkbox"
            value={onlyCurrent}
            onChange={(value) => setOnlyCurrent(value === true)}
            containerProps={{ p: '$0', h: 20 }}
            width={16}
            height={16}
            maxHeight={16}
            borderWidth={1.6}
            borderRadius={3.2}
            shouldStopPropagation
          />
          <SizableText size="$bodyMd">
            {intl.formatMessage({ id: ETranslations.stocks_current_stock })}
          </SizableText>
        </XStack>
      ) : null}
      <SwapProPositionsList
        positionTokenList={positions.positionTokenList}
        positionLoading={positions.positionLoading}
        positionLoadError={positions.positionLoadError}
        filterToken={filterToken}
        onTokenPress={selectPositionToken}
        onRetry={() =>
          void positions.swapProLoadSupportNetworksTokenListRun(networks, {
            forceRefresh: true,
            stockOnly: true,
          })
        }
        stockOnly
        stockLayout
        hideSearch
      />
    </YStack>
  );
}

export function SwapStockCurrentPosition() {
  const intl = useIntl();
  const positions = useSwapStockPositions();
  const { currentStockToken } = useSwapStockTradeContext();
  const token = positions?.positionTokenList.find(
    (item) =>
      currentStockToken &&
      equalTokenNoCaseSensitive({ token1: item, token2: currentStockToken }),
  );
  const scope = token
    ? `${token.networkId}:${token.contractAddress}:${token.accountAddress}`
    : '';
  const lastSuccessfulResultsRef = useRef(
    new cacheUtils.LRUCache<string, ICurrentPositionResult>({
      max: STOCK_POSITION_RESULT_CACHE_MAX_SIZE,
    }),
  );
  const { result } = usePromiseResult(
    async () => {
      if (!token?.accountAddress) return undefined;
      let response: IMarketAccountPortfolioResponse;
      try {
        response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketAccountPortfolio({
            networkId: token.networkId,
            tokenAddress: token.contractAddress,
            accountAddress: token.accountAddress,
            throwOnError: true,
          });
      } catch {
        return lastSuccessfulResultsRef.current.get(scope);
      }
      const nextResult = {
        scope,
        position: response.list.find((item) =>
          equalTokenNoCaseSensitive({
            token1: token,
            token2: {
              networkId: token.networkId,
              contractAddress: item.tokenAddress,
            },
          }),
        ),
      };
      lastSuccessfulResultsRef.current.set(scope, nextResult);
      return nextResult;
    },
    // Portfolio requests depend on identity, not the frequently refreshed balance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope],
    // Keep the polling interval stable so a token change runs immediately;
    // usePromiseResult otherwise waits for the newly changed interval.
    { pollingInterval: 30_000 },
  );
  const position = result?.scope === scope ? result.position : undefined;
  const hasPosition = Boolean(
    token && new BigNumber(token.balanceParsed ?? 0).gt(0),
  );
  const pnl = position?.pnl?.isPnlSupported ? position.pnl : undefined;
  const avgCost =
    position && pnl
      ? new BigNumber(position.totalPrice)
          .minus(pnl.unrealizedPnlUsd)
          .div(position.amount)
      : undefined;
  const color = new BigNumber(pnl?.unrealizedPnlUsd ?? 0).lt(0)
    ? '$textCritical'
    : '$textSuccess';
  return (
    <SwapSmoothReveal visible={hasPosition} parentGap={28} keepMounted>
      <YStack testID="swap-stock-current-position" gap="$3">
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage({ id: ETranslations.label_position })}
        </SizableText>
        <XStack gap="$5">
          <YStack flex={1} gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_balance })}
            </SizableText>
            <XStack gap="$1">
              <NumberSizeableText size="$bodyLgMedium" formatter="balance">
                {token?.balanceParsed}
              </NumberSizeableText>
              <SizableText size="$bodyLgMedium">{token?.symbol}</SizableText>
            </XStack>
            <NumberSizeableText
              size="$bodySm"
              color="$textSubdued"
              formatter="value"
              formatterOptions={{ currency: '$' }}
            >
              {position?.totalPrice ?? '--'}
            </NumberSizeableText>
          </YStack>
          <YStack flex={1} gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.label_average_cost })}
            </SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="price"
              formatterOptions={{ currency: '$' }}
            >
              {avgCost?.isFinite() ? avgCost.toFixed() : '--'}
            </NumberSizeableText>
          </YStack>
          <YStack flex={1} gap="$1">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.defi_unrealized_pnl_title,
              })}
            </SizableText>
            <NumberSizeableText
              size="$bodyLgMedium"
              color={pnl ? color : '$textSubdued'}
              formatter="value"
              formatterOptions={{ currency: '$', showPlusMinusSigns: true }}
            >
              {pnl?.unrealizedPnlUsd ?? '--'}
            </NumberSizeableText>
            <NumberSizeableText
              size="$bodySm"
              color={pnl ? color : '$textSubdued'}
              formatter="priceChange"
            >
              {pnl?.unrealizedPnlPercent ?? '--'}
            </NumberSizeableText>
          </YStack>
        </XStack>
      </YStack>
    </SwapSmoothReveal>
  );
}
