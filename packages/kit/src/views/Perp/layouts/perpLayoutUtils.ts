import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

export const ORDER_BOOK_SIDE_RATIO_RESERVED_HEIGHT = 36;
export const ORDER_BOOK_SIDE_RATIO_GAP = 4;
export const PERP_DESKTOP_CHART_MIN_HEIGHT = 360;
export const PERP_DESKTOP_INFO_MIN_HEIGHT = 240;
export const PERP_DESKTOP_TRADING_MIN_WIDTH = 320;
export const PERP_DESKTOP_TRADING_PANEL_MIN_HEIGHT = 360;
export const PERP_DESKTOP_ACCOUNT_PANEL_MIN_HEIGHT = 240;

const ORDER_BOOK_VERTICAL_PADDING = 2;
const ORDER_BOOK_VERTICAL_HEADER_HEIGHT = 24;
const ORDER_BOOK_VERTICAL_ROW_GAP = 1;
const ORDER_BOOK_VERTICAL_ROW_HEIGHT = 22;
const ORDER_BOOK_VERTICAL_LEVELS_MIN = 3;
const ORDER_BOOK_VERTICAL_LEVELS_DEFAULT = 11;

const DESKTOP_LAYOUT_BASELINE_VIEWPORT = {
  width: 1512,
  height: 982,
} as const;

const DESKTOP_LAYOUT_HEIGHT_LIMITS = {
  marketContent: {
    min: 520,
    max: 860,
  },
  bottomPanel: {
    min: 380,
    max: 620,
  },
} as const;

const DESKTOP_LAYOUT_WIDTH_LIMITS = {
  orderBook: {
    min: 280,
    max: 360,
  },
  tradingPanel: {
    min: PERP_DESKTOP_TRADING_MIN_WIDTH,
    max: 420,
  },
} as const;

function clampSize(value: number, min: number, max: number) {
  return Math.round(Math.min(Math.max(value, min), max));
}

function getVerticalSplitSizes({
  topDefaultHeight,
  bottomDefaultHeight,
  savedTopHeight,
  topMinHeight,
  bottomMinHeight,
}: {
  topDefaultHeight: number;
  bottomDefaultHeight: number;
  savedTopHeight?: number;
  topMinHeight: number;
  bottomMinHeight: number;
}) {
  const totalHeight = topDefaultHeight + bottomDefaultHeight;
  const topHeightCandidate =
    typeof savedTopHeight === 'number' && Number.isFinite(savedTopHeight)
      ? savedTopHeight
      : topDefaultHeight;
  const topHeight = clampSize(
    topHeightCandidate,
    topMinHeight,
    totalHeight - bottomMinHeight,
  );

  return [topHeight, totalHeight - topHeight];
}

export function getPerpDesktopMainSplitSizes({
  availableWidth,
  defaultTradingWidth,
  savedTradingWidth,
  // Must match the market pane minSize (which grows with the order book) so
  // the computed sizes never conflict with what Allotment enforces.
  marketMinWidth = PERP_LAYOUT_CONFIG.main.marketMinWidth,
}: {
  availableWidth: number;
  defaultTradingWidth: number;
  savedTradingWidth?: number;
  marketMinWidth?: number;
}) {
  const tradingWidthCandidate =
    typeof savedTradingWidth === 'number' && Number.isFinite(savedTradingWidth)
      ? savedTradingWidth
      : defaultTradingWidth;
  const tradingMaxWidth = Math.max(
    PERP_DESKTOP_TRADING_MIN_WIDTH,
    Math.min(
      PERP_LAYOUT_CONFIG.main.tradingMaxWidth,
      availableWidth - marketMinWidth,
    ),
  );
  const tradingWidth = clampSize(
    tradingWidthCandidate,
    PERP_DESKTOP_TRADING_MIN_WIDTH,
    tradingMaxWidth,
  );

  return [availableWidth - tradingWidth, tradingWidth];
}

export function getPerpDesktopChartSplitSizes({
  marketContentHeight,
  bottomPanelHeight,
  savedChartHeight,
}: {
  marketContentHeight: number;
  bottomPanelHeight: number;
  savedChartHeight?: number;
}) {
  return getVerticalSplitSizes({
    topDefaultHeight: marketContentHeight,
    bottomDefaultHeight: bottomPanelHeight,
    savedTopHeight: savedChartHeight,
    topMinHeight: PERP_DESKTOP_CHART_MIN_HEIGHT,
    bottomMinHeight: PERP_DESKTOP_INFO_MIN_HEIGHT,
  });
}

