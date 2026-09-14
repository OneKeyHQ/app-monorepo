import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/perpsUtils';

export interface IFooterTickerItemData {
  displayName: string;
  coinName: string;
  dexIndex: number;
  assetId: number;
  mode: 'perp' | 'spot';
  change24hPercent: number;
  markPrice?: string;
}

export interface IFooterTickerActiveCtx {
  coin: string;
  mode: 'perp' | 'spot';
  markPrice?: string;
  change24hPercent?: number;
}

function isUsableMarkPrice(markPrice: string | undefined): markPrice is string {
  if (!markPrice) {
    return false;
  }
  const value = Number.parseFloat(markPrice);
  return Number.isFinite(value) && value > 0;
}

// Ticker items are built from the batch asset ctx snapshot, which refreshes
// every ~10s+, while the ticker bar reads the per-asset activeAssetCtx stream
// (~1/s). Mirror that stream for the active coin so both show the same mark price.
export function applyActiveCtxToFooterTickerItems(
  items: IFooterTickerItemData[],
  activeCtxs: (IFooterTickerActiveCtx | undefined)[],
) {
  const usableCtxs = activeCtxs.filter(
    (ctx): ctx is IFooterTickerActiveCtx =>
      !!ctx && isUsableMarkPrice(ctx.markPrice),
  );
  if (usableCtxs.length === 0) {
    return items;
  }

  let changed = false;
  const nextItems = items.map((item) => {
    const activeCtx = usableCtxs.find(
      (ctx) => ctx.mode === item.mode && ctx.coin === item.coinName,
    );
    if (!activeCtx) {
      return item;
    }
    const change24hPercent =
      activeCtx.change24hPercent ?? item.change24hPercent;
    if (
      activeCtx.markPrice === item.markPrice &&
      change24hPercent === item.change24hPercent
    ) {
      return item;
    }
    changed = true;
    return { ...item, markPrice: activeCtx.markPrice, change24hPercent };
  });

  return changed ? nextItems : items;
}

export function getFooterTickerItemKey(item: IFooterTickerItemData) {
  return `${item.mode}:${item.dexIndex}:${item.assetId}:${item.coinName}`;
}

export function getFooterTickerStructureKey(items: IFooterTickerItemData[]) {
  return items
    .map((item) => `${getFooterTickerItemKey(item)}:${item.displayName}`)
    .join('|');
}

export function getFooterTickerDisplayText(item: IFooterTickerItemData) {
  const sign = item.change24hPercent >= 0 ? '+' : '';
  return {
    changeText: `${sign}${item.change24hPercent.toFixed(2)}%`,
    priceText: item.markPrice
      ? formatPriceToSignificantDigits(item.markPrice)
      : '-',
  };
}

export function mergeFooterTickerLiveValues({
  displayItems,
  latestItems,
}: {
  displayItems: IFooterTickerItemData[];
  latestItems: IFooterTickerItemData[];
}) {
  const latestByKey = new Map(
    latestItems.map((item) => [getFooterTickerItemKey(item), item]),
  );

  return displayItems.map((displayItem) => {
    const latestItem = latestByKey.get(getFooterTickerItemKey(displayItem));
    return latestItem?.displayName === displayItem.displayName
      ? latestItem
      : displayItem;
  });
}

export function shouldAnimateFooterTicker({
  contentWidth,
  containerWidth,
  prefersReducedMotion,
}: {
  contentWidth: number;
  containerWidth: number;
  prefersReducedMotion: boolean;
}) {
  return !prefersReducedMotion && contentWidth > containerWidth;
}
