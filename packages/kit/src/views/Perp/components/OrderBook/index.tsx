/* eslint-disable spellcheck/spell-checker */

import { useCallback, useMemo } from 'react';

import { colorTokens } from '@tamagui/themes';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  DebugRenderTracker,
  Haptics,
  Icon,
  Popover,
  Select,
  SizableText,
  YStack,
  useTheme,
  useThemeName,
} from '@onekeyhq/components';
import { usePerpsActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { calculateSpreadPercentage } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { DefaultLoadingNode } from './DefaultLoadingNode';
import { type ITickParam } from './tickSizeUtils';
import { useAggregatedBook } from './useAggregatedBook';
import { getMidPrice } from './utils';

import type { IFormattedOBLevel } from './types';
import type {
  DimensionValue,
  PressableStateCallbackType,
  StyleProp,
  ViewStyle,
} from 'react-native';

export const rowHeight = 24;

type IWebPointerStyle = ViewStyle & { cursor?: string };

const getPressableHoverState = (state: PressableStateCallbackType): boolean => {
  if (!platformEnv.isNative) {
    return Boolean((state as { hovered?: boolean }).hovered);
  }
  return state.pressed;
};

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
  /** Callback when a price level is selected */
  onSelectLevel?: (payload: IOrderBookSelection) => void;
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
    width: '100%',
    height: '100%',
  },
  levelList: {
    flex: 1,
    minWidth: 0,
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
    fontFamily: platformEnv.isNative ? 'GeistMono-Regular' : 'SFMono-Regular',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  monospaceTextBold: {
    fontWeight: '600',
  },
  interactiveRow: {
    height: rowHeight,
    marginTop: 1,
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  interactiveRowContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
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
    width: '33%',
    alignItems: 'flex-start',
  },
  verticalHeaderSize: {
    width: '30%',
    alignItems: 'flex-end',
  },
  verticalHeaderTotal: {
    width: '37%',
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
    width: '33%',
    alignItems: 'flex-start',
  },
  verticalRowCellSize: {
    width: '30%',
    alignItems: 'flex-end',
  },
  verticalRowCellTotal: {
    width: '37%',
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
  pointer: {
    cursor: 'pointer',
  } as IWebPointerStyle,
});

type IColorBlockProps = {
  color: string;
  width: DimensionValue;
  left?: number;
  right?: number;
  height?: number;
};

export type IOrderBookSelection = {
  price: string;
  size: string;
  cumSize: string;
  side: 'bid' | 'ask';
  index: number;
};

