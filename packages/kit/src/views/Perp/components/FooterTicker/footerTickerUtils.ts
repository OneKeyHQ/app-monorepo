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
