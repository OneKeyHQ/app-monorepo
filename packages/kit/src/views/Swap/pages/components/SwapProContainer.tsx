import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { ScrollView } from 'react-native';

import {
  Alert,
  IconButton,
  RefreshControl,
  XStack,
  YStack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import type { EPageType } from '@onekeyhq/components';
import {
  useSwapFromTokenAmountAtom,
  useSwapProErrorAlertAtom,
  useSwapProInputAmountAtom,
  useSwapProSelectTokenAtom,
  useSwapProStockQuoteErrorMarketDetailSettledRequestIdAtom,
  useSwapProTokenMarketDetailActivationStateAtom,
  useSwapProTokenMarketDetailInfoAtom,
  useSwapProTokenMarketDetailPerpsInfoAtom,
  useSwapProTradeTypeAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSpeedQuoteResultAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  StockMarketStatusAlert,
  getStockMarketClosedDescription,
  resolveStockMarketStatusCase,
} from '@onekeyhq/kit/src/views/Market/components/StockMarketStatusAlert';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketBasicConfigNetwork } from '@onekeyhq/shared/types/marketV2';
import type {
  IFetchLimitOrderRes,
  IFetchQuoteResult,
  ISwapProSpeedConfig,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapProTradeType,
} from '@onekeyhq/shared/types/swap/types';

import {
  estimateMarketPresetGasFeeFiatValues,
  resolveMarketPresetNativeTokenPrice,
} from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/marketDirectSendTx';
import SwapProErrorAlert from '../../components/SwapProErrorAlert';
import {
  useSwapPositionsSupportTokenListAction,
  useSwapProInputToken,
  useSwapProToToken,
  useSwapProTokenDetailInfo,
  useSwapProTokenInfoSync,
} from '../../hooks/useSwapPro';
import { SwapTestIDs } from '../../testIDs';
import {
  isSelectedProStockMarketClosed,
  isSelectedProStockMarketDetailActivationSettled,
  isSelectedProStockMarketDetailAuthoritative,
  isSelectedProStockTradingPaused,
  shouldDeferSelectedProStockQuoteErrorAlert,
} from '../../utils/swapProStockMarketClosed';

import SwapProTabListContainer from './SwapProTabListContainer';
import SwapProTokenSelector from './SwapProTokenSelect';
import SwapProTradeInfoPanel from './SwapProTradeInfoPanel';
import SwapProTradingPanel from './SwapProTradingPanel';
import SwapTipsContainer from './SwapTipsContainer';

import type {
  IEstimateMarketPresetPriorityFeeFiatValues,
  IMarketPresetPriorityFeeFiatEstimateMap,
} from '../../../Market/MarketDetailV2/components/SwapPanel/components/MarketPresetSelector';
import type { IMarketPresetSettingsState } from '../../../Market/MarketDetailV2/components/SwapPanel/hooks/useMarketPresetSettings';

interface ISwapProContainerProps {
  pageType?: EPageType;
  onProSelectToken: (autoSearch?: boolean) => void;
  onOpenOrdersClick: (item: IFetchLimitOrderRes) => void;
  onSwapProActionClick: () => void;
  handleSelectAccountClick: () => void;
  onProMarketDetail: () => void;
  onSelectPercentageStage: (stage: number) => void;
  onBalanceMaxPress: () => void;
  onTokenPress: (token: ISwapToken) => void;
  supportNetworksList: IMarketBasicConfigNetwork[];
  supportNetworksReady: boolean;
  marketPresetSettings?: IMarketPresetSettingsState;
  config: {
    isLoading: boolean;
    speedConfigReady: boolean;
    speedConfig: ISwapProSpeedConfig;
    balanceLoading: boolean;
    supportSpeedSwap?: boolean;
    isMEV?: boolean;
    hasEnoughBalance: boolean;
  };
}

