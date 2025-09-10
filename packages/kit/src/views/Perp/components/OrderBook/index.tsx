import { useMemo } from 'react';

import { colorTokens } from '@tamagui/themes';
import BigNumber from 'bignumber.js';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme, useThemeName } from '@onekeyhq/components';
import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { DefaultLoadingNode } from './DefaultLoadingNode';
import { useAggregatedBook } from './useAggregatedBook';
import { getMidPrice } from './utils';

import type { IOBLevel } from './types';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

export const rowHeight = 24;

export const defaultMidPriceNode = (midPrice: string) => (
  <Text>{midPrice}</Text>
);

// Helper function to calculate percentage with BigNumber precision
function calculatePercentage(cumSize: string, totalDepth: BigNumber): number {
  if (totalDepth.isZero()) return 0;
  const cumSizeBN = new BigNumber(cumSize);
  return cumSizeBN.dividedBy(totalDepth).multipliedBy(100).toNumber();
}

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
  midPriceNode?: (midPrice: string) => React.ReactNode;
  /** A custom loading node. Defaults to "Loading...". */
  loadingNode?: React.ReactNode;
  /** Whether to render the order book horizontally */
  horizontal?: boolean;
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    width: '100%',
    height: '100%',
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
    lineHeight: 24,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    width: '100%',
  },
  monospaceText: {
    fontFamily: 'monospace',
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
  horizontalHeaderContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
  },
  verticalRowContainer: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  verticalRowCell: {
    width: '33.33%',
  },
  bodySm: {
    fontSize: 12,
    lineHeight: 16,
  },
  bodySmMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  pairBookRow: {
    marginTop: 1,
    position: 'relative',
    height: 24,
  },
  pairBookSpreadRow: {
    flexDirection: 'row',
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

function OrderBookVerticalRow({
  item,
  priceColor,
  sizeColor,
}: {
  item: IOBLevel;
  priceColor: string;
  sizeColor: string;
}) {
  return (
    <View style={styles.verticalRowContainer}>
      <View style={styles.verticalRowCell}>
        <Text
          style={[
            styles.monospaceText,
            { textAlign: 'left', color: priceColor },
          ]}
          numberOfLines={1}
        >
          {item.price}
        </Text>
      </View>
      <View style={styles.verticalRowCell}>
        <Text
          numberOfLines={1}
          style={[
            styles.monospaceText,
            { textAlign: 'center', color: sizeColor },
          ]}
        >
          {item.size}
        </Text>
      </View>
      <View style={styles.verticalRowCell}>
        <Text
          numberOfLines={1}
          style={[
            styles.monospaceText,
            { textAlign: 'right', color: sizeColor },
          ]}
        >
          {item.cumSize}
        </Text>
      </View>
    </View>
  );
}

const useBlockColors = () => {
  const themeName = useThemeName();
  return useMemo(() => {
    return {
      red: colorTokens[themeName].red.red3,
      green: colorTokens[themeName].green.green3,
    };
  }, [themeName]);
};

const useTextColor = () => {
  const theme = useTheme();
  const themeName = useThemeName();
  return useMemo(() => {
    return {
      textSubdued: theme.textSubdued.val,
      text: theme.text.val,
      red: colorTokens[themeName].red.red11,
      green: colorTokens[themeName].green.green11,
    };
  }, [theme.text.val, theme.textSubdued.val, themeName]);
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

  const midPrice = getMidPrice(bids[0]?.px ?? '0', asks[0]?.px ?? '0');

  const bidDepth = new BigNumber(aggregatedData.bids.at(-1)?.cumSize ?? '0');
  const askDepth = new BigNumber(aggregatedData.asks.at(-1)?.cumSize ?? '0');

  const blockColors = useBlockColors();
  const textColor = useTextColor();

  if (horizontal) {
    return (
      <View style={[styles.container, style]}>
        <View
          style={{
            gap: 4,
            height: 16,
            alignItems: 'center',
            flexDirection: 'row',
          }}
        >
          <View style={styles.horizontalHeaderContainer}>
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              SIZE
            </Text>
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              BUY
            </Text>
          </View>
          <View style={styles.horizontalHeaderContainer}>
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              SELL
            </Text>
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              SIZE
            </Text>
          </View>
        </View>
        {isEmpty ? (
          loadingNode
        ) : (
          <View style={{ gap: 4, flexDirection: 'row' }}>
            <View style={styles.levelList}>
              {aggregatedData.bids.map((item, index) => (
                <View
                  key={index}
                  style={{
                    height: 24,
                    alignItems: 'center',
                    marginTop: 1,
                    position: 'relative',
                  }}
                >
                  <ColorBlock
                    color={blockColors.green}
                    right={0}
                    width={`${calculatePercentage(item.cumSize, bidDepth)}%`}
                  />
                  <View
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      width: '100%',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={[
                        styles.monospaceText,
                        { color: textColor.textSubdued },
                      ]}
                    >
                      {item.size}
                    </Text>
                    <Text
                      style={[styles.monospaceText, { color: textColor.green }]}
                    >
                      {item.price}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.levelList}>
              {aggregatedData.asks.reverse().map((item, index) => (
                <View
                  key={index}
                  style={{
                    height: 24,
                    alignItems: 'center',
                    marginTop: 1,
                    position: 'relative',
                  }}
                >
                  <ColorBlock
                    color={blockColors.red}
                    left={0}
                    width={`${calculatePercentage(item.cumSize, askDepth)}%`}
                  />
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      width: '100%',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={[styles.monospaceText, { color: textColor.red }]}
                    >
                      {item.price}
                    </Text>
                    <Text
                      style={[styles.monospaceText, { color: textColor.text }]}
                    >
                      {item.size}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={{ padding: 8 }}>
      <View style={{ flexDirection: 'row' }}>
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
        <View style={[styles.verticalHeaderContainer]}>
          <Text
            style={[
              styles.verticalHeaderText,
              { textAlign: 'center', color: textColor.textSubdued },
            ]}
          >
            SIZE
          </Text>
        </View>
        <View style={[styles.verticalHeaderContainer]}>
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
              width={`${calculatePercentage(itemData.cumSize, askDepth)}%`}
            />
            <OrderBookVerticalRow
              item={itemData}
              priceColor={textColor.red}
              sizeColor={textColor.textSubdued}
            />
          </View>
        ))}
        <View key="mid" style={styles.spreadRow}>
          <Text style={[styles.bodySm, { color: textColor.text }]}>Spread</Text>
          <Text style={[styles.bodySm, { color: textColor.text }]}>0.1</Text>
          <Text style={[styles.bodySm, { color: textColor.text }]}>0.002%</Text>
        </View>

        {aggregatedData.bids.map((itemData, index) => (
          <View key={index} style={styles.row}>
            <ColorBlock
              color={blockColors.green}
              left={0}
              width={`${calculatePercentage(itemData.cumSize, bidDepth)}%`}
            />
            <OrderBookVerticalRow
              item={itemData}
              priceColor={textColor.green}
              sizeColor={textColor.textSubdued}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function OrderBookPairRow({
  item,
  priceColor,
  sizeColor,
}: {
  item: IOBLevel;
  priceColor: string;
  sizeColor: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        marginTop: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text style={[styles.bodySmMedium, { color: priceColor }]}>
        {item.price}
      </Text>
      <Text style={[styles.bodySmMedium, { color: sizeColor }]}>
        {item.size}
      </Text>
    </View>
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
  const bidDepth = useMemo(() => {
    return new BigNumber(aggregatedData.bids.at(-1)?.cumSize ?? '0');
  }, [aggregatedData.bids]);
  const askDepth = useMemo(() => {
    return new BigNumber(aggregatedData.asks.at(-1)?.cumSize ?? '0');
  }, [aggregatedData.asks]);
  const midPrice = getMidPrice(
    parseFloat(bids[0]?.px ?? '0'),
    parseFloat(asks[0]?.px ?? '0'),
  );
  const textColor = useTextColor();
  const blockColors = useBlockColors();
  return (
    <View style={{ padding: 8 }}>
      <View style={styles.pairBookHeader}>
        <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
          PRICE
        </Text>
        <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
          SIZE
        </Text>
      </View>
      <View>
        {aggregatedData.asks.map((itemData, index) => (
          <View key={index} style={styles.pairBookRow}>
            <ColorBlock
              color={blockColors.red}
              left={0}
              width={`${calculatePercentage(itemData.cumSize, askDepth)}%`}
            />
            <OrderBookPairRow
              item={itemData}
              priceColor={textColor.red}
              sizeColor={textColor.textSubdued}
            />
          </View>
        ))}

        <View style={styles.pairBookSpreadRow}>
          <Text style={[styles.bodySm, { color: textColor.textSubdued }]}>
            Spread
          </Text>
          <Text style={[styles.bodySm, { color: textColor.textSubdued }]}>
            {midPrice}
          </Text>
          <Text style={[styles.bodySm, { color: textColor.textSubdued }]}>
            0.002%
          </Text>
        </View>

        {aggregatedData.bids.map((itemData, index) => (
          <View key={index} style={styles.pairBookRow}>
            <ColorBlock
              color={blockColors.green}
              left={0}
              width={`${calculatePercentage(itemData.cumSize, bidDepth)}%`}
            />
            <OrderBookPairRow
              item={itemData}
              priceColor={textColor.green}
              sizeColor={textColor.textSubdued}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
