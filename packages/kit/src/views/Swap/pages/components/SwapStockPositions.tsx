import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, SizableText, XStack, YStack } from '@onekeyhq/components';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useSwapProEnableCurrentSymbolAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useStockDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext';
import { resolveMarketStockId } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
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
import { useSwapStockSelection } from './SwapStockMarketProvider';
import { useSwapStockTradeContext } from './SwapStockTradeProvider';

type IPositions = ReturnType<typeof useSwapProSupportNetworksTokenList>;
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
  const { currentStockToken } = useSwapStockTradeContext();
  const selection = useSwapStockSelection();
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
      void selection?.selectToken(tokenWithStockIdentity);
    },
    [selection, stockId, tokenVariants],
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