const SwapProContainer = ({
  pageType,
  onProSelectToken,
  onOpenOrdersClick,
  onSwapProActionClick,
  handleSelectAccountClick,
  onProMarketDetail,
  onBalanceMaxPress,
  onSelectPercentageStage,
  onTokenPress,
  supportNetworksList,
  supportNetworksReady,
  marketPresetSettings,
  config,
}: ISwapProContainerProps) => {
  const intl = useIntl();
  const {
    isLoading,
    speedConfigReady,
    speedConfig,
    balanceLoading,
    isMEV,
    hasEnoughBalance,
    supportSpeedSwap,
  } = config;
  const [refreshing, setRefreshing] = useState(false);
  const [limitPriceUseMarketPrice, setLimitPriceUseMarketPrice] = useState({
    value: '',
    change: false,
  });
  const [swapProInputAmount, setSwapProInputAmount] =
    useSwapProInputAmountAtom();
  const [, setFromInputAmount] = useSwapFromTokenAmountAtom();
  const tabBarHeight = useScrollContentTabBarOffset();
  const scrollViewRef = useRef<ScrollView>(null);
  const { fetchTokenMarketDetailInfo } = useSwapProTokenDetailInfo();
  const [swapProErrorAlert] = useSwapProErrorAlertAtom();
  // Pro-mode stock market-closed alert (reuses the shared StockMarketStatusAlert).
  // Pro keeps its own token detail/perps atoms, so read those here. When the
  // stock market is closed we show the standard alert instead of the generic
  // error alert; the action button is already disabled (no valid quote).
  const [proTokenDetail] = useSwapProTokenMarketDetailInfoAtom();
  const [proTokenDetailActivationState] =
    useSwapProTokenMarketDetailActivationStateAtom();
  const [proPerpsInfo] = useSwapProTokenMarketDetailPerpsInfoAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [stockQuoteErrorMarketDetailSettledRequestId] =
    useSwapProStockQuoteErrorMarketDetailSettledRequestIdAtom();
  const [swapQuoteResult] = useSwapQuoteCurrentSelectAtom();
  const [swapProQuoteResult] = useSwapSpeedQuoteResultAtom();
  const { navigateToPerps } = usePerpsNavigation(
    EPerpPageEnterSource.SwapProStockClosed,
  );
  const proStockHlTicker = proPerpsInfo?.hlTicker;
  const proStockHasPerps = Boolean(proStockHlTicker);
  const proStockClosedTimeText = getStockMarketClosedDescription(
    proTokenDetail?.stock?.description,
  );
  // Guard on the selected token so a stale Pro detail (the detail atom is not
  // cleared on token switch) can't drive the closed alert for another token.
  const isProStockMarketDetailAuthoritative =
    isSelectedProStockMarketDetailAuthoritative(
      proTokenDetail,
      proTokenDetailActivationState,
      swapProSelectToken,
    );
  const isProStockMarketClosed =
    isProStockMarketDetailAuthoritative &&
    isSelectedProStockMarketClosed(proTokenDetail, swapProSelectToken);
  const [swapProTradeType] = useSwapProTradeTypeAtom();
  const currentQuoteResult =
    swapProTradeType === ESwapProTradeType.MARKET
      ? swapProQuoteResult
      : swapQuoteResult;
  const currentQuoteErrorMessage = currentQuoteResult?.errorMessage?.trim();
  const isProStockTrade =
    swapProSelectToken?.isStock === true ||
    currentQuoteResult?.protocol === EProtocolOfExchange.STOCK;
  const reconciledStockQuoteResultRef = useRef<IFetchQuoteResult | undefined>(
    undefined,
  );
  useEffect(() => {
    if (
      !isProStockTrade ||
      !currentQuoteErrorMessage ||
      stockQuoteErrorMarketDetailSettledRequestId === undefined
    ) {
      reconciledStockQuoteResultRef.current = undefined;
      return;
    }
    if (reconciledStockQuoteResultRef.current === currentQuoteResult) {
      return;
    }
    reconciledStockQuoteResultRef.current = currentQuoteResult;
    // Resolve every Stock quote error against a fresh Market detail once.
    // Closed/paused errors become the enriched alert; all other errors remain
    // normal quote errors and are not re-quoted on every polling tick.
    void fetchTokenMarketDetailInfo();
  }, [
    currentQuoteErrorMessage,
    currentQuoteResult,
    fetchTokenMarketDetailInfo,
    isProStockTrade,
    stockQuoteErrorMarketDetailSettledRequestId,
  ]);
  const isProStockTradingPaused =
    isProStockMarketDetailAuthoritative &&
    isSelectedProStockTradingPaused(proTokenDetail, swapProSelectToken);
  const isCurrentMarketDetailActivationSettled =
    isSelectedProStockMarketDetailActivationSettled(
      proTokenDetailActivationState,
      swapProSelectToken,
    );
  const marketDetailReconciled =
    stockQuoteErrorMarketDetailSettledRequestId === undefined
      ? isCurrentMarketDetailActivationSettled
      : isCurrentMarketDetailActivationSettled &&
        proTokenDetailActivationState.lastSettledRequestId >
          stockQuoteErrorMarketDetailSettledRequestId;
  const shouldWaitForProStockMarketDetail =
    shouldDeferSelectedProStockQuoteErrorAlert({
      hasAuthoritativeMarketRestriction:
        isProStockMarketClosed || isProStockTradingPaused,
      isStockTrade: isProStockTrade,
      marketDetailReconciled,
      quoteErrorMessage: currentQuoteResult?.errorMessage,
      visibleAlertTitle: swapProErrorAlert?.title,
    });
  const [settingsAtom] = useSettingsPersistAtom();
  const { syncInputTokenBalance, syncToTokenPrice, netAccountRes } =
    useSwapProTokenInfoSync();
  const inputToken = useSwapProInputToken();
  const toToken = useSwapProToToken();
  const { swapProLoadSupportNetworksTokenListRun } =
    useSwapPositionsSupportTokenListAction();
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchTokenMarketDetailInfo(),
        supportNetworksReady
          ? swapProLoadSupportNetworksTokenListRun(supportNetworksList, {
              forceRefresh: true,
            })
          : Promise.resolve(),
        syncInputTokenBalance(),
        syncToTokenPrice(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    fetchTokenMarketDetailInfo,
    swapProLoadSupportNetworksTokenListRun,
    syncInputTokenBalance,
    syncToTokenPrice,
    supportNetworksList,
    supportNetworksReady,
  ]);
  const cleanInputAmount = useCallback(() => {
    setSwapProInputAmount('');
    setFromInputAmount({
      value: '',
      isInput: true,
    });
  }, [setSwapProInputAmount, setFromInputAmount]);

  const onSearchClickCallback = useCallback(() => {
    onProSelectToken(true);
    scrollViewRef.current?.scrollTo({
      y: 0,
      animated: false,
    });
  }, [onProSelectToken]);

  const onTokenPressCallback = useCallback(
    (token: ISwapToken) => {
      onTokenPress(token);
      scrollViewRef.current?.scrollTo({
        y: 0,
        animated: true,
      });
    },
    [onTokenPress],
  );

  const showMarketPresetSelector =
    swapProTradeType === ESwapProTradeType.MARKET &&
    !!marketPresetSettings?.enabled;
  const estimatePriorityFeeFiatValues =
    useCallback<IEstimateMarketPresetPriorityFeeFiatValues>(
      async ({ items }) => {
        const estimates: IMarketPresetPriorityFeeFiatEstimateMap = {};
        const accountAddress =
          netAccountRes.result?.addressDetail.address ?? '';
        const accountId = netAccountRes.result?.id ?? '';
        const networkId = inputToken?.networkId ?? '';

        if (!accountAddress || !accountId || !networkId || !inputToken) {
          items.forEach((item) => {
            estimates[item.type] = undefined;
          });
          return estimates;
        }

        const nativeTokenPrice = await resolveMarketPresetNativeTokenPrice({
          networkId,
          currencyId: settingsAtom.currencyInfo.id,
          tokens: [inputToken, toToken],
        });

        const feeValues = await estimateMarketPresetGasFeeFiatValues({
          accountAddress,
          accountId,
          amount: swapProInputAmount,
          networkId,
          nativeTokenPrice,
          token: inputToken,
          items: items.map((item) => ({
            customPriorityFee: item.customPriorityFee,
            networkFeeLevel: item.networkFeeLevel,
          })),
        });

        items.forEach((item, index) => {
          estimates[item.type] = feeValues[index];
        });

        return estimates;
      },
      [
        inputToken,
        netAccountRes.result?.addressDetail.address,
        netAccountRes.result?.id,
        settingsAtom.currencyInfo.id,
        swapProInputAmount,
        toToken,
      ],
    );
  let proAlert: ReactNode = null;
  if (isProStockTradingPaused) {
    proAlert = (
      <Alert
        type="warning"
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.market_status_halted,
        })}
        description={intl.formatMessage({
          id: ETranslations.trading_hours_trading_halts_description,
        })}
      />
    );
  } else if (isProStockMarketClosed) {
    proAlert = (
      <StockMarketStatusAlert
        statusCase={resolveStockMarketStatusCase({
          isOpen: false,
          hasOpenTime: Boolean(proStockClosedTimeText),
          hasPerps: proStockHasPerps,
        })}
        timeText={proStockClosedTimeText}
        onTradePerps={
          proStockHlTicker ? () => navigateToPerps(proStockHlTicker) : undefined
        }
      />
    );
  } else if (
    !shouldWaitForProStockMarketDetail &&
    (swapProErrorAlert?.source !== 'quote' ||
      (currentQuoteErrorMessage &&
        swapProErrorAlert.title.trim() === currentQuoteErrorMessage))
  ) {
    proAlert = (
      <SwapProErrorAlert
        title={swapProErrorAlert?.title}
        message={swapProErrorAlert?.message}
      />
    );
  }

  return (
    <ScrollView
      testID={SwapTestIDs.proContainer}
      style={{ flex: 1 }}
      ref={scrollViewRef}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: tabBarHeight,
      }}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[1]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <YStack mx="$-5">
        <SwapTipsContainer pageType={pageType} />
      </YStack>
      <XStack
        justifyContent="space-between"
        pb="$2"
        pt="$2"
        alignItems="center"
        bg="$bgApp"
      >
        <SwapProTokenSelector
          onSelectTokenClick={() => {
            cleanInputAmount();
            onProSelectToken();
          }}
          configLoading={isLoading}
        />
        {/* On mobile this candlestick button moved up into the top header
            capsule (SwapProKLineHeaderButton); keep it inline on desktop. */}
        {platformEnv.isNative ? null : (
          <IconButton
            testID="swap-icon-btn"
            icon="TradingViewCandlesOutline"
            variant="tertiary"
            flexShrink={0}
            onPress={onProMarketDetail}
          />
        )}
      </XStack>
      <XStack mt="$2" gap="$4" pb="$2.5" alignItems="stretch">
        <YStack flexBasis="40%" flexShrink={1} alignSelf="stretch">
          <SwapProTradeInfoPanel
            supportSpeedSwap={supportSpeedSwap}
            onPricePress={(price) => {
              if (swapProTradeType === ESwapProTradeType.LIMIT) {
                setLimitPriceUseMarketPrice((prev) => ({
                  value: price,
                  change: !prev.change,
                }));
              }
            }}
          />
        </YStack>
        <YStack flexBasis="60%" flexShrink={1} alignSelf="stretch">
          <SwapProTradingPanel
            supportSpeedSwap={!!supportSpeedSwap}
            swapProConfig={speedConfig}
            configLoading={isLoading}
            configReady={speedConfigReady}
            balanceLoading={balanceLoading}
            limitPriceUseMarketPrice={limitPriceUseMarketPrice}
            onBalanceMax={onBalanceMaxPress}
            onSelectPercentageStage={onSelectPercentageStage}
            onSwapProActionClick={onSwapProActionClick}
            hasEnoughBalance={hasEnoughBalance}
            handleSelectAccountClick={handleSelectAccountClick}
            cleanInputAmount={cleanInputAmount}
            marketPresetSettings={marketPresetSettings}
            showMarketPresetSelector={showMarketPresetSelector}
            antiMEV={isMEV}
            estimatePriorityFeeFiatValues={estimatePriorityFeeFiatValues}
          />
        </YStack>
      </XStack>
      {proAlert}
      <SwapProTabListContainer
        onTokenPress={onTokenPressCallback}
        onOpenOrdersClick={onOpenOrdersClick}
        onSearchClick={onSearchClickCallback}
        supportNetworksList={supportNetworksList}
        supportNetworksReady={supportNetworksReady}
      />
    </ScrollView>
  );
};

export default SwapProContainer;
