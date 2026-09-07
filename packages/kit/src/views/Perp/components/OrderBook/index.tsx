import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  DashText,
  DebugRenderTracker,
  Haptics,
  Icon,
  Popover,
  Portal,
  Select,
  SizableText,
  Stack,
  TABULAR_NUMS,
  YStack,
  useTheme,
  useThemeName,
} from '@onekeyhq/components';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useSpotActiveAssetCtxAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  formatLocalizedNumberString,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  calculateSpreadPercentage,
  getOrderBookSizeDisplaySymbol,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IBookLevel } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { usePerpsActiveAssetCtxDisplay } from '../../hooks/usePerpsActiveAssetCtxDisplay';
import { useTradingPrice } from '../../hooks/useTradingPrice';
import {
  ORDER_BOOK_SIDE_RATIO_GAP,
  ORDER_BOOK_SIDE_RATIO_RESERVED_HEIGHT,
  getVerticalOrderBookLayout,
} from '../../layouts/perpLayoutUtils';
import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../../utils/mobileLayoutTrace';

import {
  DepthBar,
  DepthBarColumn,
  SideRatioSegments,
} from './AnimatedDepthBlock';
import {
  ORDER_BOOK_HORIZONTAL_BAR_INSET,
  ORDER_BOOK_HORIZONTAL_ROW_HEIGHT,
  ORDER_BOOK_HORIZONTAL_ROW_MARGIN_TOP,
  ORDER_BOOK_MOBILE_BAR_INSET,
  ORDER_BOOK_MOBILE_ROW_HEIGHT,
  ORDER_BOOK_MOBILE_ROW_MARGIN_TOP,
  ORDER_BOOK_MOBILE_SPREAD_ROW_HEIGHT,
  ORDER_BOOK_VERTICAL_BAR_INSET,
  ORDER_BOOK_VERTICAL_ROW_MARGIN_TOP,
} from './AnimatedDepthBlock.shared';
import { DefaultLoadingNode } from './DefaultLoadingNode';
import { type ITickParam } from './tickSizeUtils';
import { useAggregatedBook } from './useAggregatedBook';
import { useRafCoalesced } from './useRafCoalesced';
import {
  getOrderBookDistanceFromMid,
  getOrderBookHoverSummary,
  getOrderBookLiveMidPrice,
  getOrderBookMidPrice,
} from './utils';

import type { IFormattedOBLevel, IOrderBookVariant } from './types';
import type {
  LayoutChangeEvent,
  PointerEvent,
  StyleProp,
  TextProps,
  ViewStyle,
} from 'react-native';

export function PerpBookText({ children, style, ...props }: TextProps) {
  return (
    <Text allowFontScaling={false} style={style} {...props}>
      {children}
    </Text>
  );
}

export const rowHeight = 24;

type IWebPointerStyle = ViewStyle & { cursor?: string };
type IWebRectElement = {
  getBoundingClientRect: () => {
    left: number;
    right: number;
  };
};
const ORDER_BOOK_HOVER_SUMMARY_WIDTH = 220;
const ORDER_BOOK_HOVER_SUMMARY_HEIGHT = 102;
const ORDER_BOOK_HOVER_SUMMARY_GAP = 8;
const ORDER_BOOK_HOVER_SUMMARY_VIEWPORT_INSET = 8;

export const defaultMidPriceNode = (midPrice: string) => (
  <PerpBookText>{midPrice}</PerpBookText>
);

const EMPTY_FORMATTED_ORDER_BOOK_LEVEL: IFormattedOBLevel = {
  price: '',
  size: '',
  cumSize: '',
  displayPrice: '--',
  displaySize: '--',
  displayCumSize: '--',
};

// Helper function to calculate percentage with BigNumber precision
function calculatePercentage(cumSize: string, totalDepth: BigNumber): number {
  if (totalDepth.isZero()) return 0;
  const cumSizeBN = new BigNumber(cumSize);
  return cumSizeBN.dividedBy(totalDepth).multipliedBy(100).toNumber();
}

// Monotonic token handed to the native depth-bar view. It bumps whenever the
// data identity changes in a way that must NOT animate (coin switch, tick-size
// change, or empty<->full transition), so the native side snaps to the new
// values instead of sweeping from the previous coin's depths (design §6).
function useOrderBookEpoch(
  coin: string | undefined,
  tickKey: string | undefined,
  isEmpty: boolean,
): number {
  const epochRef = useRef(0);
  const keyRef = useRef<string | null>(null);
  const key = `${coin ?? ''}|${tickKey ?? ''}|${isEmpty ? 1 : 0}`;
  if (keyRef.current !== key) {
    keyRef.current = key;
    epochRef.current += 1;
  }
  return epochRef.current;
}

// useAggregatedBook produces fresh IFormattedOBLevel objects on every l2Book
// tick, so referential equality alone defeats React.memo on the row
// components. This comparator falls back to a shallow content compare on the
// fields actually rendered.
function areLevelRowPropsEqual(
  prev: {
    item: IFormattedOBLevel;
    priceColor: string;
    sizeColor: string;
  },
  next: {
    item: IFormattedOBLevel;
    priceColor: string;
    sizeColor: string;
  },
): boolean {
  if (prev.priceColor !== next.priceColor) return false;
  if (prev.sizeColor !== next.sizeColor) return false;
  if (prev.item === next.item) return true;
  return (
    prev.item.price === next.item.price &&
    prev.item.size === next.item.size &&
    prev.item.cumSize === next.item.cumSize &&
    prev.item.displaySize === next.item.displaySize &&
    prev.item.displayCumSize === next.item.displayCumSize
  );
}

function areSideRatioPropsEqual(
  prev: {
    animated?: boolean;
    bidDepth: BigNumber;
    askDepth: BigNumber;
    size?: 'default' | 'compact' | 'mobile';
  },
  next: {
    animated?: boolean;
    bidDepth: BigNumber;
    askDepth: BigNumber;
    size?: 'default' | 'compact' | 'mobile';
  },
): boolean {
  return (
    prev.animated === next.animated &&
    prev.size === next.size &&
    (prev.bidDepth === next.bidDepth || prev.bidDepth.eq(next.bidDepth)) &&
    (prev.askDepth === next.askDepth || prev.askDepth.eq(next.askDepth))
  );
}

