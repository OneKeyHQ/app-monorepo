import { StyleSheet, View } from 'react-native';

import type { IXStackProps } from '@onekeyhq/components';
import {
  ListView,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { AggregationControls } from './AggregationControls';
import { defaultAggregationBtn } from './defaultAggregationBtn';
import { DefaultLoadingNode } from './DefaultLoadingNode';
import { useAggregatedBook } from './useAggregatedBook';
import { getMidPrice, monoFamily, priceFmt, sizeFmt } from './utils';

import type { IAggregationBtn, IOBLevel } from './types';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

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

interface IOrderbookProps {
  /** The sorted best to worst (high to low) bid levels */
  bids: IOBLevel[];
  /** The sorted best to worst (low to high) ask levels */
  asks: IOBLevel[];
  /** The maximum price levels to render per side */
  maxLevelsPerSide?: number;
  /** Aggregation options */
  aggregation?: IOBAggregation;
  /** A function which can return a custom aggregation button */
  aggregationBtn?: IAggregationBtn;
  /** Styles for the container (outer) view */
  style?: StyleProp<ViewStyle>;
  /** A function which receives the mid price and can return a
   * custom mid price node */
  midPriceNode?: (midPrice: number) => React.ReactNode;
  /** A custom loading node. Defaults to "Loading...". */
  loadingNode?: React.ReactNode;
  /** Whether to render the order book horizontally */
  horizontal?: boolean;
  /** Whether to render the controls */
  controls?: boolean;
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
  cellText: {
    fontFamily: monoFamily,
    fontSize: 13,
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

export function Orderbook({
  bids,
  asks,
  maxLevelsPerSide = 30,
  aggregation,
  aggregationBtn = defaultAggregationBtn,
  style,
  midPriceNode = defaultMidPriceNode,
  loadingNode = <DefaultLoadingNode />,
  horizontal = true,
  controls,
}: IOrderbookProps) {
  const aggr = useAggregatedBook(
    bids,
    asks,
    aggregation?.baseTickSize ?? 1,
    aggregation?.tickSize ?? 1,
    maxLevelsPerSide,
  );
  const isEmpty = !aggr.bids.length && !aggr.asks.length;

  const midPrice = getMidPrice(bids[0]?.price ?? 0, asks[0]?.price ?? 0);

  const bidDepth = aggr.bids.at(-1)?.cumSize ?? 0;
  const askDepth = aggr.asks.at(-1)?.cumSize ?? 0;

  if (horizontal) {
    return (
      <View style={[styles.container, style]}>
        {controls &&
        aggregation?.tickSizes?.length &&
        aggregation?.onTickSizeChange ? (
          <AggregationControls
            aggregationBtn={aggregationBtn}
            tickSizes={aggregation.tickSizes}
            tickSize={aggregation.tickSize}
            onChange={aggregation.onTickSizeChange}
          />
        ) : null}
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
            <ListView
              useFlashList
              contentContainerStyle={styles.levelList}
              data={aggr.bids}
              renderItem={({ item }) => (
                <XStack h="$6" ai="center" mt={1} position="relative">
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
              )}
              keyExtractor={(level) => String(level.price)}
            />
            <ListView
              useFlashList
              contentContainerStyle={styles.levelList}
              data={aggr.asks}
              renderItem={({ item }) => (
                <XStack h="$6" ai="center" mt={1} position="relative">
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
              )}
              keyExtractor={(level) => String(level.price)}
            />
          </XStack>
        )}
      </View>
    );
  }

  const data = [
    ...aggr.asks.map((ask) => ({ data: ask, type: 'ask' })),
    { type: 'mid', data: { price: midPrice, size: 0, cumSize: 0 } },
    ...aggr.bids.map((bid) => ({ data: bid, type: 'bid' })),
  ];

  return (
    <YStack>
      <XStack>
        <XStack flex={1} ai="center" pl="$3">
          <SizableText size="$headingXs" color="$textSubdued">
            Price
          </SizableText>
        </XStack>
        <XStack flex={1} ai="center" jc="center">
          <SizableText size="$headingXs" color="$textSubdued">
            SIZE
          </SizableText>
        </XStack>
        <XStack flex={1} ai="center" jc="flex-end" pr="$3">
          <SizableText size="$headingXs" color="$textSubdued">
            TOTAL
          </SizableText>
        </XStack>
      </XStack>
      <ListView
        useFlashList
        data={data}
        renderItem={({ item }) => {
          const { type, data: itemData } = item;
          if (type === 'mid') {
            return (
              <XStack gap="$6" h="$6" ai="center" jc="center" mt={1}>
                <SizableText size="$bodySm">Spread</SizableText>
                <SizableText size="$bodySm">{itemData.price}</SizableText>
                <SizableText size="$bodySm">0.002%</SizableText>
              </XStack>
            );
          }
          return (
            <XStack h="$6" ai="center" mt={1} position="relative">
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
              <XStack flex={1} jc="space-between">
                <XStack width="33.33%">
                  <NumberSizeableText
                    fontFamily="$monoRegular"
                    color="$textSubdued"
                    formatter="marketCap"
                  >
                    {itemData.price}
                  </NumberSizeableText>
                </XStack>
                <XStack width="33.33%">
                  <NumberSizeableText
                    flex={1}
                    fontFamily="$monoRegular"
                    color="$textSubdued"
                    formatter="marketCap"
                    textAlign="center"
                  >
                    {itemData.size}
                  </NumberSizeableText>
                </XStack>

                <XStack width="33.33%">
                  <NumberSizeableText
                    flex={1}
                    textAlign="right"
                    fontFamily="$monoRegular"
                    color="$textSubdued"
                    formatter="marketCap"
                  >
                    {itemData.cumSize}
                  </NumberSizeableText>
                </XStack>
              </XStack>
            </XStack>
          );
        }}
      />
    </YStack>
  );
}

export function OrderPriceBook({
  bids,
  asks,
  maxLevelsPerSide = 30,
  aggregation,
}: {
  aggregation?: IOBAggregation;
  maxLevelsPerSide?: number;
  bids: IOBLevel[];
  asks: IOBLevel[];
}) {
  const aggr = useAggregatedBook(
    bids,
    asks,
    aggregation?.baseTickSize ?? 1,
    aggregation?.tickSize ?? 1,
    maxLevelsPerSide,
  );
  const bidDepth = aggr.bids.at(-1)?.cumSize ?? 0;
  return (
    <YStack>
      <XStack pb="$1" ai="center" jc="space-between">
        <SizableText color="$textSubdued">USDC</SizableText>
        <SizableText color="$textSubdued">BTC</SizableText>
      </XStack>
      <ListView
        useFlashList
        data={aggr.bids}
        renderItem={(item) => (
          <XStack mt={1} position="relative">
            <XStack
              position="absolute"
              left={0}
              h="$6"
              width={`${(item.item.cumSize / bidDepth) * 100}%`}
              bg="$green3"
            />
            <XStack flex={1} jc="space-between">
              <NumberSizeableText formatter="marketCap">
                {item.item.price}
              </NumberSizeableText>
              <NumberSizeableText formatter="marketCap">
                {item.item.size}
              </NumberSizeableText>
            </XStack>
          </XStack>
        )}
      />
    </YStack>
  );
}
