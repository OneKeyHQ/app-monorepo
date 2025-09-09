import { FlatList, StyleSheet, Text, View } from 'react-native';

import { NumberSizeableText, SizableText, XStack } from '@onekeyhq/components';

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
  /** Border color of aggregation controls */
  aggregationBorderColor?: string;
  /** A formatter function to format prices */
  priceFormatter?: (n: number) => React.ReactNode;
  /** A formatter function to format sizes */
  sizeFormatter?: (n: number) => React.ReactNode;
  /** Text color of column header labels */
  columnLabelColor?: string;
  /** The size text color */
  sizeColor?: string;
  /** The bid text color */
  bidPriceColor?: string;
  /** The ask text color */
  askPriceColor?: string;
  /** Color of ask level size bars */
  askBarColor?: string;
  /** Color of bid level size bars */
  bidBarColor?: string;
  /** Column label of the size columns, defaults to "Size". You
   * could add the base ccy e.g. "Size (BTC)" */
  sizeLabel?: React.ReactNode;
  /** Styles for the container (outer) view */
  style?: StyleProp<ViewStyle>;
  /** Styles for a column cell Text element. Typically used to
   * change font, use `sizeColor`, `bidPriceColor`, `askPriceColor`
   * to change the color. */
  cellTextStyle?: StyleProp<TextStyle>;
  /** A function which receives the mid price and can return a
   * custom mid price node */
  midPriceNode?: (midPrice: number) => React.ReactNode;
  /** A custom loading node. Defaults to "Loading...". */
  loadingNode?: React.ReactNode;
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

export function Orderbook({
  bids,
  asks,
  maxLevelsPerSide = 30,
  aggregation,
  aggregationBtn = defaultAggregationBtn,
  aggregationBorderColor = 'rgba(255,255,255,0.06)',
  priceFormatter = priceFmt,
  sizeFormatter = sizeFmt,
  columnLabelColor = 'rgb(132, 142, 156)',
  sizeColor = 'rgb(183, 189, 198)',
  bidPriceColor = '#5981f2',
  askPriceColor = 'rgb(246, 70, 93)',
  askBarColor = 'rgb(49, 30, 38)',
  bidBarColor = '#1a2643',
  sizeLabel = 'SIZE',
  style,
  cellTextStyle,
  midPriceNode = defaultMidPriceNode,
  loadingNode = <DefaultLoadingNode />,
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

  return (
    <View style={[styles.container, style]}>
      {aggregation?.tickSizes?.length && aggregation?.onTickSizeChange ? (
        <AggregationControls
          aggregationBtn={aggregationBtn}
          aggregationBorderColor={aggregationBorderColor}
          tickSizes={aggregation.tickSizes}
          tickSize={aggregation.tickSize}
          onChange={aggregation.onTickSizeChange}
        />
      ) : null}
      <XStack gap="$1" h="$4" ai="center">
        <XStack flex={1} jc="space-between">
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {sizeLabel}
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
            {sizeLabel}
          </SizableText>
        </XStack>
      </XStack>
      {isEmpty ? (
        loadingNode
      ) : (
        <XStack gap="$1">
          <FlatList
            contentContainerStyle={styles.levelList}
            data={aggr.bids}
            getItemLayout={(data, index) => ({
              length: rowHeight,
              offset: rowHeight * index,
              index,
            })}
            renderItem={({ item }) => (
              <XStack h="$6" ai="center" mt={1}>
                <XStack
                  position="absolute"
                  right={0}
                  h={rowHeight}
                  width={`${(item.cumSize / bidDepth) * 100}%`}
                  bg="rgba(233, 249, 238, 1)"
                />
                <XStack flex={1} jc="space-between">
                  <NumberSizeableText
                    fontFamily="$monoRegular"
                    color="$textSubdued"
                    formatter="balance"
                  >
                    {item.size}
                  </NumberSizeableText>
                  <NumberSizeableText
                    fontFamily="$monoRegular"
                    color="rgba(24, 121, 78)"
                    formatter="value"
                  >
                    {item.price}
                  </NumberSizeableText>
                </XStack>
              </XStack>
            )}
            keyExtractor={(level) => String(level.price)}
          />
          <FlatList
            contentContainerStyle={styles.levelList}
            data={aggr.asks}
            getItemLayout={(data, index) => ({
              length: rowHeight,
              offset: rowHeight * index,
              index,
            })}
            renderItem={({ item }) => (
              <XStack h="$6" ai="center" mt={1}>
                <XStack
                  position="absolute"
                  left={0}
                  h={rowHeight}
                  width={`${(item.cumSize / askDepth) * 100}%`}
                  bg="rgb(255, 239, 239)"
                />
                <XStack flex={1} jc="space-between">
                  <NumberSizeableText
                    fontFamily="$monoRegular"
                    color="rgb(198, 42, 47)"
                    formatter="balance"
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
