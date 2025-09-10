import { useMemo } from 'react';

import { colorTokens } from '@tamagui/themes';
import { StyleSheet, Text, View } from 'react-native';

import type { IXStackProps } from '@onekeyhq/components';
import {
  SizableText,
  XStack,
  YStack,
  useTheme,
  useThemeName,
} from '@onekeyhq/components';
import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { DefaultLoadingNode } from './DefaultLoadingNode';
import { useAggregatedBook } from './useAggregatedBook';
import { getMidPrice } from './utils';

import type { IOBLevel } from './types';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

export const rowHeight = 24;

export const defaultMidPriceNode = (midPrice: number) => (
  <Text formatter="balance">{midPrice}</Text>
);

interface IOBAggregation {
  /** The natural tick size of this instrument */
  baseTickSize: number;
  /** The currently selected tick size */
  tickSize: number;
  /** The possible tick sizes the user can select. You can omit
   * this and `onTickSizeChange` if you don't want aggregation
   * controls to be rendered */
  tickSizes?: number[];
  /** Called when a user selects another aggregation */
  onTickSizeChange?: (nextTickSize: number) => void;
}

interface IOrderBookProps {
  /** The sorted best to worst (high to low) bid levels */
  bids: IBookLevel[];
  /** The sorted best to worst (low to high) ask levels */
  asks: IBookLevel[];
  /** The maximum price levels to render per side */
  maxLevelsPerSide?: number;
  /** Styles for the container (outer) view */
  style?: StyleProp<ViewStyle>;
  /** A function which receives the mid price and can return a
   * custom mid price node */
  midPriceNode?: (midPrice: number) => React.ReactNode;
  /** A custom loading node. Defaults to "Loading...". */
  loadingNode?: React.ReactNode;
  /** Whether to render the order book horizontally */
  horizontal?: boolean;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
  columns: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  levelList: {
    flexGrow: 1,
  },
  row: {
    height: rowHeight,
    alignItems: 'center',
    marginTop: 1,
    position: 'relative',
  },
  cell: {
    position: 'relative',
    paddingHorizontal: 8,
    flex: 1,
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});

type IColorBlockProps = {
  color: string;
  width: DimensionValue;
  left?: number;
  right?: number;
};

function ColorBlock({ color, width, left, right }: IColorBlockProps) {
  return (
    <View
      style={{
        position: 'absolute',
        right,
        left,
        height: rowHeight,
        width,
        backgroundColor: color,
      }}
    />
  );
}

function OrderBookVerticalRow({ item }: { item: IOBLevel }) {
  return (
    <XStack flex={1} px="$3" jc="space-between" disableClassName>
      <XStack width="33.33%">
        <Text
          fontFamily="$monoRegular"
          color="$textSubdued"
          formatter="marketCap"
          disableOptimization
          disableClassName
        >
          {item.price}
        </Text>
      </XStack>
      <XStack width="33.33%" disableClassName>
        <Text
          disableOptimization
          disableClassName
          flex={1}
          fontFamily="$monoRegular"
          color="$textSubdued"
          formatter="marketCap"
          textAlign="center"
        >
          {item.size}
        </Text>
      </XStack>
      <XStack width="33.33%">
        <Text
          flex={1}
          textAlign="right"
          fontFamily="$monoRegular"
          color="$textSubdued"
          formatter="marketCap"
          disableOptimization
          disableClassName
        >
          {item.cumSize}
        </Text>
      </XStack>
    </XStack>
  );
}

const useBlockColors = () => {
  const theme = useThemeName();
  return useMemo(() => {
    return {
      red: colorTokens[theme].red.red3,
      green: colorTokens[theme].green.green3,
    };
  }, [theme]);
};

