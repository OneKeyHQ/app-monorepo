import { useCallback, useMemo } from 'react';

import { colorTokens } from '@tamagui/themes';
import BigNumber from 'bignumber.js';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon, Select, useTheme, useThemeName } from '@onekeyhq/components';
import { calculateSpreadPercentage } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { DefaultLoadingNode } from './DefaultLoadingNode';
import { type ITickParam } from './tickSizeUtils';
import { useAggregatedBook } from './useAggregatedBook';
import { getMidPrice } from './utils';

import type { IOBLevel } from './types';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { useIntl } from 'react-intl';

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
  /** The coin symbol */
  symbol?: string;
  /** The selected tick option */
  selectedTickOption?: ITickParam;
  /** Callback when tick option changes */
  onTickOptionChange?: (option: ITickParam) => void;
  /** Available tick options */
  tickOptions?: ITickParam[];
  /** Whether to show tick selector */
  showTickSelector?: boolean;
  /** Price decimal places */
  priceDecimals?: number;
  /** Size decimal places */
  sizeDecimals?: number;
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
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
  blockRow: {
    height: rowHeight,
    marginTop: 1,
    position: 'relative',
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
    fontFamily: 'SFMono-Regular',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  colorBlock: {
    position: 'relative',
    height: rowHeight,
  },
  verticalHeaderContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  verticalHeaderPrice: {
    width: '20%',
    alignItems: 'flex-start',
  },
  verticalHeaderSize: {
    width: '40%',
    alignItems: 'flex-end',
  },
  verticalHeaderTotal: {
    width: '40%',
    alignItems: 'flex-end',
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
  verticalRowCellPrice: {
    width: '20%',
    alignItems: 'flex-start',
  },
  verticalRowCellSize: {
    width: '40%',
    alignItems: 'flex-end',
  },
  verticalRowCellTotal: {
    width: '40%',
    alignItems: 'flex-end',
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
  levelListContainer: {
    gap: 4,
    flexDirection: 'row',
    position: 'relative',
  },
  relativeContainer: {
    position: 'relative',
    flex: 1,
  },
  absoluteContainer: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
      <View style={styles.verticalRowCellPrice}>
        <Text
          style={[styles.monospaceText, { color: priceColor }]}
          numberOfLines={1}
        >
          {item.price}
        </Text>
      </View>
      <View style={styles.verticalRowCellSize}>
        <Text
          numberOfLines={1}
          style={[styles.monospaceText, { color: sizeColor }]}
        >
          {item.size}
        </Text>
      </View>
      <View style={styles.verticalRowCellTotal}>
        <Text
          numberOfLines={1}
          style={[styles.monospaceText, { color: sizeColor }]}
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

const useSpreadColor = () => {
  const theme = useTheme();
  return useMemo(() => {
    return {
      backgroundColor: theme.bgSubdued.val,
    };
  }, [theme.bgSubdued]);
};

export function OrderBook({
  symbol: _symbol,
  bids,
  asks,
  maxLevelsPerSide = 30,
  style,
  midPriceNode: _midPriceNode = defaultMidPriceNode,
  loadingNode = <DefaultLoadingNode />,
  horizontal = true,
  selectedTickOption,
  onTickOptionChange,
  tickOptions = [],
  showTickSelector = true,
  priceDecimals = 2,
  sizeDecimals = 4,
}: IOrderBookProps) {
  // Handle tick option change
  const handleTickOptionChange = useCallback(
    (value?: string) => {
      if (value === undefined) return;
      const option = tickOptions.find((opt) => opt.value === value);
      if (option && onTickOptionChange) {
        onTickOptionChange(option);
      }
    },
    [tickOptions, onTickOptionChange],
  );

  const aggregatedData = useAggregatedBook(
    bids,
    asks,
    maxLevelsPerSide,
    selectedTickOption,
    priceDecimals,
    sizeDecimals,
  );
  const isEmpty = !aggregatedData.bids.length && !aggregatedData.asks.length;

  const bidDepth = new BigNumber(aggregatedData.bids.at(-1)?.cumSize ?? '0');
  const askDepth = new BigNumber(aggregatedData.asks.at(-1)?.cumSize ?? '0');

  const blockColors = useBlockColors();
  const textColor = useTextColor();
  const spreadColor = useSpreadColor();

  // Calculate spread percentage from best bid/ask
  const spreadPercentage = useMemo(() => {
    const bestBid = aggregatedData.bids[0]?.price;
    const bestAsk = aggregatedData.asks[0]?.price;

    if (!bestBid || !bestAsk) {
      return '0.000%';
    }

    return calculateSpreadPercentage(bestBid, bestAsk);
  }, [aggregatedData.bids, aggregatedData.asks]);
  const intl = useIntl();
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
              {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
            </Text>
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              {intl.formatMessage({ id: ETranslations.global_buy })}
            </Text>
          </View>
          <View style={styles.horizontalHeaderContainer}>
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              {intl.formatMessage({ id: ETranslations.global_sell })}
            </Text>
            <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
              {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
            </Text>
          </View>
        </View>
        {isEmpty ? (
          loadingNode
        ) : (
          <View style={styles.levelListContainer}>
            <View style={styles.levelList}>
              {aggregatedData.bids.map((item, index) => (
                <View
                  key={index}
                  style={{
                    height: 24,
                    alignItems: 'flex-end',
                    marginTop: 1,
                    position: 'relative',
                  }}
                >
                  <ColorBlock
                    color={blockColors.green}
                    right={0}
                    width={`${calculatePercentage(item.cumSize, bidDepth)}%`}
                  />
                </View>
              ))}
            </View>
            <View style={styles.levelList}>
              {aggregatedData.asks.map((item, index) => (
                <View
                  key={index}
                  style={{
                    height: 24,
                    marginTop: 1,
                    position: 'relative',
                  }}
                >
                  <ColorBlock
                    color={blockColors.red}
                    right={0}
                    width={`${calculatePercentage(item.cumSize, bidDepth)}%`}
                  />
                </View>
              ))}
            </View>
            <View style={styles.absoluteContainer}>
              <View style={styles.levelListContainer}>
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
                          style={[
                            styles.monospaceText,
                            { color: textColor.green },
                          ]}
                        >
                          {item.price}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
                <View style={styles.levelList}>
                  {aggregatedData.asks.toReversed().map((item, index) => (
                    <View
                      key={index}
                      style={{
                        height: 24,
                        alignItems: 'center',
                        marginTop: 1,
                        position: 'relative',
                      }}
                    >
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
                          style={[
                            styles.monospaceText,
                            { color: textColor.red },
                          ]}
                        >
                          {item.price}
                        </Text>
                        <Text
                          style={[
                            styles.monospaceText,
                            { color: textColor.text },
                          ]}
                        >
                          {item.size}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={{ padding: 8 }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={styles.verticalHeaderPrice}>
          <Text
            style={[
              styles.verticalHeaderText,
              { textAlign: 'left', color: textColor.textSubdued },
            ]}
          >
            {intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
          </Text>
        </View>
        <View style={styles.verticalHeaderSize}>
          <Text
            style={[
              styles.verticalHeaderText,
              { textAlign: 'right', color: textColor.textSubdued },
            ]}
          >
            {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
          </Text>
        </View>
        <View style={styles.verticalHeaderTotal}>
          <Text
            style={[
              styles.verticalHeaderText,
              { textAlign: 'right', color: textColor.textSubdued },
            ]}
          >
            {intl.formatMessage({ id: ETranslations.perp_orderbook_total })}
          </Text>
        </View>
      </View>
      <View style={styles.relativeContainer}>
        <View style={styles.relativeContainer}>
          {aggregatedData.asks.toReversed().map((itemData, index) => (
            <View key={index} style={styles.blockRow}>
              <ColorBlock
                color={blockColors.red}
                left={0}
                width={`${calculatePercentage(itemData.cumSize, askDepth)}%`}
              />
            </View>
          ))}
          <View
            key="mid"
            style={[
              styles.spreadRow,
              { backgroundColor: spreadColor.backgroundColor },
            ]}
          />
          {aggregatedData.bids.map((itemData, index) => (
            <View key={index} style={styles.blockRow}>
              <ColorBlock
                color={blockColors.green}
                left={0}
                width={`${calculatePercentage(itemData.cumSize, bidDepth)}%`}
              />
            </View>
          ))}
        </View>
        <View style={styles.absoluteContainer}>
          {aggregatedData.asks.toReversed().map((itemData, index) => (
            <View key={index} style={styles.blockRow}>
              <OrderBookVerticalRow
                item={itemData}
                priceColor={textColor.red}
                sizeColor={textColor.textSubdued}
              />
            </View>
          ))}
          <View
            key="mid"
            style={[
              styles.spreadRow,
              { backgroundColor: spreadColor.backgroundColor },
            ]}
          >
            <Text style={[styles.bodySm, { color: textColor.text }]}>
              {intl.formatMessage({ id: ETranslations.perp_orderbook_spread })}
            </Text>
            {showTickSelector ? (
              <Select
                floatingPanelProps={{
                  width: 110,
                }}
                title={intl.formatMessage({
                  id: ETranslations.perp_orderbook_spread,
                })}
                items={tickOptions}
                value={selectedTickOption?.value}
                onChange={handleTickOptionChange}
                renderTrigger={({ onPress }) => (
                  <TouchableOpacity
                    style={{
                      width: 56,
                      height: 24,
                      borderRadius: 4,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                    onPress={onPress}
                  >
                    <Text style={[styles.bodySm, { color: textColor.text }]}>
                      {selectedTickOption?.label}
                    </Text>
                    <Icon
                      name="ChevronDownSmallOutline"
                      size="$4"
                      color="$iconSubdued"
                    />
                  </TouchableOpacity>
                )}
              />
            ) : null}
            <Text style={[styles.bodySm, { color: textColor.text }]}>
              {spreadPercentage}
            </Text>
          </View>
          {aggregatedData.bids.map((itemData, index) => (
            <View key={index} style={styles.blockRow}>
              <OrderBookVerticalRow
                item={itemData}
                priceColor={textColor.green}
                sizeColor={textColor.textSubdued}
              />
            </View>
          ))}
        </View>
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
      <Text style={[styles.monospaceText, { color: priceColor }]}>
        {item.price}
      </Text>
      <Text style={[styles.monospaceText, { color: sizeColor }]}>
        {item.size}
      </Text>
    </View>
  );
}

export function OrderPairBook({
  symbol: _symbol,
  bids,
  asks,
  maxLevelsPerSide = 30,
  selectedTickOption,
}: {
  symbol?: string;
  maxLevelsPerSide?: number;
  bids: IBookLevel[];
  asks: IBookLevel[];
  selectedTickOption?: ITickParam;
}) {
  const intl = useIntl();
  const aggregatedData = useAggregatedBook(
    bids,
    asks,
    maxLevelsPerSide,
    selectedTickOption,
    2, // default priceDecimals
    4, // default sizeDecimals
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

  // Calculate spread percentage from best bid/ask
  const spreadPercentage = useMemo(() => {
    const bestBid = aggregatedData.bids[0]?.price;
    const bestAsk = aggregatedData.asks[0]?.price;

    if (!bestBid || !bestAsk) {
      return '0.000%';
    }

    return calculateSpreadPercentage(bestBid, bestAsk);
  }, [aggregatedData.bids, aggregatedData.asks]);
  return (
    <View style={{ padding: 8 }}>
      <View style={styles.pairBookHeader}>
        <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
          {intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
        </Text>
        <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
          {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
        </Text>
      </View>
      <View style={styles.relativeContainer}>
        <View style={styles.relativeContainer}>
          {aggregatedData.asks.map((itemData, index) => (
            <View key={index} style={styles.pairBookRow}>
              <ColorBlock
                color={blockColors.red}
                left={0}
                width={`${calculatePercentage(itemData.cumSize, askDepth)}%`}
              />
            </View>
          ))}
          <View style={styles.pairBookSpreadRow} />
          {aggregatedData.bids.map((itemData, index) => (
            <View key={index} style={styles.pairBookRow}>
              <ColorBlock
                color={blockColors.green}
                left={0}
                width={`${calculatePercentage(itemData.cumSize, bidDepth)}%`}
              />
            </View>
          ))}
        </View>
        <View style={styles.absoluteContainer}>
          {aggregatedData.asks.map((itemData, index) => (
            <View key={index} style={styles.pairBookRow}>
              <OrderBookPairRow
                item={itemData}
                priceColor={textColor.red}
                sizeColor={textColor.textSubdued}
              />
            </View>
          ))}
          <View style={styles.pairBookSpreadRow}>
            <Text style={[styles.bodySm, { color: textColor.textSubdued }]}>
              {intl.formatMessage({ id: ETranslations.perp_orderbook_spread })}
            </Text>
            <Text style={[styles.bodySm, { color: textColor.textSubdued }]}>
              {midPrice}
            </Text>
            <Text style={[styles.bodySm, { color: textColor.textSubdued }]}>
              {spreadPercentage}
            </Text>
          </View>
          {aggregatedData.bids.map((itemData, index) => (
            <View key={index} style={styles.pairBookRow}>
              <OrderBookPairRow
                item={itemData}
                priceColor={textColor.green}
                sizeColor={textColor.textSubdued}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
