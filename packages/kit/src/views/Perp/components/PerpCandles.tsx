import {
  Button,
  ScrollView,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { CANDLE_INTERVALS, useCandles } from '../hooks/usePerpMarketData';

interface ICandleRowProps {
  candle: ICandle;
  index: number;
}

function CandleRow({ candle, index }: ICandleRowProps) {
  const isGreen = parseFloat(candle.c) >= parseFloat(candle.o);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(2);
  };

  return (
    <XStack
      py="$1.5"
      px="$2"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      bg={index % 2 === 0 ? '$bgSubdued' : 'transparent'}
    >
      <SizableText size="$bodySm" color="$textSubdued" width={60}>
        {formatTime(candle.t)}
      </SizableText>

      <SizableText size="$bodySm" color="$text" width={80} textAlign="right">
        {formatPrice(candle.o)}
      </SizableText>

      <SizableText
        size="$bodySm"
        color="$textSuccess"
        width={80}
        textAlign="right"
      >
        {formatPrice(candle.h)}
      </SizableText>

      <SizableText
        size="$bodySm"
        color="$textCritical"
        width={80}
        textAlign="right"
      >
        {formatPrice(candle.l)}
      </SizableText>

      <SizableText
        size="$bodySm"
        color={isGreen ? '$textSuccess' : '$textCritical'}
        width={80}
        textAlign="right"
        fontWeight="600"
      >
        {formatPrice(candle.c)}
      </SizableText>

      <SizableText
        size="$bodySm"
        color="$textSubdued"
        flex={1}
        textAlign="right"
      >
        {parseFloat(candle.v).toFixed(1)}
      </SizableText>
    </XStack>
  );
}

export function PerpCandles() {
  const {
    candles,
    isLoading,
    error,
    currentInterval,
    changeInterval,
    refreshHistory,
    currentPrice,
    priceChange24h,
  } = useCandles();

  if (error) {
    return (
      <YStack flex={1} p="$4" justifyContent="center" alignItems="center">
        <SizableText size="$bodyMd" color="$textCritical" textAlign="center">
          Failed to load candles data
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          textAlign="center"
          mt="$2"
        >
          {error}
        </SizableText>
        <Button size="small" onPress={refreshHistory} mt="$3">
          <SizableText size="$bodySm">Retry</SizableText>
        </Button>
      </YStack>
    );
  }

  return (
    <YStack flex={1} bg="$bgApp">
      <XStack
        p="$3"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        justifyContent="space-between"
        alignItems="center"
      >
        <YStack>
          <SizableText size="$headingSm" fontWeight="600">
            Price Chart
          </SizableText>
          {currentPrice ? (
            <XStack space="$2" alignItems="center" mt="$1">
              <SizableText size="$bodyLg" fontWeight="700">
                ${currentPrice}
              </SizableText>
              {priceChange24h !== null ? (
                <SizableText
                  size="$bodySm"
                  color={priceChange24h >= 0 ? '$textSuccess' : '$textCritical'}
                  bg={priceChange24h >= 0 ? '$green3' : '$red3'}
                  px="$2"
                  py="$1"
                  borderRadius="$2"
                >
                  {priceChange24h >= 0 ? '+' : ''}
                  {priceChange24h.toFixed(2)}%
                </SizableText>
              ) : null}
            </XStack>
          ) : null}
        </YStack>

        <XStack space="$2">
          <Button
            size="small"
            variant="secondary"
            onPress={refreshHistory}
            disabled={isLoading}
          >
            <SizableText size="$bodySm">Refresh</SizableText>
          </Button>
        </XStack>
      </XStack>

      <XStack
        p="$2"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        space="$1"
      >
        <SizableText size="$bodySm" color="$textSubdued" py="$2" pr="$2">
          Interval:
        </SizableText>
        {CANDLE_INTERVALS.map((interval) => (
          <Button
            key={interval.value}
            size="small"
            variant={
              currentInterval.value === interval.value ? 'primary' : 'secondary'
            }
            onPress={() => changeInterval(interval)}
            disabled={isLoading}
          >
            {interval.label}
          </Button>
        ))}
      </XStack>

      <XStack
        px="$2"
        py="$2"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        bg="$bgSubdued"
      >
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          fontWeight="600"
          width={60}
        >
          Time
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          fontWeight="600"
          width={80}
          textAlign="right"
        >
          Open
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          fontWeight="600"
          width={80}
          textAlign="right"
        >
          High
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          fontWeight="600"
          width={80}
          textAlign="right"
        >
          Low
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          fontWeight="600"
          width={80}
          textAlign="right"
        >
          Close
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          fontWeight="600"
          flex={1}
          textAlign="right"
        >
          Volume
        </SizableText>
      </XStack>

      <ScrollView flex={1}>
        {isLoading && candles.length === 0 ? (
          <YStack space="$2" p="$3">
            {Array.from({ length: 10 }).map((_, index) => (
              <XStack key={index} space="$2">
                <Skeleton width={60} height={20} />
                <Skeleton width={80} height={20} />
                <Skeleton width={80} height={20} />
                <Skeleton width={80} height={20} />
                <Skeleton width={80} height={20} />
                <Skeleton flex={1} height={20} />
              </XStack>
            ))}
          </YStack>
        ) : null}
        {!isLoading && candles.length === 0 ? (
          <YStack flex={1} justifyContent="center" alignItems="center" p="$6">
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
              No candles data available
            </SizableText>
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              textAlign="center"
              mt="$2"
            >
              Data will appear here after loading
            </SizableText>
          </YStack>
        ) : null}
        {candles.length > 0 ? (
          <YStack>
            {candles
              .slice()
              .reverse()
              .slice(0, 100)
              .map((candle, index) => (
                <CandleRow
                  key={`${String(candle.t)}-${index}`}
                  candle={candle}
                  index={index}
                />
              ))}
          </YStack>
        ) : null}
      </ScrollView>

      {candles.length > 0 ? (
        <XStack
          p="$2"
          borderTopWidth="$px"
          borderTopColor="$borderSubdued"
          justifyContent="space-between"
          bg="$bgSubdued"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            Total: {candles.length} candles
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            Current: {currentInterval.label}
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
}