export function OrderBook({
  bids,
  asks,
  maxLevelsPerSide = 30,
  style,
  midPriceNode = defaultMidPriceNode,
  loadingNode = <DefaultLoadingNode />,
  horizontal = true,
}: IOrderBookProps) {
  const aggregatedData = useAggregatedBook(
    bids,
    asks,
    0.01,
    0.1,
    maxLevelsPerSide,
  );
  const isEmpty = !aggregatedData.bids.length && !aggregatedData.asks.length;

  const midPrice = getMidPrice(
    parseFloat(bids[0]?.px ?? '0'),
    parseFloat(asks[0]?.px ?? '0'),
  );

  const bidDepth = aggregatedData.bids.at(-1)?.cumSize ?? 0;
  const askDepth = aggregatedData.asks.at(-1)?.cumSize ?? 0;

  const blockColors = useBlockColors();

  if (horizontal) {
    return (
      <View style={[styles.container, style]}>
        <XStack gap="$1" h="$4" ai="center">
          <XStack flex={1} jc="space-between">
            <SizableText size="$bodySmMedium" color="$textSubdued">
              SIZE
            </SizableText>
            <SizableText size="$bodySmMedium" color="$textSubdued">
              BUY
            </SizableText>
          </XStack>
          <XStack flex={1} jc="space-between">
            <SizableText size="$bodySmMedium" color="$textSubdued">
              SELL
            </SizableText>
            <SizableText size="$bodySmMedium" color="$textSubdued">
              SIZE
            </SizableText>
          </XStack>
        </XStack>
        {isEmpty ? (
          loadingNode
        ) : (
          <XStack gap="$1">
            <YStack style={styles.levelList}>
              {aggregatedData.bids.map((item, index) => (
                <XStack
                  key={index}
                  h="$6"
                  ai="center"
                  mt={1}
                  px="$3"
                  position="relative"
                >
                  <ColorBlock
                    color={blockColors.green}
                    right={0}
                    width={`${(item.cumSize / bidDepth) * 100}%`}
                  />
                  <XStack flex={1} jc="space-between">
                    <Text
                      fontFamily="$monoRegular"
                      color="$textSubdued"
                      formatter="marketCap"
                    >
                      {item.size}
                    </Text>
                    <Text
                      fontFamily="$monoRegular"
                      color="$green11"
                      formatter="value"
                    >
                      {item.price}
                    </Text>
                  </XStack>
                </XStack>
              ))}
            </YStack>
            <YStack style={styles.levelList}>
              {aggregatedData.asks.reverse().map((item, index) => (
                <XStack
                  key={index}
                  h="$6"
                  ai="center"
                  mt={1}
                  position="relative"
                >
                  <ColorBlock
                    color={blockColors.red}
                    left={0}
                    width={`${(item.cumSize / askDepth) * 100}%`}
                  />
                  <XStack flex={1} jc="space-between">
                    <Text
                      fontFamily="$monoRegular"
                      color="$red11"
                      formatter="marketCap"
                    >
                      {item.size}
                    </Text>
                    <Text
                      fontFamily="$monoRegular"
                      color="$textSubdued"
                      formatter="value"
                    >
                      {item.price}
                    </Text>
                  </XStack>
                </XStack>
              ))}
            </YStack>
          </XStack>
        )}
      </View>
    );
  }
  return (
    <YStack>
      <XStack px="$3" disableClassName>
        <XStack flex={1} ai="center" disableClassName>
          <SizableText size="$headingXs" color="$textSubdued" disableClassName>
            Price
          </SizableText>
        </XStack>
        <XStack flex={1} ai="center" jc="center" disableClassName>
          <SizableText size="$headingXs" color="$textSubdued" disableClassName>
            SIZE
          </SizableText>
        </XStack>
        <XStack flex={1} ai="center" jc="flex-end">
          <SizableText size="$headingXs" color="$textSubdued" disableClassName>
            TOTAL
          </SizableText>
        </XStack>
      </XStack>
      <YStack>
        {aggregatedData.asks.reverse().map((itemData, index) => (
          <XStack key={index} style={styles.row} disableClassName>
            <ColorBlock
              color={blockColors.red}
              left={0}
              width={`${(itemData.cumSize / askDepth) * 100}%`}
            />
            <OrderBookVerticalRow item={itemData} />
          </XStack>
        ))}

        <XStack
          key="mid"
          gap="$6"
          h="$6"
          ai="center"
          jc="center"
          mt={1}
          disableClassName
        >
          <SizableText size="$bodySm" disableClassName>
            Spread
          </SizableText>
          <SizableText size="$bodySm" disableClassName>
            {midPrice}
          </SizableText>
          <SizableText size="$bodySm" disableClassName>
            0.002%
          </SizableText>
        </XStack>

        {aggregatedData.bids.map((itemData, index) => (
          <XStack key={index} style={styles.row}>
            <ColorBlock
              color={blockColors.green}
              left={0}
              width={`${(itemData.cumSize / bidDepth) * 100}%`}
            />
            <OrderBookVerticalRow item={itemData} />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

export function OrderPairBook({
  bids,
  asks,
  maxLevelsPerSide = 30,
}: {
  maxLevelsPerSide?: number;
  bids: IBookLevel[];
  asks: IBookLevel[];
}) {
  const aggregatedData = useAggregatedBook(
    bids,
    asks,
    0.01,
    0.1,
    maxLevelsPerSide,
  );
  const bidDepth = aggregatedData.bids.at(-1)?.cumSize ?? 0;
  const askDepth = aggregatedData.asks.at(-1)?.cumSize ?? 0;
  const midPrice = getMidPrice(
    parseFloat(bids[0]?.px ?? '0'),
    parseFloat(asks[0]?.px ?? '0'),
  );
  const data = useMemo(() => {
    return [
      ...aggregatedData.asks.map((ask) => ({ data: ask, type: 'ask' })),
      { type: 'mid', data: { price: midPrice, size: 0, cumSize: 0 } },
      ...aggregatedData.bids.map((bid) => ({ data: bid, type: 'bid' })),
    ];
  }, [aggregatedData.asks, aggregatedData.bids, midPrice]);
  const blockColors = useBlockColors();
  return (
    <YStack>
      <XStack pb="$1" px="$2" ai="center" jc="space-between">
        <SizableText color="$textSubdued">PRICE</SizableText>
        <SizableText color="$textSubdued">SIZE</SizableText>
      </XStack>
      <YStack>
        {data.map((item, index) => {
          const { type, data: itemData } = item;
          if (type === 'mid') {
            return (
              <XStack key="mid" gap="$6" h="$6" ai="center" jc="center" mt={1}>
                <SizableText size="$bodySm">Spread</SizableText>
                <SizableText size="$bodySm">{itemData.price}</SizableText>
                <SizableText size="$bodySm">0.002%</SizableText>
              </XStack>
            );
          }
          return (
            <XStack key={index} mt={1} position="relative" h="$6">
              <XStack
                position="absolute"
                left={0}
                h="$6"
                width={`${(itemData.cumSize / bidDepth) * 100}%`}
                bg="$green3"
              />
              {type === 'bid' ? (
                <ColorBlock
                  color={blockColors.green}
                  left={0}
                  width={`${(itemData.cumSize / bidDepth) * 100}%`}
                />
              ) : (
                <ColorBlock
                  color={blockColors.red}
                  left={0}
                  width={`${(itemData.cumSize / askDepth) * 100}%`}
                />
              )}
              <XStack flex={1} px="$2" jc="space-between" ai="center">
                <Text formatter="value">{itemData.price}</Text>
                <Text formatter="marketCap">{itemData.size}</Text>
              </XStack>
            </XStack>
          );
        })}
      </YStack>
    </YStack>
  );
}
