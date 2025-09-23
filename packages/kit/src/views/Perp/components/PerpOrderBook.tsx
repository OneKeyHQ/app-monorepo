import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import {
  useCurrentTokenPriceAtom,
  useHyperliquidActions,
  useOrderBookTickOptionsAtom,
  useTradingFormAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { ITradingFormData } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsSelectedSymbolAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useFundingCountdown } from '../hooks/useFundingCountdown';
import { useL2Book } from '../hooks/usePerpMarketData';
import { usePerpSession } from '../hooks/usePerpSession';

import {
  type IOrderBookSelection,
  OrderBook,
  OrderBookMobile,
} from './OrderBook';
import { useTickOptions } from './OrderBook/useTickOptions';

import type { ITickParam } from './OrderBook/tickSizeUtils';

function MobileHeader() {
  const intl = useIntl();
  const countdown = useFundingCountdown();
  const { isReady, hasError } = usePerpSession();
  const [priceData] = useCurrentTokenPriceAtom();

  const { funding: fundingRate, markPrice } = priceData;
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
    <YStack alignItems="flex-start" mb="$2" h={32} justifyContent="center">
      <SizableText fontSize={10} color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.perp_token_bar_Funding,
        })}
      </SizableText>
      {showSkeleton ? (
        <Skeleton width={120} height={16} />
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
  );
}
const MobileHeaderMemo = memo(MobileHeader);

export function PerpOrderBook({
  entry,
}: {
  entry?: 'perpTab' | 'perpMobileMarket';
}) {
  const { gtMd } = useMedia();
  const actionsRef = useHyperliquidActions();
  const [formData] = useTradingFormAtom();
  const [orderBookTickOptions] = useOrderBookTickOptionsAtom();
  const [perpsSelectedSymbol] = usePerpsSelectedSymbolAtom();

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
          maxLevelsPerSide={formData.hasTpsl ? 8 : 6}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={handleLevelSelect}
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
    formData.hasTpsl,
    tickOptions,
    priceDecimals,
    sizeDecimals,
  ]);

  if (!hasOrderBook || !l2Book) {
    return (
      <YStack flex={1} p="$4" justifyContent="center" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          Loading order book...
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack flex={1} bg="$bgApp">
      {gtMd ? (
        <OrderBook
          symbol={l2Book.coin}
          horizontal={false}
          bids={l2Book.bids}
          asks={l2Book.asks}
          maxLevelsPerSide={12}
          selectedTickOption={selectedTickOption}
          onTickOptionChange={handleTickOptionChange}
          tickOptions={tickOptions}
          showTickSelector
          priceDecimals={priceDecimals}
          sizeDecimals={sizeDecimals}
          onSelectLevel={handleLevelSelect}
        />
      ) : (
        mobileOrderBook
      )}
    </YStack>
  );
}