interface IOrderBookProps {
  /** The sorted best to worst (high to low) bid levels */
  bids: IBookLevel[];
  /** The sorted best to worst (low to high) ask levels */
  asks: IBookLevel[];
  /** The maximum price levels to render per side */
  maxLevelsPerSide?: number;
  /** Initial container height for the first vertical render before onLayout fires */
  initialContainerHeight?: number;
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
  /** Callback when the mobile mid price is selected */
  onSelectMidPrice?: (price: string) => void;
  /** The current order book display variant */
  variant: IOrderBookVariant;
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
  mobileHeaderText: {
    fontFamily: platformEnv.isNative ? 'Roobert-Regular' : undefined,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '400',
  },
  verticalHeaderText: {
    fontSize: 12,
    lineHeight: 24,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    width: '100%',
  },
  tabularText: {
    // Not a mono face: the app font (Roobert) ships tabular figures via the
    // `tnum` OpenType feature, so digits stay column-aligned while letters keep
    // their natural proportional widths. Native raw <Text> can't pick a weight
    // from a custom family via fontWeight, so name the medium face explicitly.
    fontFamily: platformEnv.isNative ? 'Roobert-Medium' : undefined,
    fontVariant: TABULAR_NUMS,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  nativeMobileHorizontalTabularText: {
    fontFamily: 'Roobert-Regular',
    fontWeight: '400',
  },
  interactiveRow: {
    height: rowHeight,
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
  verticalHeaderContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  verticalHeaderPrice: {
    paddingLeft: 8,
    width: '33%',
    alignItems: 'flex-start',
  },
  verticalHeaderSize: {
    width: '30%',
    alignItems: 'flex-end',
  },
  verticalHeaderTotal: {
    paddingRight: 8,
    width: '37%',
    alignItems: 'flex-end',
  },
  horizontalHeaderContainer: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-between',
  },
  verticalRowContainer: {
    paddingHorizontal: 7,
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
  hoverRangeAskBoundary: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  hoverRangeBidBoundary: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  hoverSummaryRow: {
    minWidth: 176,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  hoverSummaryLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  hoverSummaryValue: {
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    fontVariant: TABULAR_NUMS,
  },
  sideRatioContainer: {
    height: ORDER_BOOK_SIDE_RATIO_RESERVED_HEIGHT - ORDER_BOOK_SIDE_RATIO_GAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: ORDER_BOOK_SIDE_RATIO_GAP,
    paddingHorizontal: 8,
  },
  sideRatioTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sideRatioContainerCompact: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  sideRatioTrackCompact: {
    gap: 3,
  },
  sideRatioContainerMobile: {
    height: 18,
    gap: 3,
    marginTop: 2,
    marginBottom: 0,
    paddingHorizontal: 2,
  },
  sideRatioTrackMobile: {
    gap: 2,
  },
  sideRatioSegment: {
    height: 4,
  },
  sideRatioSegmentStart: {
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
  },
  sideRatioSegmentEnd: {
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  sideRatioLabel: {
    fontFamily: platformEnv.isNative ? 'Roobert-Medium' : undefined,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontVariant: TABULAR_NUMS,
  },
  sideRatioLabelCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
  sideRatioLabelMobile: {
    fontSize: 9,
    lineHeight: 12,
  },
});

export type IOrderBookSelection = {
  price: string;
  size: string;
  cumSize: string;
  side: 'bid' | 'ask';
  index: number;
};

type IHoveredOrderBookLevel = {
  side: 'bid' | 'ask';
  index: number;
  epoch: number;
  overlayLeft: number;
  overlayTop: number;
};

function formatSideRatioPercentage(value: number) {
  return `${Math.round(value)}%`;
}

const OrderBookVerticalRow = memo(
  ({
    item,
    priceColor,
    sizeColor,
  }: {
    item: IFormattedOBLevel;
    priceColor: string;
    sizeColor: string;
  }) => {
    return (
      <DebugRenderTracker name="OrderBookVerticalRow" position="right-center">
        <View style={styles.verticalRowContainer}>
          <View style={styles.verticalRowCellPrice}>
            <PerpBookText
              style={[styles.tabularText, { color: priceColor }]}
              numberOfLines={1}
            >
              {item.displayPrice}
            </PerpBookText>
          </View>
          <View style={styles.verticalRowCellSize}>
            <PerpBookText
              numberOfLines={1}
              style={[styles.tabularText, { color: sizeColor }]}
            >
              {item.displaySize}
            </PerpBookText>
          </View>
          <View style={styles.verticalRowCellTotal}>
            <PerpBookText
              numberOfLines={1}
              style={[styles.tabularText, { color: sizeColor }]}
            >
              {item.displayCumSize}
            </PerpBookText>
          </View>
        </View>
      </DebugRenderTracker>
    );
  },
  areLevelRowPropsEqual,
);
OrderBookVerticalRow.displayName = 'OrderBookVerticalRow';

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
  return useMemo(() => {
    return {
      textSubdued: theme.textSubdued.val,
      text: theme.text.val,
      red: theme.bgCriticalStrong.val,
      green: theme.bgAccent.val,
      hoverBackground: theme.bgHover.val,
      hoverBorder: theme.borderActive.val,
    };
  }, [
    theme.bgAccent.val,
    theme.bgCriticalStrong.val,
    theme.bgHover.val,
    theme.borderActive.val,
    theme.text.val,
    theme.textSubdued.val,
  ]);
};

const useSideRatioColors = () => {
  const theme = useTheme();

  return useMemo(() => {
    return {
      long: theme.bgAccent.val,
      short: theme.bgCriticalStrong.val,
    };
  }, [theme.bgAccent.val, theme.bgCriticalStrong.val]);
};

const useSpreadColor = () => {
  const theme = useTheme();
  return useMemo(() => {
    return {
      backgroundColor: theme.bgSubdued.val,
    };
  }, [theme.bgSubdued]);
};

const OrderBookHoverSummaryContent = memo(
  ({
    averagePrice,
    baseSymbol,
    distanceFromMid,
    quoteSymbol,
    totalNotional,
    totalSize,
  }: {
    averagePrice: string;
    baseSymbol: string;
    distanceFromMid: string;
    quoteSymbol: string;
    totalNotional: string;
    totalSize: string;
  }) => {
    const intl = useIntl();
    const textColor = useTextColor();
    const rows = [
      {
        label: intl.formatMessage({
          id: ETranslations.perp_distance_from_mid__title,
        }),
        value: distanceFromMid,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.perp_average_price__title,
        }),
        value: averagePrice,
      },
      {
        label: `${intl.formatMessage({
          id: ETranslations.perp_orderbook_total,
        })} (${baseSymbol})`,
        value: totalSize,
      },
      {
        label: `${intl.formatMessage({
          id: ETranslations.perp_orderbook_total,
        })} (${quoteSymbol})`,
        value: totalNotional,
      },
    ];

    return (
      <YStack gap="$1">
        {rows.map((row) => (
          <View key={row.label} style={styles.hoverSummaryRow}>
            <PerpBookText
              numberOfLines={1}
              style={[
                styles.hoverSummaryLabel,
                { color: textColor.textSubdued },
              ]}
            >
              {row.label}
            </PerpBookText>
            <PerpBookText
              numberOfLines={1}
              style={[styles.hoverSummaryValue, { color: textColor.text }]}
            >
              {row.value}
            </PerpBookText>
          </View>
        ))}
      </YStack>
    );
  },
);
OrderBookHoverSummaryContent.displayName = 'OrderBookHoverSummaryContent';

const OrderBookHoverSummaryOverlay = memo(
  ({
    averagePrice,
    baseSymbol,
    distanceFromMid,
    overlayLeft,
    overlayTop,
    quoteSymbol,
    totalNotional,
    totalSize,
  }: {
    averagePrice: string;
    baseSymbol: string;
    distanceFromMid: string;
    overlayLeft: number;
    overlayTop: number;
    quoteSymbol: string;
    totalNotional: string;
    totalSize: string;
  }) => (
    <Stack
      pointerEvents="none"
      style={{
        position: 'fixed' as const,
        left: overlayLeft,
        top: overlayTop,
        width: ORDER_BOOK_HOVER_SUMMARY_WIDTH,
        zIndex: 1100,
      }}
    >
      <YStack
        bg="$bg"
        borderWidth="$px"
        borderColor="$borderSubdued"
        borderRadius="$2"
        px="$3"
        py="$2"
        elevation={10}
      >
        <OrderBookHoverSummaryContent
          averagePrice={averagePrice}
          baseSymbol={baseSymbol}
          distanceFromMid={distanceFromMid}
          quoteSymbol={quoteSymbol}
          totalNotional={totalNotional}
          totalSize={totalSize}
        />
      </YStack>
    </Stack>
  ),
);
OrderBookHoverSummaryOverlay.displayName = 'OrderBookHoverSummaryOverlay';

const OrderBookHoverSummaryPortal = memo(
  ({
    averagePrice,
    baseSymbol,
    bestAsk,
    bestBid,
    levelPrice,
    overlayLeft,
    overlayTop,
    quoteSymbol,
    totalNotional,
    totalSize,
  }: {
    averagePrice: string;
    baseSymbol: string;
    bestAsk?: string;
    bestBid?: string;
    levelPrice: string;
    overlayLeft: number;
    overlayTop: number;
    quoteSymbol: string;
    totalNotional: string;
    totalSize: string;
  }) => {
    const { midPrice: liveMidPrice, isValid: hasLiveMidPrice } =
      useTradingPrice();
    const midPrice = getOrderBookMidPrice({
      liveMidPrice: hasLiveMidPrice ? liveMidPrice : undefined,
      bestBid,
      bestAsk,
    });
    const distanceFromMid = getOrderBookDistanceFromMid(levelPrice, midPrice);
    if (distanceFromMid === null) {
      return null;
    }

    return (
      <Portal.Body container={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL}>
        <OrderBookHoverSummaryOverlay
          averagePrice={averagePrice}
          baseSymbol={baseSymbol}
          distanceFromMid={`${formatLocalizedNumberString(
            new BigNumber(distanceFromMid).toFixed(4),
          )}%`}
          overlayLeft={overlayLeft}
          overlayTop={overlayTop}
          quoteSymbol={quoteSymbol}
          totalNotional={totalNotional}
          totalSize={totalSize}
        />
      </Portal.Body>
    );
  },
);
OrderBookHoverSummaryPortal.displayName = 'OrderBookHoverSummaryPortal';

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

