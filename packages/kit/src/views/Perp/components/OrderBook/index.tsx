import { useMemo } from 'react';

import { colorTokens } from '@tamagui/themes';
import { StyleSheet, Text, View } from 'react-native';

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
  <Text>{midPrice}</Text>
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
  headerText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  verticalHeaderText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    width: '100%',
  },
  monospaceText: {
    fontFamily: 'monospace',
    color: '#888',
  },
  colorBlock: {
    position: 'absolute',
    height: rowHeight,
  },
  verticalHeaderContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  verticalRowContainer: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  verticalRowCell: {
    width: '33.33%',
  },
  spreadRow: {
    gap: 24,
    height: rowHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexDirection: 'row',
  },
  pairBookHeader: {
    paddingBottom: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pairBookRow: {
    marginTop: 1,
    position: 'relative',
    height: 24,
  },
  pairBookSpreadRow: {
    gap: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
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
      style={[
        styles.colorBlock,
        {
          right,
          left,
          width,
          backgroundColor: color,
        },
      ]}
    />
  );
}

function OrderBookVerticalRow({ item }: { item: IOBLevel }) {
  return (
    <View style={styles.verticalRowContainer}>
      <View style={styles.verticalRowCell}>
        <Text
          style={[styles.monospaceText, { textAlign: 'left' }]}
          numberOfLines={1}
        >
          {item.price}
        </Text>
      </View>
      <View style={styles.verticalRowCell}>
        <Text
          numberOfLines={1}
          style={[styles.monospaceText, { textAlign: 'center' }]}
        >
          {item.size}
        </Text>
      </View>
      <View style={styles.verticalRowCell}>
        <Text
          numberOfLines={1}
          style={[styles.monospaceText, { textAlign: 'right' }]}
        >
          {item.cumSize}
        </Text>
      </View>
    </View>
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

const useTextColor = () => {
  const theme = useTheme();
  return useMemo(() => {
    return {
      textSubdued: theme.textSubdued.val,
      text: theme.text.val,
    };
  }, [theme]);
};

export function OrderBook({
  bids,
  asks,
  maxLevelsPerSide = 30,
  style,
  midPriceNode: _midPriceNode = defaultMidPriceNode,
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
  const textColor = useTextColor();

  if (horizontal) {
    return (
      <View style={[styles.container, style]}>
        <XStack gap="$1" h="$4" ai="center">
          <XStack flex={1} jc="space-between">
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              SIZE
            </Text>
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              BUY
            </Text>
          </XStack>
          <XStack flex={1} jc="space-between">
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              SELL
            </Text>
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              SIZE
            </Text>
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
                    <Text style={styles.monospaceText}>{item.size}</Text>
                    <Text style={{ fontFamily: 'monospace', color: '#22c55e' }}>
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
                    <Text style={{ fontFamily: 'monospace', color: '#ef4444' }}>
                      {item.size}
                    </Text>
                    <Text style={styles.monospaceText}>{item.price}</Text>
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
    <View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 12 }}>
        <View style={styles.verticalHeaderContainer}>
          <Text
            style={[
              styles.verticalHeaderText,
              { textAlign: 'left', color: textColor.textSubdued },
            ]}
          >
            Price
          </Text>
        </View>
        <View
          style={[styles.verticalHeaderContainer, { justifyContent: 'center' }]}
        >
          <Text
            style={[
              styles.verticalHeaderText,
              { textAlign: 'center', color: textColor.textSubdued },
            ]}
          >
            SIZE
          </Text>
        </View>
        <View
          style={[
            styles.verticalHeaderContainer,
            { justifyContent: 'flex-end' },
          ]}
        >
          <Text
            style={[
              styles.verticalHeaderText,
              { textAlign: 'right', color: textColor.textSubdued },
            ]}
          >
            TOTAL
          </Text>
        </View>
      </View>
      <View>
        {aggregatedData.asks.reverse().map((itemData, index) => (
          <View key={index} style={styles.row}>
            <ColorBlock
              color={blockColors.red}
              left={0}
              width={`${(itemData.cumSize / askDepth) * 100}%`}
            />
            <OrderBookVerticalRow item={itemData} />
          </View>
        ))}
        <View key="mid" style={styles.spreadRow}>
          <SizableText size="$bodySm" disableClassName>
            Spread
          </SizableText>
          <SizableText size="$bodySm" disableClassName>
            {midPrice}
          </SizableText>
          <SizableText size="$bodySm" disableClassName>
            0.002%
          </SizableText>
        </View>

        {aggregatedData.bids.map((itemData, index) => (
          <View key={index} style={styles.row}>
            <ColorBlock
              color={blockColors.green}
              left={0}
              width={`${(itemData.cumSize / bidDepth) * 100}%`}
            />
            <OrderBookVerticalRow item={itemData} />
          </View>
        ))}
      </View>
    </View>
  );
}

function OrderBookPairRow({ item }: { item: IOBLevel }) {
  return (
    <XStack flex={1} px="$2" mt={1} jc="space-between" ai="center">
      <Text>{item.price}</Text>
      <Text>{item.size}</Text>
    </XStack>
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
  const blockColors = useBlockColors();
  return (
    <YStack>
      <XStack style={styles.pairBookHeader}>
        <SizableText color="$textSubdued">PRICE</SizableText>
        <SizableText color="$textSubdued">SIZE</SizableText>
      </XStack>
      <YStack>
        {aggregatedData.asks.map((itemData, index) => (
          <XStack key={index} style={styles.pairBookRow}>
            <ColorBlock
              color={blockColors.red}
              left={0}
              width={`${(itemData.cumSize / askDepth) * 100}%`}
            />
            <OrderBookPairRow item={itemData} />
          </XStack>
        ))}

        <XStack style={styles.pairBookSpreadRow}>
          <SizableText size="$bodySm">Spread</SizableText>
          <SizableText size="$bodySm">{midPrice}</SizableText>
          <SizableText size="$bodySm">0.002%</SizableText>
        </XStack>

        {aggregatedData.bids.map((itemData, index) => (
          <XStack key={index} style={styles.pairBookRow}>
            <ColorBlock
              color={blockColors.green}
              left={0}
              width={`${(itemData.cumSize / bidDepth) * 100}%`}
            />
            <OrderBookPairRow item={itemData} />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
