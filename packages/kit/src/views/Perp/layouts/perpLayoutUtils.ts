import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

export const ORDER_BOOK_SIDE_RATIO_RESERVED_HEIGHT = 36;
export const ORDER_BOOK_SIDE_RATIO_GAP = 4;

const ORDER_BOOK_VERTICAL_PADDING = 2;
const ORDER_BOOK_VERTICAL_HEADER_HEIGHT = 24;
const ORDER_BOOK_VERTICAL_ROW_GAP = 1;
const ORDER_BOOK_VERTICAL_ROW_HEIGHT_MIN = 22;
const ORDER_BOOK_VERTICAL_ROW_HEIGHT_MAX = 23;
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
    min: 320,
    max: 420,
  },
} as const;

function clampSize(value: number, min: number, max: number) {
  return Math.round(Math.min(Math.max(value, min), max));
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

function getOrderBookRowHeight(
  bookBodyHeight: number,
  levelsPerSide: number,
): number {
  return bookBodyHeight / (2 * levelsPerSide + 1) - ORDER_BOOK_VERTICAL_ROW_GAP;
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
      rowHeight: ORDER_BOOK_VERTICAL_ROW_HEIGHT_MIN,
    };
  }

  let levelsPerSide = Math.floor(
    (bookBodyHeight / (ORDER_BOOK_VERTICAL_ROW_HEIGHT_MIN + 1) - 1) / 2,
  );
  levelsPerSide = Math.max(
    ORDER_BOOK_VERTICAL_LEVELS_MIN,
    Math.min(levelsPerSide, maxLevelsPerSide),
  );

  while (
    levelsPerSide < maxLevelsPerSide &&
    getOrderBookRowHeight(bookBodyHeight, levelsPerSide) >
      ORDER_BOOK_VERTICAL_ROW_HEIGHT_MAX
  ) {
    levelsPerSide += 1;
  }

  while (
    levelsPerSide > ORDER_BOOK_VERTICAL_LEVELS_MIN &&
    getOrderBookRowHeight(bookBodyHeight, levelsPerSide) <
      ORDER_BOOK_VERTICAL_ROW_HEIGHT_MIN
  ) {
    levelsPerSide -= 1;
  }

  return {
    levelsPerSide,
    rowHeight: Math.max(
      ORDER_BOOK_VERTICAL_ROW_HEIGHT_MIN,
      getOrderBookRowHeight(bookBodyHeight, levelsPerSide),
    ),
  };
}