const OrderBookSideRatio = memo(
  ({
    animated = true,
    bidDepth,
    askDepth,
    size = 'default',
  }: {
    animated?: boolean;
    bidDepth: BigNumber;
    askDepth: BigNumber;
    size?: 'default' | 'compact' | 'mobile';
  }) => {
    const textColor = useTextColor();
    const sideRatioColors = useSideRatioColors();
    const totalDepth = useMemo(
      () => bidDepth.plus(askDepth),
      [askDepth, bidDepth],
    );
    const { bidPercentage, askPercentage } = useMemo(() => {
      if (totalDepth.isZero()) {
        return {
          bidPercentage: 50,
          askPercentage: 50,
        };
      }

      const bid = bidDepth.dividedBy(totalDepth).multipliedBy(100).toNumber();

      return {
        bidPercentage: bid,
        askPercentage: 100 - bid,
      };
    }, [bidDepth, totalDepth]);
    const isCompact = size === 'compact' || size === 'mobile';
    const isMobile = size === 'mobile';

    return (
      <View
        style={[
          styles.sideRatioContainer,
          isCompact ? styles.sideRatioContainerCompact : null,
          isMobile ? styles.sideRatioContainerMobile : null,
        ]}
      >
        <PerpBookText
          numberOfLines={1}
          style={[
            styles.sideRatioLabel,
            isCompact ? styles.sideRatioLabelCompact : null,
            isMobile ? styles.sideRatioLabelMobile : null,
            { color: textColor.green },
          ]}
        >
          B {formatSideRatioPercentage(bidPercentage)}
        </PerpBookText>

        <View
          style={[
            styles.sideRatioTrack,
            isCompact ? styles.sideRatioTrackCompact : null,
            isMobile ? styles.sideRatioTrackMobile : null,
          ]}
        >
          <SideRatioSegments
            animated={animated}
            bidPercentage={bidPercentage}
            askPercentage={askPercentage}
            longColor={sideRatioColors.long}
            shortColor={sideRatioColors.short}
            segmentStyle={styles.sideRatioSegment}
            startSegmentStyle={styles.sideRatioSegmentStart}
            endSegmentStyle={styles.sideRatioSegmentEnd}
          />
        </View>

        <PerpBookText
          numberOfLines={1}
          style={[
            styles.sideRatioLabel,
            isCompact ? styles.sideRatioLabelCompact : null,
            isMobile ? styles.sideRatioLabelMobile : null,
            {
              color: textColor.red,
              textAlign: 'right',
            },
          ]}
        >
          {formatSideRatioPercentage(askPercentage)} S
        </PerpBookText>
      </View>
    );
  },
  areSideRatioPropsEqual,
);
OrderBookSideRatio.displayName = 'OrderBookSideRatio';

