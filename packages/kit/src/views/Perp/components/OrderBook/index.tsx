import { useMemo } from 'react';

import { StyleSheet, View } from 'react-native';

import type { IXStackProps } from '@onekeyhq/components';
import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { DefaultLoadingNode } from './DefaultLoadingNode';
import { useAggregatedBook } from './useAggregatedBook';
import { getMidPrice } from './utils';

import type { IOBLevel } from './types';
import type { StyleProp, ViewStyle } from 'react-native';

export const rowHeight = 28;

export const defaultMidPriceNode = (midPrice: number) => (
  <NumberSizeableText formatter="balance">{midPrice}</NumberSizeableText>
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
  bids: IOBLevel[];
  /** The sorted best to worst (low to high) ask levels */
  asks: IOBLevel[];
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
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
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

type IColorBlockProps = Omit<IXStackProps, 'width'> & {
  width: string;
  color?: IXStackProps['bg'];
};

function ColorBlock({ color, width, ...props }: IColorBlockProps) {
  return (
    <XStack
      disableClassName
      position="absolute"
      right={0}
      h="$6"
      width={width}
      bg={color}
      {...props}
    />
  );
}

function GreenBlock({ width, ...props }: IColorBlockProps) {
  return <ColorBlock color="$green3" width={width} {...props} />;
}

function RedBlock({ width, ...props }: IColorBlockProps) {
  return <ColorBlock color="$red3" width={width} {...props} />;
}

function OrderBookVerticalRow({ item }: { item: IOBLevel }) {
  return (
    <XStack flex={1} px="$3" jc="space-between" disableClassName>
      <XStack width="33.33%">
        <NumberSizeableText
          fontFamily="$monoRegular"
          color="$textSubdued"
          formatter="marketCap"
          disableClassName
        >
          {item.price}
        </NumberSizeableText>
      </XStack>
      <XStack width="33.33%">
        <NumberSizeableText
          flex={1}
          fontFamily="$monoRegular"
          color="$textSubdued"
          formatter="marketCap"
          textAlign="center"
          disableClassName
        >
          {item.size}
        </NumberSizeableText>
      </XStack>
      <XStack width="33.33%">
        <NumberSizeableText
          flex={1}
          textAlign="right"
          fontFamily="$monoRegular"
          color="$textSubdued"
          formatter="marketCap"
          disableClassName
        >
          {item.cumSize}
        </NumberSizeableText>
      </XStack>
    </XStack>
  );
}

export function OrderBook({
  bids,
  asks,
  maxLevelsPerSide = 30,
  style,
  midPriceNode = defaultMidPriceNode,
  loadingNode = <DefaultLoadingNode />,
  horizontal = true,
}: IOrderBookProps) {
  const aggr = useAggregatedBook(bids, asks, 0.01, 0.1, maxLevelsPerSide);
  const isEmpty = !aggr.bids.length && !aggr.asks.length;

  const midPrice = getMidPrice(bids[0]?.price ?? 0, asks[0]?.price ?? 0);

  const bidDepth = aggr.bids.at(-1)?.cumSize ?? 0;
  const askDepth = aggr.asks.at(-1)?.cumSize ?? 0;

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
              {aggr.bids.map((item, index) => (
                <XStack
                  key={index}
                  h="$6"
                  ai="center"
                  mt={1}
                  px="$3"
                  position="relative"
                >
                  <GreenBlock
                    right={0}
                    width={`${(item.cumSize / bidDepth) * 100}%`}
                  />
                  <XStack flex={1} jc="space-between">
                    <NumberSizeableText
                      fontFamily="$monoRegular"
                      color="$textSubdued"
                      formatter="marketCap"
                    >
                      {item.size}
                    </NumberSizeableText>
                    <NumberSizeableText
                      fontFamily="$monoRegular"
                      color="$green11"
                      formatter="value"
                    >
                      {item.price}
                    </NumberSizeableText>
                  </XStack>
                </XStack>
              ))}
            </YStack>
            <YStack style={styles.levelList}>
              {aggr.asks.map((item, index) => (
                <XStack
                  key={index}
                  h="$6"
                  ai="center"
                  mt={1}
                  position="relative"
                >
                  <RedBlock
                    left={0}
                    width={`${(item.cumSize / askDepth) * 100}%`}
                  />
                  <XStack flex={1} jc="space-between">
                    <NumberSizeableText
                      fontFamily="$monoRegular"
                      color="$red11"
                      formatter="marketCap"
                    >
                      {item.size}
                    </NumberSizeableText>
                    <NumberSizeableText
                      fontFamily="$monoRegular"
                      color="$textSubdued"
                      formatter="value"
                    >
                      {item.price}
                    </NumberSizeableText>
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
        {aggr.asks.map((itemData, index) => (
          <XStack
            key={index}
            h="$6"
            ai="center"
            mt={1}
            position="relative"
            disableClassName
          >
            {/* <RedBlock
              left={0}
              width={`${(itemData.cumSize / askDepth) * 100}%`}
            /> */}
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

        {aggr.bids.map((itemData, index) => (
          <XStack
            key={index}
            h="$6"
            ai="center"
            mt={1}
            position="relative"
            disableClassName
          >
            {/* <GreenBlock
              left={0}
              width={`${(itemData.cumSize / bidDepth) * 100}%`}
            /> */}
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
  bids: IOBLevel[];
  asks: IOBLevel[];
}) {
  const aggr = useAggregatedBook(bids, asks, 0.01, 0.1, maxLevelsPerSide);
  const bidDepth = aggr.bids.at(-1)?.cumSize ?? 0;
  const askDepth = aggr.asks.at(-1)?.cumSize ?? 0;
  const midPrice = getMidPrice(bids[0]?.price ?? 0, asks[0]?.price ?? 0);
  const data = useMemo(() => {
    return [
      ...aggr.asks.map((ask) => ({ data: ask, type: 'ask' })),
      { type: 'mid', data: { price: midPrice, size: 0, cumSize: 0 } },
      ...aggr.bids.map((bid) => ({ data: bid, type: 'bid' })),
    ];
  }, [aggr.asks, aggr.bids, midPrice]);
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
                <GreenBlock
                  left={0}
                  width={`${(itemData.cumSize / bidDepth) * 100}%`}
                />
              ) : (
                <RedBlock
                  left={0}
                  width={`${(itemData.cumSize / askDepth) * 100}%`}
                />
              )}
              <XStack flex={1} px="$2" jc="space-between" ai="center">
                <NumberSizeableText formatter="value">
                  {itemData.price}
                </NumberSizeableText>
                <NumberSizeableText formatter="marketCap">
                  {itemData.size}
                </NumberSizeableText>
              </XStack>
            </XStack>
          );
        })}
      </YStack>
    </YStack>
  );
}