function ColorBlock({ color, width, left, right, height }: IColorBlockProps) {
  return (
    <View
      style={[
        styles.colorBlock,
        {
          height: height ?? rowHeight,
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
  isHovered = false,
}: {
  item: IFormattedOBLevel;
  priceColor: string;
  sizeColor: string;
  isHovered?: boolean;
}) {
  const fontWeightStyle = isHovered ? styles.monospaceTextBold : null;
  return (
    <DebugRenderTracker name="OrderBookVerticalRow" position="right-center">
      <View style={styles.verticalRowContainer}>
        <View style={styles.verticalRowCellPrice}>
          <Text
            style={[
              styles.monospaceText,
              { color: priceColor },
              fontWeightStyle,
            ]}
            numberOfLines={1}
          >
            {item.price}
          </Text>
        </View>
        <View style={styles.verticalRowCellSize}>
          <Text
            numberOfLines={1}
            style={[
              styles.monospaceText,
              { color: sizeColor },
              fontWeightStyle,
            ]}
          >
            {item.displaySize}
          </Text>
        </View>
        <View style={styles.verticalRowCellTotal}>
          <Text
            numberOfLines={1}
            style={[
              styles.monospaceText,
              { color: sizeColor },
              fontWeightStyle,
            ]}
          >
            {item.displayCumSize}
          </Text>
        </View>
      </View>
    </DebugRenderTracker>
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

// Lighter background colors for compact/mobile presentation
const useBlockColorsMobile = () => {
  const themeName = useThemeName();
  return useMemo(() => {
    return {
      red: colorTokens[themeName].red.red3,
      green: colorTokens[themeName].green.green3,
    };
  }, [themeName]);
};

export function OrderBook({
  symbol: _symbol,
  bids,
  asks,
  maxLevelsPerSide = 30,
  style,
  midPriceNode: _midPriceNode = defaultMidPriceNode,
  loadingNode = <DefaultLoadingNode variant="desktop" />,
  horizontal = true,
  selectedTickOption,
  onTickOptionChange,
  tickOptions = [],
  showTickSelector = true,
  priceDecimals = 2,
  sizeDecimals = 4,
  onSelectLevel,
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
  const isInteractive = Boolean(onSelectLevel);

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

  const handleSelectLevel = useCallback(
    (side: 'bid' | 'ask', item: IFormattedOBLevel, index: number) => {
      if (!onSelectLevel) {
        return;
      }
      if (platformEnv.isNative) {
        Haptics.selection();
      }
      onSelectLevel({
        price: item.price,
        size: item.size,
        cumSize: item.cumSize,
        side,
        index,
      });
    },
    [onSelectLevel],
  );

  if (horizontal) {
    return (
      <View style={[styles.container, style]}>
        <DebugRenderTracker
          name="OrderBookHorizontalHeader"
          position="right-center"
        >
          <View
            style={{
              gap: 4,
              height: 16,
              alignItems: 'center',
              flexDirection: 'row',
            }}
          >
            <View style={styles.horizontalHeaderContainer}>
              <Text
                style={[styles.headerText, { color: textColor.textSubdued }]}
              >
                {intl.formatMessage({ id: ETranslations.global_buy })}
              </Text>
              {showTickSelector ? (
                <Select
                  floatingPanelProps={{
                    width: 150,
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
                        minWidth: 1,
                        maxWidth: 150,
                        height: 16,
                        borderRadius: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: 8,
                        gap: 4,
                      }}
                      onPress={onPress}
                    >
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.bodySm, { color: textColor.text }]}
                      >
                        {selectedTickOption?.label
                          ? new BigNumber(selectedTickOption.label).toFixed(
                              priceDecimals,
                            )
                          : '-'}
                      </Text>
                      <Icon
                        name="ChevronDownSmallOutline"
                        size="$3"
                        color="$iconSubdued"
                      />
                    </TouchableOpacity>
                  )}
                />
              ) : null}
              <Text
                style={[styles.headerText, { color: textColor.textSubdued }]}
              >
                {intl.formatMessage({ id: ETranslations.global_sell })}
              </Text>
            </View>
          </View>
        </DebugRenderTracker>
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
                    width={`${calculatePercentage(item.cumSize, askDepth)}%`}
                  />
                </View>
              ))}
            </View>
            <View style={styles.absoluteContainer}>
              <View style={styles.levelListContainer}>
                <View style={styles.levelList}>
                  {aggregatedData.bids.map((item, index) => (
                    <Pressable
                      key={index}
                      onPress={() => handleSelectLevel('bid', item, index)}
                      disabled={!isInteractive}
                      style={() => [
                        styles.interactiveRow,
                        isInteractive && !platformEnv.isNative
                          ? styles.pointer
                          : null,
                      ]}
                    >
                      {(state) => {
                        const isHovered = getPressableHoverState(state);
                        return (
                          <View style={styles.interactiveRowContent}>
                            <Text
                              style={[
                                styles.monospaceText,
                                { color: textColor.textSubdued },
                                isHovered ? styles.monospaceTextBold : null,
                              ]}
                            >
                              {item.displaySize}
                            </Text>
                            <Text
                              style={[
                                styles.monospaceText,
                                { color: textColor.green },
                                isHovered ? styles.monospaceTextBold : null,
                              ]}
                            >
                              {item.price}
                            </Text>
                          </View>
                        );
                      }}
                    </Pressable>
                  ))}
                </View>
                <View style={styles.levelList}>
                  {aggregatedData.asks.map((item, index) => (
                    <Pressable
                      key={index}
                      onPress={() => handleSelectLevel('ask', item, index)}
                      disabled={!isInteractive}
                      style={() => [
                        styles.interactiveRow,
                        isInteractive && !platformEnv.isNative
                          ? styles.pointer
                          : null,
                      ]}
                    >
                      {(state) => {
                        const isHovered = getPressableHoverState(state);
                        return (
                          <View style={styles.interactiveRowContent}>
                            <Text
                              style={[
                                styles.monospaceText,
                                { color: textColor.red },
                                isHovered ? styles.monospaceTextBold : null,
                              ]}
                            >
                              {item.price}
                            </Text>
                            <Text
                              style={[
                                styles.monospaceText,
                                { color: textColor.text },
                                isHovered ? styles.monospaceTextBold : null,
                              ]}
                            >
                              {item.displaySize}
                            </Text>
                          </View>
                        );
                      }}
                    </Pressable>
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
      <DebugRenderTracker
        name="OrderBookVerticalHeader"
        position="right-center"
      >
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
      </DebugRenderTracker>
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
          {aggregatedData.asks.toReversed().map((itemData, index) => {
            const originalIndex = aggregatedData.asks.length - 1 - index;
            return (
              <Pressable
                key={index}
                disabled={!isInteractive}
                onPress={() =>
                  handleSelectLevel('ask', itemData, originalIndex)
                }
                style={() => [
                  styles.blockRow,
                  isInteractive && !platformEnv.isNative
                    ? styles.pointer
                    : null,
                ]}
              >
                {(state) => (
                  <OrderBookVerticalRow
                    item={itemData}
                    priceColor={textColor.red}
                    sizeColor={textColor.textSubdued}
                    isHovered={getPressableHoverState(state)}
                  />
                )}
              </Pressable>
            );
          })}
          <DebugRenderTracker name="OrderBookSpreadRow" position="right-center">
            <View
              key="mid"
              style={[
                styles.spreadRow,
                { backgroundColor: spreadColor.backgroundColor },
              ]}
            >
              <Text style={[styles.bodySm, { color: textColor.text }]}>
                {intl.formatMessage({
                  id: ETranslations.perp_orderbook_spread,
                })}
              </Text>
              {showTickSelector ? (
                <Select
                  floatingPanelProps={{
                    width: 150,
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
                        minWidth: 56,
                        maxWidth: 150,
                        height: 24,
                        borderRadius: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 8,
                        gap: 4,
                      }}
                      onPress={onPress}
                    >
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.bodySm, { color: textColor.text }]}
                      >
                        {selectedTickOption?.label
                          ? new BigNumber(selectedTickOption.label).toFixed(
                              priceDecimals,
                            )
                          : '-'}
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
          </DebugRenderTracker>
          {aggregatedData.bids.map((itemData, index) => (
            <Pressable
              key={index}
              disabled={!isInteractive}
              onPress={() => handleSelectLevel('bid', itemData, index)}
              style={() => [
                styles.blockRow,
                isInteractive && !platformEnv.isNative ? styles.pointer : null,
              ]}
            >
              {(state) => (
                <OrderBookVerticalRow
                  item={itemData}
                  priceColor={textColor.green}
                  sizeColor={textColor.textSubdued}
                  isHovered={getPressableHoverState(state)}
                />
              )}
            </Pressable>
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
  isHovered = false,
}: {
  item: IFormattedOBLevel;
  priceColor: string;
  sizeColor: string;
  isHovered?: boolean;
}) {
  const fontWeightStyle = isHovered ? styles.monospaceTextBold : null;
  return (
    <DebugRenderTracker name="OrderBookPairRow" position="right-center">
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          marginTop: 1,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text
          style={[styles.monospaceText, { color: priceColor }, fontWeightStyle]}
        >
          {item.price}
        </Text>
        <Text
          style={[styles.monospaceText, { color: sizeColor }, fontWeightStyle]}
        >
          {item.displaySize}
        </Text>
      </View>
    </DebugRenderTracker>
  );
}

export function OrderPairBook({
  symbol: _symbol,
  bids,
  asks,
  maxLevelsPerSide = 30,
  selectedTickOption,
  onSelectLevel,
}: {
  symbol?: string;
  maxLevelsPerSide?: number;
  bids: IBookLevel[];
  asks: IBookLevel[];
  selectedTickOption?: ITickParam;
  onSelectLevel?: (payload: IOrderBookSelection) => void;
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
  const isInteractive = Boolean(onSelectLevel);

  const handleSelectLevel = useCallback(
    (side: 'bid' | 'ask', item: IFormattedOBLevel, index: number) => {
      if (!onSelectLevel) {
        return;
      }
      if (platformEnv.isNative) {
        Haptics.selection();
      }
      onSelectLevel({
        price: item.price,
        size: item.size,
        cumSize: item.cumSize,
        side,
        index,
      });
    },
    [onSelectLevel],
  );

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
      <DebugRenderTracker name="OrderPairBookHeader" position="right-center">
        <View style={styles.pairBookHeader}>
          <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
            {intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
          </Text>
          <Text style={[styles.headerText, { color: textColor.textSubdued }]}>
            {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
          </Text>
        </View>
      </DebugRenderTracker>
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
            <Pressable
              key={index}
              disabled={!isInteractive}
              onPress={() => handleSelectLevel('ask', itemData, index)}
              style={() => [
                styles.pairBookRow,
                isInteractive && !platformEnv.isNative ? styles.pointer : null,
              ]}
            >
              {(state) => (
                <OrderBookPairRow
                  item={itemData}
                  priceColor={textColor.red}
                  sizeColor={textColor.textSubdued}
                  isHovered={getPressableHoverState(state)}
                />
              )}
            </Pressable>
          ))}
          <DebugRenderTracker
            name="OrderPairBookSpreadRow"
            position="right-center"
          >
            <View style={styles.pairBookSpreadRow}>
              <Text style={[styles.bodySm, { color: textColor.textSubdued }]}>
                {intl.formatMessage({
                  id: ETranslations.perp_orderbook_spread,
                })}
              </Text>
              <Text style={[styles.bodySm, { color: textColor.textSubdued }]}>
                {midPrice}
              </Text>
              <Text style={[styles.bodySm, { color: textColor.textSubdued }]}>
                {spreadPercentage}
              </Text>
            </View>
          </DebugRenderTracker>
          {aggregatedData.bids.map((itemData, index) => (
            <Pressable
              key={index}
              disabled={!isInteractive}
              onPress={() => handleSelectLevel('bid', itemData, index)}
              style={() => [
                styles.pairBookRow,
                isInteractive && !platformEnv.isNative ? styles.pointer : null,
              ]}
            >
              {(state) => (
                <OrderBookPairRow
                  item={itemData}
                  priceColor={textColor.green}
                  sizeColor={textColor.textSubdued}
                  isHovered={getPressableHoverState(state)}
                />
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

// Compact row height for mobile
const MOBILE_ROW_GAP = 0;
const MOBILE_ROW_HEIGHT = 20;
const MOBILE_SPREAD_ROW_HEIGHT = 40;
const MOBILE_PRICE_FLEX = 0.6;
const MOBILE_SIZE_FLEX = 0.4;
const MobileRow = ({
  item,
  priceColor,
  sizeColor,
  isHovered = false,
}: {
  item: IFormattedOBLevel;
  priceColor: string;
  sizeColor: string;
  isHovered?: boolean;
}) => (
  <DebugRenderTracker name="OrderBookMobileRow" position="right-center">
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: MOBILE_ROW_HEIGHT,
      }}
    >
      <View style={{ flex: MOBILE_PRICE_FLEX }}>
        <Text
          numberOfLines={1}
          style={[
            styles.monospaceText,
            {
              color: priceColor,
              fontSize: 11,
              lineHeight: 14,
            },
            isHovered ? styles.monospaceTextBold : null,
          ]}
        >
          {item.price}
        </Text>
      </View>
      <View style={{ flex: MOBILE_SIZE_FLEX, alignItems: 'flex-end' }}>
        <Text
          numberOfLines={1}
          style={[
            styles.monospaceText,
            {
              color: sizeColor,
              fontSize: 11,
              lineHeight: 14,
            },
            isHovered ? styles.monospaceTextBold : null,
          ]}
        >
          {item.displaySize}
        </Text>
      </View>
    </View>
  </DebugRenderTracker>
);

// A compact, mobile-friendly order book: two columns (Price/Size),
// asks on top, bids at bottom, with a prominent spread row in the middle.
export function OrderBookMobile({
  symbol: _symbol,
  bids,
  asks,
  maxLevelsPerSide = 14,
  selectedTickOption,
  priceDecimals = 2,
  sizeDecimals = 3,
  style,
  onSelectLevel,
  showTickSelector = true,
  tickOptions = [],
  onTickOptionChange,
}: IOrderBookProps) {
  const intl = useIntl();
  const [assetCtx] = usePerpsActiveAssetCtxAtom();
  const { markPrice } = assetCtx?.ctx || {
    markPrice: '0',
    oraclePrice: '0',
  };
  const aggregatedData = useAggregatedBook(
    bids,
    asks,
    maxLevelsPerSide,
    selectedTickOption,
    priceDecimals,
    sizeDecimals,
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

  const textColor = useTextColor();
  const blockColors = useBlockColorsMobile();
  const spreadColor = useSpreadColor();
  const isInteractive = Boolean(onSelectLevel);

  const handleSelectLevel = useCallback(
    (side: 'bid' | 'ask', item: IFormattedOBLevel, index: number) => {
      if (!onSelectLevel) {
        return;
      }
      if (platformEnv.isNative) {
        Haptics.selection();
      }
      onSelectLevel({
        price: item.price,
        size: item.size,
        cumSize: item.cumSize,
        side,
        index,
      });
    },
    [onSelectLevel],
  );

  return (
    <View style={style}>
      <DebugRenderTracker name="OrderBookMobileHeader" position="right-center">
        <View style={styles.pairBookHeader}>
          <View style={{ flexDirection: 'row', width: '100%' }}>
            <View style={{ flex: MOBILE_PRICE_FLEX }}>
              <Text
                style={[
                  styles.headerText,
                  {
                    color: textColor.textSubdued,
                    fontSize: 11,
                    lineHeight: 14,
                  },
                ]}
              >
                {intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
              </Text>
              <Text
                style={[
                  styles.headerText,
                  {
                    color: textColor.textSubdued,
                    fontSize: 10,
                    lineHeight: 12,
                  },
                ]}
              >
                (USD)
              </Text>
            </View>
            <View
              style={{
                flex: MOBILE_SIZE_FLEX,
                alignItems: 'flex-end',
              }}
            >
              <Text
                style={[
                  styles.headerText,
                  {
                    color: textColor.textSubdued,
                    fontSize: 11,
                    lineHeight: 14,
                  },
                ]}
              >
                {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
              </Text>
              <Text
                style={[
                  styles.headerText,
                  {
                    color: textColor.textSubdued,
                    fontSize: 10,
                    lineHeight: 12,
                  },
                ]}
              >
                ({_symbol ?? ''})
              </Text>
            </View>
          </View>
        </View>
      </DebugRenderTracker>
      <View style={styles.relativeContainer}>
        {/* background depth bars */}
        <View style={styles.relativeContainer}>
          {aggregatedData.asks.toReversed().map((itemData, index) => (
            <View
              key={index}
              style={{ position: 'relative', height: MOBILE_ROW_HEIGHT }}
            >
              <ColorBlock
                color={blockColors.red}
                left={0}
                height={MOBILE_ROW_HEIGHT - MOBILE_ROW_GAP}
                width={`${calculatePercentage(itemData.cumSize, askDepth)}%`}
              />
            </View>
          ))}
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              height: MOBILE_SPREAD_ROW_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
          {aggregatedData.bids.map((itemData, index) => (
            <View
              key={index}
              style={{ position: 'relative', height: MOBILE_ROW_HEIGHT }}
            >
              <ColorBlock
                color={blockColors.green}
                left={0}
                height={MOBILE_ROW_HEIGHT - MOBILE_ROW_GAP}
                width={`${calculatePercentage(itemData.cumSize, bidDepth)}%`}
              />
            </View>
          ))}
        </View>

        {/* foreground texts */}
        <View style={styles.absoluteContainer}>
          {aggregatedData.asks.toReversed().map((itemData, index) => {
            const originalIndex = aggregatedData.asks.length - 1 - index;
            return (
              <Pressable
                key={index}
                disabled={!isInteractive}
                onPress={() =>
                  handleSelectLevel('ask', itemData, originalIndex)
                }
                style={() => [
                  {
                    height: MOBILE_ROW_HEIGHT,
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  },
                  isInteractive && !platformEnv.isNative
                    ? styles.pointer
                    : null,
                ]}
              >
                {(state) => (
                  <MobileRow
                    item={itemData}
                    priceColor={textColor.red}
                    sizeColor={textColor.textSubdued}
                    isHovered={getPressableHoverState(state)}
                  />
                )}
              </Pressable>
            );
          })}
          <DebugRenderTracker
            name="OrderBookMobileSpreadRow"
            position="right-center"
          >
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                justifyContent: 'space-between',
                height: MOBILE_SPREAD_ROW_HEIGHT,
              }}
            >
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.perp_order_mid_price_title,
                })}
                renderTrigger={
                  <Text
                    style={[
                      styles.monospaceText,
                      {
                        color: textColor.red,
                        fontSize: 18,
                        fontWeight: '600',
                        lineHeight: 24,
                      },
                    ]}
                  >
                    {midPrice}
                  </Text>
                }
                renderContent={
                  <YStack px="$5" pb="$4">
                    <SizableText>
                      {intl.formatMessage({
                        id: ETranslations.perp_order_mid_price_title_desc,
                      })}
                    </SizableText>
                  </YStack>
                }
              />
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.perp_position_mark_price,
                })}
                renderTrigger={
                  <Text
                    style={[
                      styles.monospaceText,
                      {
                        color: textColor.textSubdued,
                        fontSize: 10,
                        fontWeight: '400',
                        lineHeight: 16,
                        textDecorationLine: 'underline',
                        textDecorationStyle: 'dotted',
                      },
                    ]}
                  >
                    {markPrice}
                  </Text>
                }
                renderContent={
                  <YStack px="$5" pb="$4">
                    <SizableText>
                      {intl.formatMessage({
                        id: ETranslations.perp_mark_price_tooltip,
                      })}
                    </SizableText>
                  </YStack>
                }
              />
            </View>
          </DebugRenderTracker>
          {aggregatedData.bids.map((itemData, index) => (
            <Pressable
              key={index}
              disabled={!isInteractive}
              onPress={() => handleSelectLevel('bid', itemData, index)}
              style={() => [
                {
                  height: MOBILE_ROW_HEIGHT,
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                },
                isInteractive && !platformEnv.isNative ? styles.pointer : null,
              ]}
            >
              {(state) => (
                <MobileRow
                  item={itemData}
                  priceColor={textColor.green}
                  sizeColor={textColor.textSubdued}
                  isHovered={getPressableHoverState(state)}
                />
              )}
            </Pressable>
          ))}
        </View>
      </View>
      {showTickSelector ? (
        <Select
          floatingPanelProps={{
            width: 150,
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
                minWidth: 56,
                maxWidth: 150,
                height: 24,
                borderRadius: 4,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 8,
                gap: 4,
                backgroundColor: spreadColor.backgroundColor,
                marginTop: 10,
              }}
              onPress={onPress}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.bodySm, { color: textColor.text }]}
              >
                {selectedTickOption?.label
                  ? new BigNumber(selectedTickOption.label).toFixed(
                      priceDecimals,
                    )
                  : '-'}
              </Text>
              <Icon name="ChevronTriangleDownSmallOutline" size="$5" />
            </TouchableOpacity>
          )}
        />
      ) : null}
    </View>
  );
}
