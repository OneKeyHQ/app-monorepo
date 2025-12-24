import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  DebugRenderTracker,
  Divider,
  Popover,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  useHyperliquidActions,
  useOrderBookTickOptionsAtom,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAssetAtom,
  usePerpsActiveAssetCtxAtom,
  usePerpsShouldShowEnableTradingButtonAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useFundingCountdown } from '../hooks/useFundingCountdown';
import { useL2Book } from '../hooks/usePerpMarketData';
import { usePerpSession } from '../hooks/usePerpSession';

import {
  type IOrderBookSelection,
  OrderBook,
  OrderBookMobile,
} from './OrderBook';
import { DefaultLoadingNode } from './OrderBook/DefaultLoadingNode';
import { useTickOptions } from './OrderBook/useTickOptions';

import type { ITickParam } from './OrderBook/tickSizeUtils';
import type { IOrderBookVariant } from './OrderBook/types';

function MobileHeader() {
  const intl = useIntl();
  const countdown = useFundingCountdown();
  const { isReady, hasError } = usePerpSession();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();

  const { fundingRate, markPrice } = assetCtx?.ctx || {
    fundingRate: '0',
    markPrice: '0',
  };
  const fundingRateNumber = parseFloat(fundingRate);
  const hasFundingValue = Number.isFinite(fundingRateNumber);
  const fundingColor = useMemo(() => {
    if (!hasFundingValue) {
      return '$textSubdued';
    }
    return fundingRateNumber >= 0 ? '$green11' : '$red11';
  }, [fundingRateNumber, hasFundingValue]);

  const fundingDisplay = hasFundingValue
    ? `${(fundingRateNumber * 100).toFixed(4)}%`
    : '--';
  const markPriceNumber = parseFloat(markPrice);
  const showSkeleton =
    !isReady ||
    hasError ||
    !Number.isFinite(markPriceNumber) ||
    markPriceNumber === 0;

  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.perp_position_funding,
      })}
      renderTrigger={
        <YStack alignItems="flex-start" mb="$2" h={32} justifyContent="center">
          <DashText
            fontSize={10}
            color="$textSubdued"
            dashColor="$textSubdued"
            dashThickness={0.5}
            lineHeight={16}
          >
            {intl.formatMessage({
              id: ETranslations.perp_token_bar_Funding,
            })}
          </DashText>

          {showSkeleton ? (
            <Skeleton width={180} height={14} radius="round" />
          ) : (
            <XStack alignItems="center" gap={6}>
              <SizableText size="$bodySmMedium" color={fundingColor}>
                {fundingDisplay}
              </SizableText>
              <SizableText size="$bodySmMedium" color="$text">
                {countdown}
              </SizableText>
            </XStack>
          )}
        </YStack>
      }
      renderContent={
        <YStack
          bg="$bg"
          justifyContent="center"
          w="100%"
          px="$5"
          pt="$2"
          pb="$5"
          gap="$5"
        >
          <XStack alignItems="center" justifyContent="space-between">
            <YStack w="50%">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_token_bar_Funding,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium" color={fundingColor}>
                {fundingDisplay}
              </SizableText>
            </YStack>
            <YStack w="50%">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_ticker_annualized_funding_tooltip,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium" color={fundingColor}>
                {(parseFloat(fundingRate) * 100 * 24 * 365).toFixed(2)}%
              </SizableText>
            </YStack>
          </XStack>
          <XStack alignItems="center" justifyContent="space-between">
            <YStack w="50%">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_trades_history_direction,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium" color={fundingColor}>
                {parseFloat(fundingRate) >= 0 ? (
                  <SizableText size="$bodySmMedium" color="$text">
                    <SizableText size="$bodySmMedium" color="$green11">
                      {intl.formatMessage({
                        id: ETranslations.perp_ticker_direction_funding_tooltip_long,
                      })}
                    </SizableText>{' '}
                    {intl.formatMessage({
                      id: ETranslations.perp_ticker_direction_funding_tooltip_pays,
                    })}{' '}
                    <SizableText size="$bodySmMedium" color="$red11">
                      {intl.formatMessage({
                        id: ETranslations.perp_ticker_direction_funding_tooltip_short,
                      })}
                    </SizableText>
                  </SizableText>
                ) : (
                  <SizableText size="$bodySmMedium" color="$text">
                    <SizableText size="$bodySmMedium" color="$red11">
                      {intl.formatMessage({
                        id: ETranslations.perp_ticker_direction_funding_tooltip_short,
                      })}
                    </SizableText>{' '}
                    {intl.formatMessage({
                      id: ETranslations.perp_ticker_direction_funding_tooltip_pays,
                    })}{' '}
                    <SizableText size="$bodySmMedium" color="$green11">
                      {intl.formatMessage({
                        id: ETranslations.perp_ticker_direction_funding_tooltip_long,
                      })}
                    </SizableText>
                  </SizableText>
                )}
              </SizableText>
            </YStack>
            <YStack w="50%">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_funding_countdown,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">{countdown}</SizableText>
            </YStack>
          </XStack>
          <Divider />
          <YStack gap="$2">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_funding_rate_tip0,
              })}
            </SizableText>
            <SizableText size="$bodySmMedium">
              {intl.formatMessage({
                id: ETranslations.perp_funding_rate_tip1,
              })}
            </SizableText>
            <SizableText size="$bodySmMedium">
              {intl.formatMessage({
                id: ETranslations.perp_funding_rate_tip2,
              })}
            </SizableText>
          </YStack>
        </YStack>
      }
    />
  );
}
const MobileHeaderMemo = memo(MobileHeader);