export function OrderBook({
  variant,
  symbol: _symbol,
  bids,
  asks,
  maxLevelsPerSide = 30,
  initialContainerHeight,
  style,
  midPriceNode: _midPriceNode = defaultMidPriceNode,
  loadingNode = <DefaultLoadingNode variant="web" />,
  horizontal = true,
  selectedTickOption,
  onTickOptionChange,
  tickOptions = [],
  showTickSelector = true,
  priceDecimals = 2,
  sizeDecimals = 4,
  onSelectLevel,
}: IOrderBookProps) {
  const isDesktopHoverSummary =
    variant === 'web' && !platformEnv.isNative && !horizontal;
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const [hoveredLevel, setHoveredLevel] =
    useState<IHoveredOrderBookLevel | null>(null);
  const hoverContainerRef = useRef<IWebRectElement | null>(null);
  const hasMeasuredHeightRef = useRef(false);
  const layoutTraceRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(
    undefined,
  );
  const [containerHeight, setContainerHeight] = useState(() =>
    horizontal ? 0 : (initialContainerHeight ?? 0),
  );
  useEffect(() => {
    if (
      horizontal ||
      hasMeasuredHeightRef.current ||
      !initialContainerHeight ||
      Math.abs(containerHeight - initialContainerHeight) < 0.5
    ) {
      return;
    }
    setContainerHeight(initialContainerHeight);
  }, [containerHeight, horizontal, initialContainerHeight]);
  const verticalLayout = useMemo(
    () =>
      horizontal
        ? null
        : getVerticalOrderBookLayout(containerHeight, maxLevelsPerSide),
    [containerHeight, horizontal, maxLevelsPerSide],
  );
  const resolvedMaxLevelsPerSide =
    horizontal || !verticalLayout
      ? maxLevelsPerSide
      : verticalLayout.levelsPerSide;
  const verticalExtraBidLevels = verticalLayout?.extraBidLevels ?? 0;
  const verticalRowHeight = verticalLayout?.rowHeight ?? rowHeight;
  const verticalSpreadControlHeight = Math.max(
    20,
    Math.min(verticalRowHeight, 22),
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

  const aggregatedData = useAggregatedBook(
    variant,
    bids,
    asks,
    resolvedMaxLevelsPerSide,
    selectedTickOption,
    priceDecimals,
    sizeDecimals,
    verticalExtraBidLevels,
  );
  const isEmpty = !aggregatedData.bids.length && !aggregatedData.asks.length;
  const verticalEmptyLevels = useMemo<IFormattedOBLevel[]>(
    () =>
      !horizontal && isEmpty
        ? Array.from(
            { length: resolvedMaxLevelsPerSide + verticalExtraBidLevels },
            () => EMPTY_FORMATTED_ORDER_BOOK_LEVEL,
          )
        : [],
    [horizontal, isEmpty, resolvedMaxLevelsPerSide, verticalExtraBidLevels],
  );
  const depthEpoch = useOrderBookEpoch(
    _symbol,
    selectedTickOption?.value,
    isEmpty,
  );
  const canShowHoverSummary = isDesktopHoverSummary && !isEmpty;
  const baseSymbol = getOrderBookSizeDisplaySymbol({
    coin: _symbol ?? activeTradeInstrument.coin,
    isSpot: activeTradeInstrument.mode === 'spot',
    spotUniverse:
      activeTradeInstrument.mode === 'spot'
        ? activeTradeInstrument.universe
        : undefined,
  });
  const quoteSymbol =
    activeTradeInstrument.mode === 'spot'
      ? (activeTradeInstrument.universe?.quoteName ?? 'USDC')
      : 'USDC';

  const isMobileVariant =
    variant === 'mobileHorizontal' || variant === 'mobileVertical';

  const traceInnerLayout = useCallback(
    (name: string, event: LayoutChangeEvent) => {
      if (!isMobileVariant) {
        return;
      }
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (isPerpsMobileLayoutTraceRectChanged(layoutTraceRef.current, rect)) {
        tracePerpsMobileLayout(`orderBookInner.${name}.layout`, {
          rect,
          variant,
          horizontal,
          maxLevelsPerSide,
          resolvedMaxLevelsPerSide,
          containerHeight,
          rowHeight: verticalRowHeight,
          bidsLength: bids.length,
          asksLength: asks.length,
          isEmpty,
        });
        layoutTraceRef.current = rect;
      }
    },
    [
      asks.length,
      bids.length,
      containerHeight,
      horizontal,
      isEmpty,
      isMobileVariant,
      maxLevelsPerSide,
      resolvedMaxLevelsPerSide,
      variant,
      verticalRowHeight,
    ],
  );

  const handleVerticalLayout = useCallback(
    (event: LayoutChangeEvent) => {
      hasMeasuredHeightRef.current = true;
      const nextHeight = event.nativeEvent.layout.height;
      traceInnerLayout('verticalContainer', event);
      setContainerHeight((prev) =>
        Math.abs(prev - nextHeight) < 0.5 ? prev : nextHeight,
      );
    },
    [traceInnerLayout],
  );

  const bidDepth = useMemo(
    () => new BigNumber(aggregatedData.bids.at(-1)?.cumSize ?? '0'),
    [aggregatedData.bids],
  );
  const askDepth = useMemo(
    () => new BigNumber(aggregatedData.asks.at(-1)?.cumSize ?? '0'),
    [aggregatedData.asks],
  );
  // The extra visual bid row must not skew the B/S ratio, so compare depths
  // over the same number of levels on both sides.
  const ratioBidDepth = useMemo(
    () =>
      new BigNumber(
        aggregatedData.bids[
          Math.min(resolvedMaxLevelsPerSide, aggregatedData.bids.length) - 1
        ]?.cumSize ?? '0',
      ),
    [aggregatedData.bids, resolvedMaxLevelsPerSide],
  );

  // REACT-NATIVE-1JZ: build the native depth-bar `percents` arrays once per data
  // change (useMemo) instead of inside JSX on every render, then frame-coalesce
  // them (useRafCoalesced) so high-frequency L2 ticks collapse to ~one Nitro
  // prop write per displayed frame.
  //
  // Bars and the rows drawn over them must come from one snapshot: coalescing
  // only the percents left a stale depth block behind an updated row, which the
  // native bar's CADisplayLink easing stretches into a visible skew.
  const bidLadderRaw = useMemo(
    () => ({
      percents: aggregatedData.bids.map((item) =>
        calculatePercentage(item.cumSize, bidDepth),
      ),
      levels: aggregatedData.bids,
    }),
    [aggregatedData.bids, bidDepth],
  );
  const askLadderRaw = useMemo(
    () => ({
      percents: aggregatedData.asks.map((item) =>
        calculatePercentage(item.cumSize, askDepth),
      ),
      levels: aggregatedData.asks,
    }),
    [aggregatedData.asks, askDepth],
  );
  // Vertical layout draws asks top-to-bottom reversed; keep its own derived
  // arrays so the reversal isn't recomputed in JSX each render. `levels` rides
  // along for the same reason the horizontal ladders carry it: the rows drawn
  // over these bars, and the tap that resolves against them, have to come from
  // the frame the user is looking at.
  const reversedAskLadderRaw = useMemo(() => {
    const levels = aggregatedData.asks.toReversed();
    return {
      percents: levels.map((item) =>
        calculatePercentage(item.cumSize, askDepth),
      ),
      levels,
    };
  }, [aggregatedData.asks, askDepth]);
  // Mobile is already throttled to 200ms upstream, so coalescing to the frame
  // can merge nothing and only adds latency. Desktop has no such snapshot —
  // bursts still land within a frame there, which REACT-NATIVE-1JZ was about.
  const bidLadder = useRafCoalesced(bidLadderRaw, depthEpoch, !isMobileVariant);
  const askLadder = useRafCoalesced(askLadderRaw, depthEpoch, !isMobileVariant);
  const bidPercents = bidLadder.percents;
  const askPercents = askLadder.percents;
  // Vertical-only, and vertical never renders on a mobile variant.
  const reversedAskLadder = useRafCoalesced(
    reversedAskLadderRaw,
    depthEpoch,
    !isMobileVariant,
  );
  const reversedAskPercents = reversedAskLadder.percents;
  // Drawn from the same snapshot as the bars behind them: reading the live
  // arrays here let a row show a price whose bar had not caught up, and could
  // put a level the user never pressed into the order form.
  let verticalAsks: IFormattedOBLevel[] = [];
  let verticalBids: IFormattedOBLevel[] = [];
  if (!horizontal) {
    verticalAsks = isEmpty
      ? verticalEmptyLevels.slice(0, resolvedMaxLevelsPerSide)
      : reversedAskLadder.levels;
    verticalBids = isEmpty ? verticalEmptyLevels : bidLadder.levels;
  }

  const blockColors = useBlockColors();
  const textColor = useTextColor();
  const spreadColor = useSpreadColor();
  const isInteractive = Boolean(onSelectLevel);
  const mobileHorizontalTabularTextStyle =
    platformEnv.isNative && variant === 'mobileHorizontal'
      ? styles.nativeMobileHorizontalTabularText
      : undefined;

  const hoverSummary = useMemo(() => {
    if (
      !canShowHoverSummary ||
      !hoveredLevel ||
      hoveredLevel.epoch !== depthEpoch
    ) {
      return null;
    }

    const levels =
      hoveredLevel.side === 'ask' ? aggregatedData.asks : aggregatedData.bids;
    const level = levels[hoveredLevel.index];
    const summary = getOrderBookHoverSummary(levels, hoveredLevel.index);
    if (!level || !summary) {
      return null;
    }

    return {
      ...hoveredLevel,
      averagePrice: formatLocalizedNumberString(
        new BigNumber(summary.averagePrice).toFixed(priceDecimals),
      ),
      levelPrice: level.price,
      totalSize: level.displayCumSize,
      totalNotional: numberFormat(summary.totalNotional, {
        formatter: 'marketCap',
      }),
    };
  }, [
    aggregatedData.asks,
    aggregatedData.bids,
    canShowHoverSummary,
    depthEpoch,
    hoveredLevel,
    priceDecimals,
  ]);

  const handleHoverContainerRef = useCallback((node: unknown) => {
    hoverContainerRef.current = node as IWebRectElement | null;
  }, []);

  const handleLevelPointerMove = useCallback(
    (side: 'bid' | 'ask', index: number, event: PointerEvent) => {
      if (!canShowHoverSummary) {
        return;
      }
      const containerRect =
        hoverContainerRef.current?.getBoundingClientRect?.();
      if (!containerRect) {
        return;
      }

      const viewportHeight =
        globalThis.window?.innerHeight ?? Number.POSITIVE_INFINITY;
      const hasRoomOnLeft =
        containerRect.left >=
        ORDER_BOOK_HOVER_SUMMARY_WIDTH + ORDER_BOOK_HOVER_SUMMARY_GAP;
      const overlayLeft = hasRoomOnLeft
        ? containerRect.left -
          ORDER_BOOK_HOVER_SUMMARY_WIDTH -
          ORDER_BOOK_HOVER_SUMMARY_GAP
        : containerRect.right + ORDER_BOOK_HOVER_SUMMARY_GAP;
      const preferredTop =
        event.nativeEvent.clientY - ORDER_BOOK_HOVER_SUMMARY_HEIGHT / 2;
      const overlayTop = Math.min(
        Math.max(preferredTop, ORDER_BOOK_HOVER_SUMMARY_VIEWPORT_INSET),
        Math.max(
          ORDER_BOOK_HOVER_SUMMARY_VIEWPORT_INSET,
          viewportHeight -
            ORDER_BOOK_HOVER_SUMMARY_HEIGHT -
            ORDER_BOOK_HOVER_SUMMARY_VIEWPORT_INSET,
        ),
      );

      setHoveredLevel((current) => {
        if (
          current?.side === side &&
          current.index === index &&
          current.epoch === depthEpoch &&
          current.overlayLeft === overlayLeft &&
          Math.abs(current.overlayTop - overlayTop) < 0.5
        ) {
          return current;
        }
        return {
          side,
          index,
          epoch: depthEpoch,
          overlayLeft,
          overlayTop,
        };
      });
    },
    [canShowHoverSummary, depthEpoch],
  );

  const handleHoverContainerLeave = useCallback(() => {
    setHoveredLevel(null);
  }, []);

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
      <View
        style={[styles.container, style]}
        onLayout={(event) => traceInnerLayout('horizontalContainer', event)}
      >
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
            <View
              style={[
                styles.horizontalHeaderContainer,
                { paddingHorizontal: 4 },
              ]}
            >
              <PerpBookText
                style={[styles.headerText, { color: textColor.textSubdued }]}
              >
                {intl.formatMessage({ id: ETranslations.global_buy })}
              </PerpBookText>
              {showTickSelector ? (
                <Select
                  testID="perp-select"
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
                      <PerpBookText
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.bodySm, { color: textColor.text }]}
                      >
                        {selectedTickOption?.label
                          ? new BigNumber(selectedTickOption.label).toFixed(
                              priceDecimals,
                            )
                          : '-'}
                      </PerpBookText>
                      <Icon
                        name="ChevronDownSmallOutline"
                        size="$3"
                        color="$iconSubdued"
                      />
                    </TouchableOpacity>
                  )}
                />
              ) : null}
              <PerpBookText
                style={[styles.headerText, { color: textColor.textSubdued }]}
              >
                {intl.formatMessage({ id: ETranslations.global_sell })}
              </PerpBookText>
            </View>
          </View>
        </DebugRenderTracker>
        {isEmpty ? (
          loadingNode
        ) : (
          <>
            <OrderBookSideRatio
              bidDepth={bidDepth}
              askDepth={askDepth}
              size="compact"
            />
            <View style={styles.levelListContainer}>
              <View style={styles.levelList}>
                <DepthBarColumn
                  percents={bidPercents}
                  rowHeight={ORDER_BOOK_HORIZONTAL_ROW_HEIGHT}
                  rowMarginTop={ORDER_BOOK_HORIZONTAL_ROW_MARGIN_TOP}
                  barInset={ORDER_BOOK_HORIZONTAL_BAR_INSET}
                  color={blockColors.green}
                  origin="right"
                  epoch={depthEpoch}
                />
              </View>
              <View style={styles.levelList}>
                <DepthBarColumn
                  percents={askPercents}
                  rowHeight={ORDER_BOOK_HORIZONTAL_ROW_HEIGHT}
                  rowMarginTop={ORDER_BOOK_HORIZONTAL_ROW_MARGIN_TOP}
                  barInset={ORDER_BOOK_HORIZONTAL_BAR_INSET}
                  color={blockColors.red}
                  origin="left"
                  epoch={depthEpoch}
                />
              </View>
              <View style={styles.absoluteContainer}>
                <View style={styles.levelListContainer}>
                  <View style={styles.levelList}>
                    {bidLadder.levels.map((item, index) => (
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
                        <View style={styles.interactiveRowContent}>
                          <PerpBookText
                            style={[
                              styles.tabularText,
                              mobileHorizontalTabularTextStyle,
                              { color: textColor.textSubdued },
                            ]}
                          >
                            {item.displaySize}
                          </PerpBookText>
                          <PerpBookText
                            style={[
                              styles.tabularText,
                              mobileHorizontalTabularTextStyle,
                              { color: textColor.green },
                            ]}
                          >
                            {item.displayPrice}
                          </PerpBookText>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.levelList}>
                    {askLadder.levels.map((item, index) => (
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
                        <View style={styles.interactiveRowContent}>
                          <PerpBookText
                            style={[
                              styles.tabularText,
                              mobileHorizontalTabularTextStyle,
                              { color: textColor.red },
                            ]}
                          >
                            {item.displayPrice}
                          </PerpBookText>
                          <PerpBookText
                            style={[
                              styles.tabularText,
                              mobileHorizontalTabularTextStyle,
                              { color: textColor.textSubdued },
                            ]}
                          >
                            {item.displaySize}
                          </PerpBookText>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
      </View>
    );
  }
  return (
    // Avoid a visible "gap" at the bottom edge when the container height
    // doesn't align perfectly with row steps.
    <View
      onLayout={handleVerticalLayout}
      style={{
        padding: 1,
        height: '100%',
      }}
    >
      <DebugRenderTracker
        name="OrderBookVerticalHeader"
        position="right-center"
      >
        <View style={{ flexDirection: 'row' }}>
          <View style={styles.verticalHeaderPrice}>
            <PerpBookText
              style={[
                styles.verticalHeaderText,
                { textAlign: 'left', color: textColor.textSubdued },
              ]}
            >
              {intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
            </PerpBookText>
          </View>
          <View style={styles.verticalHeaderSize}>
            <PerpBookText
              style={[
                styles.verticalHeaderText,
                { textAlign: 'right', color: textColor.textSubdued },
              ]}
            >
              {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
            </PerpBookText>
          </View>
          <View style={styles.verticalHeaderTotal}>
            <PerpBookText
              style={[
                styles.verticalHeaderText,
                { textAlign: 'right', color: textColor.textSubdued },
              ]}
            >
              {intl.formatMessage({ id: ETranslations.perp_orderbook_total })}
            </PerpBookText>
          </View>
        </View>
      </DebugRenderTracker>
      <View
        ref={handleHoverContainerRef}
        style={styles.relativeContainer}
        onPointerLeave={handleHoverContainerLeave}
      >
        <View style={styles.relativeContainer}>
          <DepthBarColumn
            percents={reversedAskPercents}
            rowHeight={verticalRowHeight}
            rowMarginTop={ORDER_BOOK_VERTICAL_ROW_MARGIN_TOP}
            barInset={ORDER_BOOK_VERTICAL_BAR_INSET}
            color={blockColors.red}
            origin="left"
            epoch={depthEpoch}
          />
          <View
            key="mid"
            style={[
              styles.spreadRow,
              { height: verticalRowHeight },
              { backgroundColor: spreadColor.backgroundColor },
            ]}
          />
          <DepthBarColumn
            percents={bidPercents}
            rowHeight={verticalRowHeight}
            rowMarginTop={ORDER_BOOK_VERTICAL_ROW_MARGIN_TOP}
            barInset={ORDER_BOOK_VERTICAL_BAR_INSET}
            color={blockColors.green}
            origin="left"
            epoch={depthEpoch}
          />
        </View>
        <View style={styles.absoluteContainer}>
          {verticalAsks.map((itemData, index) => {
            const originalIndex = verticalAsks.length - 1 - index;
            const isInHoverRange =
              hoverSummary?.side === 'ask' &&
              originalIndex <= hoverSummary.index;
            const isHoverBoundary =
              hoverSummary?.side === 'ask' &&
              originalIndex === hoverSummary.index;
            return (
              <Pressable
                key={index}
                disabled={isEmpty || (!isInteractive && !canShowHoverSummary)}
                onPointerEnter={
                  canShowHoverSummary
                    ? (event) =>
                        handleLevelPointerMove('ask', originalIndex, event)
                    : undefined
                }
                onPointerMove={
                  canShowHoverSummary
                    ? (event) =>
                        handleLevelPointerMove('ask', originalIndex, event)
                    : undefined
                }
                onPress={() => {
                  if (!isEmpty) {
                    handleSelectLevel('ask', itemData, originalIndex);
                  }
                }}
                style={() => [
                  styles.blockRow,
                  { height: verticalRowHeight },
                  !isEmpty && isInteractive && !platformEnv.isNative
                    ? styles.pointer
                    : null,
                  isInHoverRange
                    ? { backgroundColor: textColor.hoverBackground }
                    : null,
                  isHoverBoundary
                    ? [
                        styles.hoverRangeAskBoundary,
                        { borderColor: textColor.hoverBorder },
                      ]
                    : null,
                ]}
              >
                <OrderBookVerticalRow
                  item={itemData}
                  priceColor={textColor.red}
                  sizeColor={isEmpty ? textColor.textSubdued : textColor.text}
                />
              </Pressable>
            );
          })}
          <DebugRenderTracker name="OrderBookSpreadRow" position="right-center">
            <View
              key="mid"
              onPointerEnter={handleHoverContainerLeave}
              style={[
                styles.spreadRow,
                { height: verticalRowHeight },
                { backgroundColor: spreadColor.backgroundColor },
              ]}
            >
              <PerpBookText style={[styles.bodySm, { color: textColor.text }]}>
                {intl.formatMessage({
                  id: ETranslations.perp_orderbook_spread,
                })}
              </PerpBookText>
              {showTickSelector ? (
                <Select
                  testID="perp-select"
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
                        height: verticalSpreadControlHeight,
                        borderRadius: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 8,
                        gap: 4,
                      }}
                      onPress={onPress}
                    >
                      <PerpBookText
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[styles.bodySm, { color: textColor.text }]}
                      >
                        {selectedTickOption?.label
                          ? new BigNumber(selectedTickOption.label).toFixed(
                              priceDecimals,
                            )
                          : '-'}
                      </PerpBookText>
                      <Icon
                        name="ChevronDownSmallOutline"
                        size="$4"
                        color="$iconSubdued"
                      />
                    </TouchableOpacity>
                  )}
                />
              ) : null}
              <PerpBookText style={[styles.bodySm, { color: textColor.text }]}>
                {isEmpty ? '--' : spreadPercentage}
              </PerpBookText>
            </View>
          </DebugRenderTracker>
          {verticalBids.map((itemData, index) => {
            const isInHoverRange =
              hoverSummary?.side === 'bid' && index <= hoverSummary.index;
            const isHoverBoundary =
              hoverSummary?.side === 'bid' && index === hoverSummary.index;
            return (
              <Pressable
                key={index}
                disabled={isEmpty || (!isInteractive && !canShowHoverSummary)}
                onPointerEnter={
                  canShowHoverSummary
                    ? (event) => handleLevelPointerMove('bid', index, event)
                    : undefined
                }
                onPointerMove={
                  canShowHoverSummary
                    ? (event) => handleLevelPointerMove('bid', index, event)
                    : undefined
                }
                onPress={() => {
                  if (!isEmpty) {
                    handleSelectLevel('bid', itemData, index);
                  }
                }}
                style={() => [
                  styles.blockRow,
                  { height: verticalRowHeight },
                  !isEmpty && isInteractive && !platformEnv.isNative
                    ? styles.pointer
                    : null,
                  isInHoverRange
                    ? { backgroundColor: textColor.hoverBackground }
                    : null,
                  isHoverBoundary
                    ? [
                        styles.hoverRangeBidBoundary,
                        { borderColor: textColor.hoverBorder },
                      ]
                    : null,
                ]}
              >
                <OrderBookVerticalRow
                  item={itemData}
                  priceColor={textColor.green}
                  sizeColor={isEmpty ? textColor.textSubdued : textColor.text}
                />
              </Pressable>
            );
          })}
          {hoverSummary ? (
            <OrderBookHoverSummaryPortal
              averagePrice={hoverSummary.averagePrice}
              baseSymbol={baseSymbol}
              bestAsk={asks[0]?.px}
              bestBid={bids[0]?.px}
              levelPrice={hoverSummary.levelPrice}
              overlayLeft={hoverSummary.overlayLeft}
              overlayTop={hoverSummary.overlayTop}
              quoteSymbol={quoteSymbol}
              totalNotional={hoverSummary.totalNotional}
              totalSize={hoverSummary.totalSize}
            />
          ) : null}
        </View>
      </View>
      <OrderBookSideRatio bidDepth={ratioBidDepth} askDepth={askDepth} />
    </View>
  );
}

const OrderBookPairRow = memo(
  ({
    item,
    priceColor,
    sizeColor,
  }: {
    item: IFormattedOBLevel;
    priceColor: string;
    sizeColor: string;
  }) => {
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
          <PerpBookText style={[styles.tabularText, { color: priceColor }]}>
            {item.displayPrice}
          </PerpBookText>
          <PerpBookText style={[styles.tabularText, { color: sizeColor }]}>
            {item.displaySize}
          </PerpBookText>
        </View>
      </DebugRenderTracker>
    );
  },
  areLevelRowPropsEqual,
);
OrderBookPairRow.displayName = 'OrderBookPairRow';