export function getPerpDesktopTradingSplitSizes({
  marketContentHeight,
  bottomPanelHeight,
  savedTradingPanelHeight,
}: {
  marketContentHeight: number;
  bottomPanelHeight: number;
  savedTradingPanelHeight?: number;
}) {
  return getVerticalSplitSizes({
    topDefaultHeight: marketContentHeight,
    bottomDefaultHeight: bottomPanelHeight,
    savedTopHeight: savedTradingPanelHeight,
    topMinHeight: PERP_DESKTOP_TRADING_PANEL_MIN_HEIGHT,
    bottomMinHeight: PERP_DESKTOP_ACCOUNT_PANEL_MIN_HEIGHT,
  });
}

export function getResponsivePerpDesktopLayout(
  viewportWidth: number,
  viewportHeight: number,
) {
  const widthScale = Math.max(
    viewportWidth / DESKTOP_LAYOUT_BASELINE_VIEWPORT.width,
    1,
  );
  const heightScale = Math.max(
    viewportHeight / DESKTOP_LAYOUT_BASELINE_VIEWPORT.height,
    1,
  );
  const baseLayout = PERP_LAYOUT_CONFIG.desktop;

  return {
    ...baseLayout,
    marketContentHeight: clampSize(
      baseLayout.marketContentHeight * heightScale,
      baseLayout.marketContentHeight,
      DESKTOP_LAYOUT_HEIGHT_LIMITS.marketContent.max,
    ),
    bottomPanelHeight: clampSize(
      baseLayout.bottomPanelHeight * heightScale,
      baseLayout.bottomPanelHeight,
      DESKTOP_LAYOUT_HEIGHT_LIMITS.bottomPanel.max,
    ),
    widths: {
      orderBook: clampSize(
        baseLayout.widths.orderBook * widthScale,
        baseLayout.widths.orderBook,
        DESKTOP_LAYOUT_WIDTH_LIMITS.orderBook.max,
      ),
      trading: clampSize(
        baseLayout.widths.trading * widthScale,
        baseLayout.widths.trading,
        DESKTOP_LAYOUT_WIDTH_LIMITS.tradingPanel.max,
      ),
    },
  };
}

export function getVerticalOrderBookLayout(
  containerHeight: number,
  maxLevelsPerSide: number,
) {
  const availableHeight =
    containerHeight - ORDER_BOOK_SIDE_RATIO_RESERVED_HEIGHT;
  const bookBodyHeight =
    availableHeight -
    ORDER_BOOK_VERTICAL_PADDING -
    ORDER_BOOK_VERTICAL_HEADER_HEIGHT;

  if (bookBodyHeight <= 0) {
    return {
      levelsPerSide: Math.max(
        ORDER_BOOK_VERTICAL_LEVELS_MIN,
        Math.min(maxLevelsPerSide, ORDER_BOOK_VERTICAL_LEVELS_DEFAULT),
      ),
      extraBidLevels: 0,
      rowHeight: ORDER_BOOK_VERTICAL_ROW_HEIGHT,
    };
  }

  // Fixed row height: resizing changes the visible level count, never the
  // red/green depth bar size.
  const rowStep = ORDER_BOOK_VERTICAL_ROW_HEIGHT + ORDER_BOOK_VERTICAL_ROW_GAP;
  const fittedRows = Math.floor(bookBodyHeight / rowStep);
  const levelsPerSide = Math.max(
    ORDER_BOOK_VERTICAL_LEVELS_MIN,
    Math.min(Math.floor((fittedRows - 1) / 2), maxLevelsPerSide),
  );
  // Symmetric sides always leave 0-1 spare rows; give a spare row to the bid
  // side so the book fills the pane instead of showing a bottom gap.
  const extraBidLevels =
    fittedRows - 1 - levelsPerSide * 2 >= 1 && levelsPerSide < maxLevelsPerSide
      ? 1
      : 0;
  // At the level cap the ladder can't grow, so stretch rows to fill the pane
  // instead of leaving an unbounded bottom gap on tall windows.
  const isCappedByLevels =
    levelsPerSide === maxLevelsPerSide &&
    bookBodyHeight > (2 * levelsPerSide + 1) * rowStep;

  return {
    levelsPerSide,
    extraBidLevels,
    rowHeight: isCappedByLevels
      ? Math.floor(
          bookBodyHeight / (2 * levelsPerSide + 1) -
            ORDER_BOOK_VERTICAL_ROW_GAP,
        )
      : ORDER_BOOK_VERTICAL_ROW_HEIGHT,
  };
}