export function PerpOrderBook({
  entry,
  maxLevelsPerSide: propMaxLevelsPerSide,
}: {
  entry?: 'perpTab' | 'perpMobileMarket';
  maxLevelsPerSide?: number;
}) {
  const { gtMd } = useMedia();
  const actionsRef = useHyperliquidActions();
  const [formData] = useTradingFormAtom();
  const [orderBookTickOptions] = useOrderBookTickOptionsAtom();
  const [perpsSelectedSymbol] = usePerpsActiveAssetAtom();
  const [shouldShowEnableTradingButton] =
    usePerpsShouldShowEnableTradingButtonAtom();

  const l2SubscriptionOptions = useMemo(() => {
    const coin = perpsSelectedSymbol?.coin;
    if (!coin) {
      return { nSigFigs: null, mantissa: undefined };
    }
    const stored = orderBookTickOptions[coin];
    const nSigFigs = stored?.nSigFigs ?? null;
    const mantissa =
      stored?.mantissa === undefined ? undefined : stored.mantissa;
    return { nSigFigs, mantissa };
  }, [orderBookTickOptions, perpsSelectedSymbol?.coin]);

  const { l2Book, hasOrderBook } = useL2Book({
    nSigFigs: l2SubscriptionOptions.nSigFigs,
    mantissa: l2SubscriptionOptions.mantissa,
  });

  const tickOptionsData = useTickOptions({
    symbol: l2Book?.coin,
    bids: l2Book?.bids ?? [],
    asks: l2Book?.asks ?? [],
  });
  const {
    tickOptions,
    selectedTickOption,
    setSelectedTickOption,
    priceDecimals,
    sizeDecimals,
  } = tickOptionsData;

  const handleTickOptionChange = useCallback(
    (option: ITickParam) => {
      setSelectedTickOption(option);
    },
    [setSelectedTickOption],
  );

  const handleLevelSelect = useCallback(
    (selection: IOrderBookSelection) => {
      const updates: Partial<ITradingFormData> = {
        price: selection.price,
      };

      if (formData.type !== 'limit') {
        updates.type = 'limit';
      }

      actionsRef.current.updateTradingForm(updates);
    },
    [actionsRef, formData.type],
  );

  const mobileMaxLevelsPerSide = useMemo(() => {
    if (shouldShowEnableTradingButton) return 5;
    if (formData.hasTpsl) return 9;
    return 7;
  }, [formData.hasTpsl, shouldShowEnableTradingButton]);

  const desktopMaxLevelsPerSide = useMemo(
    () => propMaxLevelsPerSide ?? 11,
    [propMaxLevelsPerSide],
  );

  const mobileOrderBook = useMemo(() => {
    if (!hasOrderBook || !l2Book) return null;
    if (gtMd) return null;
    if (entry === 'perpMobileMarket') {
      return (
        <OrderBook
          horizontal
          symbol={l2Book.coin}
          bids={l2Book.bids}
          asks={l2Book.asks}
          maxLevelsPerSide={13}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={handleLevelSelect}
          loadingNode={<DefaultLoadingNode variant="mobileHorizontal" />}
          variant="mobileHorizontal"
        />
      );
    }
    return (
      <YStack gap="$1">
        <MobileHeaderMemo />
        <OrderBookMobile
          symbol={l2Book.coin}
          bids={l2Book.bids}
          asks={l2Book.asks}
          maxLevelsPerSide={mobileMaxLevelsPerSide}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={handleLevelSelect}
          variant="mobileVertical"
        />
      </YStack>
    );
  }, [
    entry,
    gtMd,
    handleTickOptionChange,
    l2Book,
    handleLevelSelect,
    selectedTickOption,
    hasOrderBook,
    mobileMaxLevelsPerSide,
    tickOptions,
    priceDecimals,
    sizeDecimals,
  ]);

  if (!hasOrderBook || !l2Book) {
    let loadingVariant = 'desktop';
    if (!gtMd) {
      loadingVariant =
        entry === 'perpMobileMarket' ? 'mobileHorizontal' : 'mobileVertical';
    }
    return (
      <YStack flex={1} p="$2" justifyContent="center" alignItems="center">
        <DefaultLoadingNode
          variant={loadingVariant as IOrderBookVariant}
          symbol={
            loadingVariant === 'mobileVertical' ? l2Book?.coin : undefined
          }
        />
      </YStack>
    );
  }

  const content = (
    <YStack flex={1} bg="$bgApp">
      {gtMd ? (
        <OrderBook
          symbol={l2Book.coin}
          horizontal={false}
          bids={l2Book.bids}
          asks={l2Book.asks}
          maxLevelsPerSide={desktopMaxLevelsPerSide}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={handleLevelSelect}
          variant="web"
        />
      ) : (
        mobileOrderBook
      )}
    </YStack>
  );
  return (
    <DebugRenderTracker name="PerpOrderBook" position="top-left">
      {content}
    </DebugRenderTracker>
  );
}