export function OrderPairBook({
  variant,
  symbol: _symbol,
  bids,
  asks,
  liveMidPrice,
  maxLevelsPerSide = 30,
  selectedTickOption,
  onSelectLevel,
}: {
  variant: IOrderBookVariant;
  symbol?: string;
  maxLevelsPerSide?: number;
  bids: IBookLevel[];
  asks: IBookLevel[];
  liveMidPrice?: string;
  selectedTickOption?: ITickParam;
  onSelectLevel?: (payload: IOrderBookSelection) => void;
}) {
  const intl = useIntl();
  const aggregatedData = useAggregatedBook(
    variant,
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
  const midPrice = getOrderBookMidPrice({
    liveMidPrice,
    bestBid: bids[0]?.px,
    bestAsk: asks[0]?.px,
  });
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
          <PerpBookText
            style={[styles.headerText, { color: textColor.textSubdued }]}
          >
            {intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
          </PerpBookText>
          <PerpBookText
            style={[styles.headerText, { color: textColor.textSubdued }]}
          >
            {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
          </PerpBookText>
        </View>
      </DebugRenderTracker>
      <View style={styles.relativeContainer}>
        <View style={styles.relativeContainer}>
          {aggregatedData.asks.map((itemData, index) => (
            <View key={index} style={styles.pairBookRow}>
              <DepthBar
                color={blockColors.red}
                left={0}
                width={`${calculatePercentage(itemData.cumSize, askDepth)}%`}
              />
            </View>
          ))}
          <View style={styles.pairBookSpreadRow} />
          {aggregatedData.bids.map((itemData, index) => (
            <View key={index} style={styles.pairBookRow}>
              <DepthBar
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
              <OrderBookPairRow
                item={itemData}
                priceColor={textColor.red}
                sizeColor={textColor.textSubdued}
              />
            </Pressable>
          ))}
          <DebugRenderTracker
            name="OrderPairBookSpreadRow"
            position="right-center"
          >
            <View style={styles.pairBookSpreadRow}>
              <PerpBookText
                style={[styles.bodySm, { color: textColor.textSubdued }]}
              >
                {intl.formatMessage({
                  id: ETranslations.perp_orderbook_spread,
                })}
              </PerpBookText>
              <PerpBookText
                style={[styles.bodySm, { color: textColor.textSubdued }]}
              >
                {midPrice}
              </PerpBookText>
              <PerpBookText
                style={[styles.bodySm, { color: textColor.textSubdued }]}
              >
                {spreadPercentage}
              </PerpBookText>
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
              <OrderBookPairRow
                item={itemData}
                priceColor={textColor.green}
                sizeColor={textColor.textSubdued}
              />
            </Pressable>
          ))}
        </View>
      </View>
      <OrderBookSideRatio
        bidDepth={bidDepth}
        askDepth={askDepth}
        size="compact"
      />
    </View>
  );
}

