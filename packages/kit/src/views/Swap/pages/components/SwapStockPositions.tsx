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
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { ETabName, TabBarItem } from '../../../Perp/layouts/PerpMobileLayout';
import {
  useSwapProPositionsListFilter,
  useSwapProSupportNetworksTokenList,
} from '../../hooks/useSwapPro';
import { useSwapProPositionsPnl } from '../../hooks/useSwapProPositionsPnl';
import { useSwapStockPortfolioData } from '../../hooks/useSwapStockPortfolioData';
import {
  SWAP_DESKTOP_CARD_SHADOW_NATIVE_STYLE,
  SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE,
} from '../../utils/swapDesktopCardShadow';

import SwapProPositionsList from './SwapProPositionsList';
import { useSwapStockSelection } from './SwapStockMarketProvider';
import { useSwapStockTradeContext } from './SwapStockTradeProvider';

type IPositions = ReturnType<typeof useSwapProSupportNetworksTokenList> & {
  pnlMap: ReturnType<typeof useSwapProPositionsPnl>;
  portfolio: ReturnType<typeof useSwapStockPortfolioData>;
  displayPortfolio: ReturnType<typeof useSwapStockPortfolioData>;
};
// The stock page has a single positions tab, so its title is not a switch.
const ignoreTitlePress = () => undefined;
const PositionsContext = createContext<IPositions | undefined>(undefined);

// The loader's runtime window decides whether a check needs a new request.
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
  const { finallyTokenList } = useSwapProPositionsListFilter(
    undefined,
    positions.positionTokenList,
    true,
  );
  const pnlMap = useSwapProPositionsPnl(finallyTokenList);
  const portfolio = useSwapStockPortfolioData({ ...positions, pnlMap });
  const selection = useSwapStockSelection();
  const displayPortfolio = useSwapStockPortfolioData(
    { ...positions, pnlMap },
    selection
      ? {
          stockId: selection.displayStockId,
          tokenVariants: selection.displayTokenVariants,
        }
      : undefined,
  );
  const value = useMemo(
    () => ({ ...positions, pnlMap, portfolio, displayPortfolio }),
    [positions, pnlMap, portfolio, displayPortfolio],
  );
  const isFocused = useRouteIsFocused();
  const { swapProLoadSupportNetworksTokenListRun } = positions;
  useEffect(() => {
    if (!ready || !isFocused) {
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
    <PositionsContext.Provider value={value}>
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
      {mobile ? (
        // The Pro tab bar's own item and bottom rule, so both trade tabs'
        // positions titles stay identical (OK-63758).
        // pointerEvents: a single title, so no hover, cursor or press state.
        <XStack
          borderBottomWidth="$0.5"
          borderBottomColor="$borderSubdued"
          pointerEvents="none"
        >
          <TabBarItem
            name={ETabName.Positions}
            isFocused
            onPress={ignoreTitlePress}
          />
        </XStack>
      ) : (
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage({ id: ETranslations.title_all_positions })}
        </SizableText>
      )}
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
        pnlMap={positions.pnlMap}
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
