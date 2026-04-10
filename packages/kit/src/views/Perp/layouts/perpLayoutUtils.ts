import { PERP_LAYOUT_CONFIG } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

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

export function calculateMaxLevelsPerSide(containerHeight: number): number {
  // The vertical web order book renders:
  // - Root padding: 1px top + 1px bottom (2px)
  // - Table header (Price/Size/Total): 24px
  // - Spread row: 24px + 1px marginTop (25px)
  // - Each level row: 24px + 1px marginTop (25px)
  //
  // Total height: baseHeight(51px) + 2 * levelsPerSide * 25px
  const baseHeight = 2 + 24 + 25;
  const levelRowStep = 25;

  if (containerHeight <= 0) return 11;
  if (containerHeight <= baseHeight) return 3;

  let levelsPerSide = Math.floor(
    (containerHeight - baseHeight) / (2 * levelRowStep),
  );
  levelsPerSide = Math.max(3, Math.min(levelsPerSide, 50));

  // If we have a noticeable gap, prefer one extra level and accept a tiny clip
  // instead of showing empty space.
  const usedHeight = baseHeight + 2 * levelsPerSide * levelRowStep;
  const blank = containerHeight - usedHeight;
  if (blank > levelRowStep / 2 && levelsPerSide < 50) {
    levelsPerSide += 1;
  }

  return levelsPerSide;
}