// Compact row height for mobile
// Single source of truth lives in AnimatedDepthBlock.shared.ts so the native
// depth-bar view and this RN text layer stay pixel-aligned (design §7).
const MOBILE_ROW_HEIGHT = ORDER_BOOK_MOBILE_ROW_HEIGHT;
const MOBILE_SPREAD_ROW_HEIGHT = ORDER_BOOK_MOBILE_SPREAD_ROW_HEIGHT;
const MOBILE_PRICE_FLEX = 0.5;
const MOBILE_SIZE_FLEX = 0.5;

function MobileSpreadInfoContent({
  bestAskPx,
  bestBidPx,
  hasTradingMidPrice = false,
  isEmpty,
  onSelectMidPrice,
  textColor,
  tradingMidPrice,
}: {
  bestAskPx?: string;
  bestBidPx?: string;
  hasTradingMidPrice?: boolean;
  isEmpty: boolean;
  onSelectMidPrice?: (price: string) => void;
  textColor: ReturnType<typeof useTextColor>;
  tradingMidPrice?: string;
}) {
  const intl = useIntl();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const {
    assetCtx,
    source: assetCtxSource,
    cacheAgeMs,
  } = usePerpsActiveAssetCtxDisplay(activeTradeInstrument.coin);
  const [spotAssetCtx] = useSpotActiveAssetCtxAtom();
  const isSpot = activeTradeInstrument.mode === 'spot';
  const currentCtx = isSpot ? spotAssetCtx?.ctx : assetCtx?.ctx;
  const { markPrice } = currentCtx || {
    markPrice: '0',
    oraclePrice: '0',
  };
  const markPriceNumber = Number.parseFloat(markPrice);
  const hasMarkPrice = Number.isFinite(markPriceNumber) && markPriceNumber > 0;
  const localizedMarkPrice = hasMarkPrice
    ? formatLocalizedNumberString(markPrice)
    : '--';
  let referencePriceDisplay = '--';
  if (hasMarkPrice) {
    referencePriceDisplay = isSpot ? `≈$${localizedMarkPrice}` : markPrice;
  }
  const fallbackMidPrice = isEmpty ? markPrice : undefined;
  const liveMidPrice = getOrderBookLiveMidPrice({
    isSpot,
    spotMidPrice: spotAssetCtx?.ctx?.midPrice,
    tradingMidPrice: hasTradingMidPrice ? tradingMidPrice : undefined,
  });
  const resolvedMidPrice = getOrderBookMidPrice({
    liveMidPrice: liveMidPrice || fallbackMidPrice,
    bestBid: bestBidPx,
    bestAsk: bestAskPx,
  });
  const resolvedMidPriceBN = new BigNumber(resolvedMidPrice);
  const selectableMidPrice =
    resolvedMidPriceBN.isFinite() && resolvedMidPriceBN.gt(0)
      ? resolvedMidPriceBN.toFixed()
      : undefined;
  const midPrice = selectableMidPrice
    ? formatLocalizedNumberString(selectableMidPrice)
    : '--';
  const handleMidPricePress = useCallback(() => {
    if (!selectableMidPrice || !onSelectMidPrice) {
      return;
    }
    if (platformEnv.isNative) {
      Haptics.selection();
    }
    onSelectMidPrice(selectableMidPrice);
  }, [onSelectMidPrice, selectableMidPrice]);

  useEffect(() => {
    tracePerpsMobileLayout('orderBook.mobileReferencePrice.state', {
      coin: activeTradeInstrument.coin,
      isSpot,
      isEmpty,
      hasMarkPrice,
      markPrice,
      referencePriceDisplay,
      assetCtxSource,
      cacheAgeMs,
    });
  }, [
    activeTradeInstrument.coin,
    assetCtxSource,
    cacheAgeMs,
    hasMarkPrice,
    isEmpty,
    isSpot,
    markPrice,
    referencePriceDisplay,
  ]);

  return (
    <View
      style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        height: MOBILE_SPREAD_ROW_HEIGHT,
        paddingTop: 6,
        paddingBottom: 6,
      }}
    >
      <Pressable
        accessibilityRole="button"
        disabled={!selectableMidPrice || !onSelectMidPrice}
        hitSlop={4}
        onPress={handleMidPricePress}
        testID="perp-orderbook-mid-price"
        style={
          selectableMidPrice && onSelectMidPrice && !platformEnv.isNative
            ? styles.pointer
            : undefined
        }
      >
        <PerpBookText
          style={[
            styles.tabularText,
            {
              color: textColor.text,
              fontSize: 20,
              fontWeight: platformEnv.isNative ? '500' : '600',
              lineHeight: 24,
            },
          ]}
        >
          {midPrice}
        </PerpBookText>
      </Pressable>
      <Popover
        title={intl.formatMessage({
          id: isSpot
            ? ETranslations.perp_spot_reference_price__title
            : ETranslations.perp_position_mark_price,
        })}
        renderTrigger={
          isSpot ? (
            <PerpBookText
              style={[
                styles.tabularText,
                {
                  color: textColor.textSubdued,
                  fontSize: 11,
                  fontWeight: '400',
                  lineHeight: 16,
                },
              ]}
            >
              {referencePriceDisplay}
            </PerpBookText>
          ) : (
            <DashText
              style={[
                styles.tabularText,
                {
                  color: textColor.textSubdued,
                  fontSize: 10,
                  fontWeight: '400',
                  lineHeight: 14,
                },
              ]}
              dashThickness={0.5}
            >
              {referencePriceDisplay}
            </DashText>
          )
        }
        renderContent={
          <YStack px="$5" pb="$4">
            <SizableText>
              {intl.formatMessage({
                id: isSpot
                  ? ETranslations.perp_spot_reference_price__desc
                  : ETranslations.perp_mark_price_tooltip,
              })}
            </SizableText>
          </YStack>
        }
      />
    </View>
  );
}
const MobileSpreadInfoContentMemo = memo(MobileSpreadInfoContent);

