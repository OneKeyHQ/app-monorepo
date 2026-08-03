import {
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { AnimatePresence, Empty, Stack } from '@onekeyhq/components';
import {
  TRADING_VIEW_DISABLED_FEATURES,
  TradingViewV2,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import type {
  ITradingViewDisabledFeature,
  ITradingViewFirstPaintReadyData,
  ITradingViewKLineDataReadyData,
  ITradingViewKLinePeriodChangeData,
  ITradingViewLegacyHistoryReadyData,
  ITradingViewPriceUpdateData,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewV2';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

import { MarketTestIDs } from '../../../testIDs';
import {
  type IMarketTradingViewResolutionNamespace,
  getMarketTradingViewSessionPreference,
  hydrateMarketTradingViewPreferences,
  isMarketTradingViewPreferencesHydrated,
  saveMarketTradingViewFirstScreenRequestPreference,
  saveMarketTradingViewResolutionPreference,
  updateMarketTradingViewSessionResolution,
} from '../../utils/marketTradingViewResolutionPreference';
import { useNetworkAccountAddress } from '../InformationTabs/hooks/useNetworkAccountAddress';

import { MarketTradingViewLoading } from './MarketTradingViewLoading';

const MARKET_NATIVE_CHART_CONTROL_DISABLED_FEATURES: readonly ITradingViewDisabledFeature[] =
  [
    TRADING_VIEW_DISABLED_FEATURES.TIMEFRAME_SELECTOR,
    TRADING_VIEW_DISABLED_FEATURES.TIME_SCALE,
    TRADING_VIEW_DISABLED_FEATURES.SETTINGS,
    TRADING_VIEW_DISABLED_FEATURES.FULLSCREEN,
    TRADING_VIEW_DISABLED_FEATURES.LAYOUT_TOGGLE,
    TRADING_VIEW_DISABLED_FEATURES.DRAWING_TOOLBAR,
  ];

function MarketNativeChartErrorPlaceholder({
  onRetry,
}: {
  onRetry: () => void;
}) {
  const intl = useIntl();
  return (
    <Empty
      testID={MarketTestIDs.detailChartError}
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      left={0}
      bg="$bgApp"
      icon="CloudOffOutline"
      title={intl.formatMessage({ id: ETranslations.global_network_error })}
      description={intl.formatMessage({
        id: ETranslations.global_unknown_error_retry_message,
      })}
      buttonProps={{
        testID: MarketTestIDs.detailChartRetry,
        children: intl.formatMessage({ id: ETranslations.global_retry }),
        onPress: onRetry,
      }}
    />
  );
}

function normalizeChartRealtimePrice(
  price: ITradingViewPriceUpdateData['price'],
) {
  const priceString =
    typeof price === 'number' ? price.toString() : price?.trim();
  const numericPrice = Number(priceString);
  return Number.isFinite(numericPrice) && numericPrice > 0
    ? priceString
    : undefined;
}

function normalizeChartUpdateTimestamp(
  timestamp: ITradingViewPriceUpdateData['timestamp'],
) {
  if (
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp) ||
    timestamp <= 0
  ) {
    return Date.now();
  }

  return timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
}

function normalizeTokenAddress(address: string | undefined, networkId: string) {
  return (
    normalizeTokenContractAddress({
      networkId,
      contractAddress: address?.trim(),
    }) ?? ''
  );
}

function getResolutionNamespace(
  storageNamespace: string | undefined,
): IMarketTradingViewResolutionNamespace {
  return storageNamespace === 'market-hyperliquid'
    ? 'market-hyperliquid'
    : 'market';
}

function isChartPriceUpdateForCurrentToken({
  data,
  tokenAddress,
  networkId,
}: {
  data: ITradingViewPriceUpdateData;
  tokenAddress: string;
  networkId: string;
}) {
  if (!data.networkId || data.networkId !== networkId) {
    return false;
  }

  const currentTokenAddress = normalizeTokenAddress(tokenAddress, networkId);
  const updateTokenAddress = normalizeTokenAddress(
    data.tokenAddress,
    networkId,
  );

  return currentTokenAddress
    ? updateTokenAddress === currentTokenAddress
    : !updateTokenAddress;
}

export interface IMarketTradingViewProps {
  tokenAddress: string;
  networkId: string;
  tokenSymbol?: string;
  decimal?: number;
  marketPrice?: string | number;
  historyStartTime?: number;
  onPanesCountChange?: (count: number) => void;
  isNative?: boolean;
  dataSource?: 'websocket' | 'polling';
  pageWidth?: number;
  nativeChartTypeControlMode?: 'toggle' | 'select';
  nativeIndicatorControlMode?: 'dialog' | 'popover';
  nativeIntervalControlMode?: 'dialog' | 'popover';
  nativePriceMarketCapControlMode?: 'settings' | 'select';
  nativeControlsLayoutMode?: 'mobile' | 'desktop';
  isNativeChartFullscreen?: boolean;
  showNativeIndicatorQuickBar?: boolean;
  onTouchScroll?: (deltaY: number) => void;
  onNativeChartFullscreenChange?: (isFullscreen: boolean) => void;
  onNativeIndicatorQuickBarChange?: (quickBar: ReactNode | null) => void;
  onIndicatorsDialogOpenChange?: (isOpen: boolean) => void;
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
  onNativeSubIndicatorCountChange?: (count: number | null) => void;
  maxNativeSubIndicatorCount?: number;
}

export interface IMarketTradingViewPriceUpdate {
  tokenAddress: string;
  networkId: string;
  price: string;
  lastUpdated: number;
}

export interface IMarketTradingViewViewProps extends IMarketTradingViewProps {
  accountAddress?: string;
  isActive?: boolean;
  isVisibilityManagedExternally?: boolean;
  onApplyChartPriceUpdate?: (update: IMarketTradingViewPriceUpdate) => void;
}

export const MarketTradingViewView = memo(
  ({
    tokenAddress,
    networkId,
    tokenSymbol = '',
    decimal = 8,
    marketPrice,
    historyStartTime,
    dataSource,
    pageWidth,
    nativeChartTypeControlMode,
    nativeIndicatorControlMode,
    nativeIntervalControlMode,
    nativePriceMarketCapControlMode,
    nativeControlsLayoutMode,
    isNativeChartFullscreen,
    showNativeIndicatorQuickBar,
    onTouchScroll,
    onNativeChartFullscreenChange,
    onNativeIndicatorQuickBarChange,
    onIndicatorsDialogOpenChange,
    onInteractionOverlayOpenChange,
    onNativeSubIndicatorCountChange,
    maxNativeSubIndicatorCount,
    accountAddress,
    isActive = true,
    isVisibilityManagedExternally = false,
    onApplyChartPriceUpdate,
  }: IMarketTradingViewViewProps) => {
    const initialKLineResolutions = useMemo(
      () => ({
        market: getMarketTradingViewSessionPreference({
          tokenAddress,
          networkId,
          namespace: 'market',
        }).resolution,
        marketHyperLiquid: getMarketTradingViewSessionPreference({
          tokenAddress,
          networkId,
          namespace: 'market-hyperliquid',
        }).resolution,
      }),
      [networkId, tokenAddress],
    );
    const chartIdentity = `${networkId}:${tokenAddress}:${tokenSymbol}`;
    const [readyChartIdentity, setReadyChartIdentity] = useState<string>();
    const [failedChartIdentity, setFailedChartIdentity] = useState<string>();
    const [chartRetryRevision, setChartRetryRevision] = useState(0);

    const handleFirstPaintReady = useCallback(
      (data: ITradingViewFirstPaintReadyData) => {
        if (data.networkId && data.networkId !== networkId) {
          return;
        }
        if (
          data.tokenAddress &&
          normalizeTokenAddress(data.tokenAddress, networkId) !==
            normalizeTokenAddress(tokenAddress, networkId)
        ) {
          return;
        }
        if (data.status === 'failed') {
          setFailedChartIdentity(chartIdentity);
          return;
        }
        setFailedChartIdentity(undefined);
        setReadyChartIdentity(chartIdentity);
      },
      [chartIdentity, networkId, tokenAddress],
    );
    const handleChartLoadStart = useCallback(() => {
      setReadyChartIdentity(undefined);
      setFailedChartIdentity(undefined);
    }, []);
    const handleLegacyHistoryReady = useCallback(
      (data: ITradingViewLegacyHistoryReadyData) => {
        if (
          data.networkId !== networkId ||
          normalizeTokenAddress(data.tokenAddress, networkId) !==
            normalizeTokenAddress(tokenAddress, networkId) ||
          data.symbol.trim().toLowerCase() !== tokenSymbol.trim().toLowerCase()
        ) {
          return;
        }

        setFailedChartIdentity(undefined);
        setReadyChartIdentity(chartIdentity);
      },
      [chartIdentity, networkId, tokenAddress, tokenSymbol],
    );
    const handleChartRetry = useCallback(() => {
      setReadyChartIdentity(undefined);
      setFailedChartIdentity(undefined);
      setChartRetryRevision((revision) => revision + 1);
    }, []);

    const handlePriceUpdate = useCallback(
      (data: ITradingViewPriceUpdateData) => {
        if (data.source === 'history') {
          return;
        }

        if (
          !isChartPriceUpdateForCurrentToken({
            data,
            tokenAddress,
            networkId,
          })
        ) {
          return;
        }

        const realtimePrice = normalizeChartRealtimePrice(data.price);
        if (!realtimePrice) {
          return;
        }

        onApplyChartPriceUpdate?.({
          tokenAddress,
          networkId,
          price: realtimePrice,
          lastUpdated: normalizeChartUpdateTimestamp(data.timestamp),
        });
      },
      [networkId, onApplyChartPriceUpdate, tokenAddress],
    );
    const handleKLineDataReady = useCallback(
      (data: ITradingViewKLineDataReadyData) => {
        const namespace = getResolutionNamespace(data.storageNamespace);
        if (data.requestRange) {
          void saveMarketTradingViewFirstScreenRequestPreference({
            resolution: data.period,
            ...data.requestRange,
            namespace,
          });
        }
      },
      [],
    );
    const handleKLinePeriodChange = useCallback(
      (data: ITradingViewKLinePeriodChangeData) => {
        const namespace = getResolutionNamespace(data.storageNamespace);
        void saveMarketTradingViewResolutionPreference(
          data.toPeriod,
          namespace,
        );
        updateMarketTradingViewSessionResolution({
          tokenAddress,
          networkId,
          resolution: data.toPeriod,
          namespace,
        });
      },
      [networkId, tokenAddress],
    );
    let chartOverlay: ReactNode = null;
    if (failedChartIdentity === chartIdentity) {
      chartOverlay = (
        <MarketNativeChartErrorPlaceholder
          key={`${chartIdentity}:error`}
          onRetry={handleChartRetry}
        />
      );
    } else if (
      !platformEnv.isWeb &&
      !platformEnv.isDesktop &&
      readyChartIdentity !== chartIdentity
    ) {
      chartOverlay = <MarketTradingViewLoading key={chartIdentity} overlay />;
    }

    return (
      <Stack position="relative" flex={1}>
        <TradingViewV2
          key={chartRetryRevision}
          testID={MarketTestIDs.detailChart}
          symbol={tokenSymbol}
          tokenAddress={tokenAddress}
          networkId={networkId}
          enabled={isActive}
          isVisibilityManagedExternally={isVisibilityManagedExternally}
          decimal={decimal}
          marketPrice={marketPrice}
          initialKLineResolution={initialKLineResolutions.market}
          initialHyperLiquidKLineResolution={
            initialKLineResolutions.marketHyperLiquid
          }
          historyStartTime={historyStartTime}
          dataSource={dataSource}
          accountAddress={accountAddress}
          w={pageWidth}
          onTouchScroll={onTouchScroll}
          onIndicatorsDialogOpenChange={onIndicatorsDialogOpenChange}
          onInteractionOverlayOpenChange={onInteractionOverlayOpenChange}
          onNativeSubIndicatorCountChange={onNativeSubIndicatorCountChange}
          maxNativeSubIndicatorCount={maxNativeSubIndicatorCount}
          onPriceUpdate={handlePriceUpdate}
          onKLineDataReady={handleKLineDataReady}
          onKLinePeriodChange={handleKLinePeriodChange}
          onLegacyHistoryReady={handleLegacyHistoryReady}
          onFirstPaintReady={handleFirstPaintReady}
          onLoadStart={handleChartLoadStart}
          disabledFeatures={MARKET_NATIVE_CHART_CONTROL_DISABLED_FEATURES}
          enableNativeChartControls
          nativeChartTypeControlMode={nativeChartTypeControlMode}
          nativeIndicatorControlMode={nativeIndicatorControlMode}
          nativeIntervalControlMode={nativeIntervalControlMode}
          nativePriceMarketCapControlMode={nativePriceMarketCapControlMode}
          nativeControlsLayoutMode={nativeControlsLayoutMode}
          isNativeChartFullscreen={isNativeChartFullscreen}
          showNativeIndicatorQuickBar={showNativeIndicatorQuickBar}
          onNativeChartFullscreenChange={onNativeChartFullscreenChange}
          onNativeIndicatorQuickBarChange={onNativeIndicatorQuickBarChange}
        />
        <AnimatePresence initial={false}>{chartOverlay}</AnimatePresence>
      </Stack>
    );
  },
);

MarketTradingViewView.displayName = 'MarketTradingViewView';

export const MarketTradingView = memo((props: IMarketTradingViewProps) => {
  const [arePreferencesHydrated, setArePreferencesHydrated] = useState(
    isMarketTradingViewPreferencesHydrated,
  );
  const { accountAddress } = useNetworkAccountAddress(props.networkId);
  const tokenDetailActions = useTokenDetailActions();
  useEffect(() => {
    if (arePreferencesHydrated) {
      return undefined;
    }
    let cancelled = false;
    void hydrateMarketTradingViewPreferences().then(() => {
      if (!cancelled) {
        setArePreferencesHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [arePreferencesHydrated]);
  const handleApplyChartPriceUpdate = useCallback(
    (update: IMarketTradingViewPriceUpdate) => {
      tokenDetailActions.current.applyChartPriceUpdate(update);
    },
    [tokenDetailActions],
  );

  if (!arePreferencesHydrated) {
    if (platformEnv.isWeb || platformEnv.isDesktop) {
      return null;
    }
    return (
      <Stack position="relative" flex={1}>
        <MarketTradingViewLoading overlay />
      </Stack>
    );
  }

  return (
    <MarketTradingViewView
      {...props}
      accountAddress={accountAddress}
      onApplyChartPriceUpdate={handleApplyChartPriceUpdate}
    />
  );
});

MarketTradingView.displayName = 'MarketTradingView';