const MobileSpreadInfoRow = memo(
  ({
    bestAskPx,
    bestBidPx,
    isEmpty,
    onSelectMidPrice,
    textColor,
  }: {
    bestAskPx?: string;
    bestBidPx?: string;
    isEmpty: boolean;
    onSelectMidPrice?: (price: string) => void;
    textColor: ReturnType<typeof useTextColor>;
  }) => {
    const { midPrice: tradingMidPrice, isValid: hasTradingMidPrice } =
      useTradingPrice();

    return (
      <MobileSpreadInfoContentMemo
        bestAskPx={bestAskPx}
        bestBidPx={bestBidPx}
        hasTradingMidPrice={hasTradingMidPrice}
        isEmpty={isEmpty}
        onSelectMidPrice={onSelectMidPrice}
        textColor={textColor}
        tradingMidPrice={tradingMidPrice}
      />
    );
  },
);
MobileSpreadInfoRow.displayName = 'MobileSpreadInfoRow';

const OrderBookMobileHeader = memo(
  ({ sizeDisplaySymbol }: { sizeDisplaySymbol: string }) => {
    const intl = useIntl();
    const textColor = useTextColor();

    return (
      <DebugRenderTracker name="OrderBookMobileHeader" position="right-center">
        <View style={styles.pairBookHeader}>
          <View style={{ flexDirection: 'row', width: '100%' }}>
            <View style={{ flex: MOBILE_PRICE_FLEX }}>
              <PerpBookText
                style={[
                  styles.mobileHeaderText,
                  {
                    color: textColor.textSubdued,
                  },
                ]}
              >
                {intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
              </PerpBookText>
              <PerpBookText
                style={[
                  styles.mobileHeaderText,
                  {
                    color: textColor.textSubdued,
                  },
                ]}
              >
                (USD)
              </PerpBookText>
            </View>
            <View
              style={{
                flex: MOBILE_SIZE_FLEX,
                alignItems: 'flex-end',
              }}
            >
              <PerpBookText
                style={[
                  styles.mobileHeaderText,
                  {
                    color: textColor.textSubdued,
                  },
                ]}
              >
                {intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
              </PerpBookText>
              <PerpBookText
                numberOfLines={1}
                style={[
                  styles.mobileHeaderText,
                  {
                    color: textColor.textSubdued,
                  },
                ]}
              >
                ({sizeDisplaySymbol})
              </PerpBookText>
            </View>
          </View>
        </View>
      </DebugRenderTracker>
    );
  },
);
OrderBookMobileHeader.displayName = 'OrderBookMobileHeader';

// A compact, mobile-friendly order book: two columns (Price/Size),
// asks on top, bids at bottom, with a prominent spread row in the middle.
export function OrderBookMobile({
  variant,
  symbol: _symbol,
  bids,
  asks,
  maxLevelsPerSide = 14,
  selectedTickOption,
  priceDecimals = 2,
  sizeDecimals = 3,
  style,
  onSelectLevel,
  onSelectMidPrice,
  showTickSelector = true,
  tickOptions = [],
  onTickOptionChange,
}: IOrderBookProps) {
  const intl = useIntl();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const isSpot = activeTradeInstrument.mode === 'spot';
  const sizeDisplaySymbol = getOrderBookSizeDisplaySymbol({
    coin: _symbol ?? activeTradeInstrument.coin,
    isSpot,
    spotUniverse:
      activeTradeInstrument.mode === 'spot'
        ? activeTradeInstrument.universe
        : undefined,
  });
  const aggregatedData = useAggregatedBook(
    variant,
    bids,
    asks,
    maxLevelsPerSide,
    selectedTickOption,
    priceDecimals,
    sizeDecimals,
  );
  const isEmpty = !aggregatedData.bids.length && !aggregatedData.asks.length;
  const depthEpoch = useOrderBookEpoch(
    _symbol ?? activeTradeInstrument.coin,
    selectedTickOption?.value,
    isEmpty,
  );
  const bidDepth = useMemo(() => {
    return new BigNumber(aggregatedData.bids.at(-1)?.cumSize ?? '0');
  }, [aggregatedData.bids]);
  const askDepth = useMemo(() => {
    return new BigNumber(aggregatedData.asks.at(-1)?.cumSize ?? '0');
  }, [aggregatedData.asks]);
  const reversedAsks = useMemo(
    () => aggregatedData.asks.toReversed(),
    [aggregatedData.asks],
  );
  // REACT-NATIVE-1JZ: the mobile native depth-bar view draws the bar fill AND
  // the price/size ladder text itself, so percents + prices + sizes must stay
  // mutually consistent. They are memoized per data change (below) and then
  // frame-coalesced together via useRafCoalesced so 100+Hz L2 ticks collapse to
  // ~one Nitro prop write per displayed frame. The user-read trading numbers
  // (mid / spread / mark in MobileSpreadInfoRow) come from raw bids[0]/asks[0]
  // and atoms — NOT these arrays — so they are unaffected and stay fresh.
  const askPercentsRaw = useMemo(
    () =>
      reversedAsks.map((itemData) =>
        calculatePercentage(itemData.cumSize, askDepth),
      ),
    [askDepth, reversedAsks],
  );
  const askPricesRaw = useMemo(
    () => reversedAsks.map((itemData) => itemData.price),
    [reversedAsks],
  );
  const askSizesRaw = useMemo(
    () => reversedAsks.map((itemData) => itemData.displaySize),
    [reversedAsks],
  );
  const bidPercentsRaw = useMemo(
    () =>
      aggregatedData.bids.map((itemData) =>
        calculatePercentage(itemData.cumSize, bidDepth),
      ),
    [aggregatedData.bids, bidDepth],
  );
  const bidPricesRaw = useMemo(
    () => aggregatedData.bids.map((itemData) => itemData.price),
    [aggregatedData.bids],
  );
  const bidSizesRaw = useMemo(
    () => aggregatedData.bids.map((itemData) => itemData.displaySize),
    [aggregatedData.bids],
  );
  // Merge percents/prices/sizes into a single ladder object per side and
  // frame-coalesce ONCE, so the three arrays a depth column reads are always
  // from the SAME source frame. Coalescing them through three independent
  // useRafCoalesced calls could land a percents update on frame N while
  // prices/sizes still showed frame N-1, briefly separating the bar fill from
  // its own price/size text (PR review r3363420755). The raw arrays keep their
  // own useMemo identities so this wrapper only changes when real data changes.
  // `levels` rides along so a tap resolves against the frame the user sees;
  // reading live arrays could put a price they never pressed into the form.
  const askLadderRaw = useMemo(
    () => ({
      percents: askPercentsRaw,
      prices: askPricesRaw,
      sizes: askSizesRaw,
      levels: reversedAsks,
    }),
    [askPercentsRaw, askPricesRaw, askSizesRaw, reversedAsks],
  );
  const bidLadderRaw = useMemo(
    () => ({
      percents: bidPercentsRaw,
      prices: bidPricesRaw,
      sizes: bidSizesRaw,
      levels: aggregatedData.bids,
    }),
    [aggregatedData.bids, bidPercentsRaw, bidPricesRaw, bidSizesRaw],
  );
  // Mobile-only, and mobile is already throttled to 200ms upstream
  // (`enableVisualSnapshot`), so frame coalescing can merge nothing here.
  const askLadder = useRafCoalesced(askLadderRaw, depthEpoch, false);
  const bidLadder = useRafCoalesced(bidLadderRaw, depthEpoch, false);
  // Spacers reserve the height of each rendered depth column so the foreground
  // spread row stays aligned. Each side can be empty independently, and
  // DepthBarColumn falls back to its placeholder rows for that side.
  const askSpacerStyle = useMemo(
    () => ({
      height:
        (askLadder.percents.length || maxLevelsPerSide) * MOBILE_ROW_HEIGHT,
    }),
    [askLadder.percents.length, maxLevelsPerSide],
  );
  const bidSpacerStyle = useMemo(
    () => ({
      height:
        (bidLadder.percents.length || maxLevelsPerSide) * MOBILE_ROW_HEIGHT,
    }),
    [bidLadder.percents.length, maxLevelsPerSide],
  );

  const priceFontSize = useMemo(() => {
    if (!asks.length) {
      return 12;
    }
    // get max length of all asks prices
    const maxLength = Math.max(...asks.map((ask) => ask.px.length));
    return Math.max(8, 12 - (maxLength - 6) * 0.5);
  }, [asks]);

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
  const handleAskRowPress = useCallback(
    (rowIndex: number) => {
      const levels = askLadder.levels;
      const item = levels[rowIndex];
      if (item) {
        handleSelectLevel('ask', item, levels.length - 1 - rowIndex);
      }
    },
    [askLadder.levels, handleSelectLevel],
  );
  const handleBidRowPress = useCallback(
    (rowIndex: number) => {
      const item = bidLadder.levels[rowIndex];
      if (item) {
        handleSelectLevel('bid', item, rowIndex);
      }
    },
    [bidLadder.levels, handleSelectLevel],
  );

  return (
    <View style={style}>
      <OrderBookMobileHeader sizeDisplaySymbol={sizeDisplaySymbol} />
      <View style={styles.relativeContainer}>
        {/* background depth bars */}
        <View style={styles.relativeContainer}>
          <DepthBarColumn
            percents={askLadder.percents}
            rowHeight={MOBILE_ROW_HEIGHT}
            rowMarginTop={ORDER_BOOK_MOBILE_ROW_MARGIN_TOP}
            barInset={ORDER_BOOK_MOBILE_BAR_INSET}
            color={blockColors.red}
            origin="left"
            epoch={depthEpoch}
            prices={askLadder.prices}
            sizes={askLadder.sizes}
            priceColor={textColor.red}
            sizeColor={textColor.textSubdued}
            priceFontSize={priceFontSize}
            sizeFontSize={priceFontSize}
            textInset={4}
            placeholderText="--"
            placeholderRows={maxLevelsPerSide}
            onRowPress={isInteractive ? handleAskRowPress : undefined}
          />
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              height: MOBILE_SPREAD_ROW_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
          <DepthBarColumn
            percents={bidLadder.percents}
            rowHeight={MOBILE_ROW_HEIGHT}
            rowMarginTop={ORDER_BOOK_MOBILE_ROW_MARGIN_TOP}
            barInset={ORDER_BOOK_MOBILE_BAR_INSET}
            color={blockColors.green}
            origin="left"
            epoch={depthEpoch}
            prices={bidLadder.prices}
            sizes={bidLadder.sizes}
            priceColor={textColor.green}
            sizeColor={textColor.textSubdued}
            priceFontSize={priceFontSize}
            sizeFontSize={priceFontSize}
            textInset={4}
            placeholderText="--"
            placeholderRows={maxLevelsPerSide}
            onRowPress={isInteractive ? handleBidRowPress : undefined}
          />
        </View>

        {/* foreground: only the spread row. Per-row price/size text AND the
            `--` empty-state placeholder are drawn by DepthBarColumn (no RN
            overlay), so placeholder→numbers has no blank handoff frame.
            Transparent spacers keep the spread row aligned with the depth
            columns in empty, single-sided, and populated states. */}
        <View style={styles.absoluteContainer}>
          <View style={askSpacerStyle} />
          <DebugRenderTracker
            name="OrderBookMobileSpreadRow"
            position="right-center"
          >
            <MobileSpreadInfoRow
              bestAskPx={asks[0]?.px}
              bestBidPx={bids[0]?.px}
              isEmpty={isEmpty}
              onSelectMidPrice={onSelectMidPrice}
              textColor={textColor}
            />
          </DebugRenderTracker>
          <View style={bidSpacerStyle} />
        </View>
      </View>
      <OrderBookSideRatio
        bidDepth={bidDepth}
        askDepth={askDepth}
        size="mobile"
      />
      {showTickSelector ? (
        <Select
          testID="perp-select"
          floatingPanelProps={{
            width: 150,
          }}
          title={intl.formatMessage({
            id: ETranslations.perp_order_book_depth,
          })}
          items={tickOptions}
          value={selectedTickOption?.value}
          onChange={handleTickOptionChange}
          renderTrigger={({ onPress }) => (
            <TouchableOpacity
              style={{
                height: 20,
                borderRadius: 4,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 5,
                gap: 3,
                backgroundColor: spreadColor.backgroundColor,
                marginTop: 2,
              }}
              onPress={onPress}
            >
              <PerpBookText
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.bodySm,
                  {
                    color: textColor.text,
                    fontSize: 11,
                    lineHeight: 14,
                  },
                ]}
              >
                {selectedTickOption?.label
                  ? new BigNumber(selectedTickOption.label).toFixed(
                      priceDecimals,
                    )
                  : '-'}
              </PerpBookText>
              <Icon
                name="ChevronDownSmallOutline"
                size="$4"
                color="$iconSubdued"
              />
            </TouchableOpacity>
          )}
        />
      ) : null}
    </View>
  );
}
