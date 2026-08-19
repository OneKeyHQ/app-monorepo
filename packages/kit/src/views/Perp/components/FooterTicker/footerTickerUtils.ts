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

export interface IFooterTickerTextWidthBudget {
  itemWidth: number;
  changeText: string;
  changeWidth: number;
  priceText: string;
  priceWidth: number;
}

export type IFooterTickerTextWidthBudgetMap = Record<
  string,
  IFooterTickerTextWidthBudget
>;

export type IFooterTickerTextMeasure = (text: string) => number;

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

export function getFooterTickerSnapshotKey(items: IFooterTickerItemData[]) {
  return items
    .map(
      (item) =>
        `${getFooterTickerItemKey(item)}:${item.displayName}:${
          item.change24hPercent
        }:${item.markPrice ?? ''}`,
    )
    .join('|');
}

export function isFooterTickerTextWithinBudget({
  text,
  baseText,
  width,
  measureText,
  tolerance = 1,
}: {
  text: string;
  baseText: string;
  width: number;
  measureText: IFooterTickerTextMeasure;
  tolerance?: number;
}) {
  return (
    text.length <= baseText.length || measureText(text) <= width + tolerance
  );
}

export function isFooterTickerValueWidthSafe({
  item,
  widthBudget,
  measureText,
}: {
  item: IFooterTickerItemData;
  widthBudget: IFooterTickerTextWidthBudget;
  measureText: IFooterTickerTextMeasure;
}) {
  const { changeText, priceText } = getFooterTickerDisplayText(item);
  return (
    isFooterTickerTextWithinBudget({
      text: changeText,
      baseText: widthBudget.changeText,
      width: widthBudget.changeWidth,
      measureText,
    }) &&
    isFooterTickerTextWithinBudget({
      text: priceText,
      baseText: widthBudget.priceText,
      width: widthBudget.priceWidth,
      measureText,
    })
  );
}

function isSameFooterTickerStructure(
  first: IFooterTickerItemData,
  second: IFooterTickerItemData,
) {
  return (
    getFooterTickerItemKey(first) === getFooterTickerItemKey(second) &&
    first.displayName === second.displayName
  );
}

export function mergeFooterTickerLiveValues({
  displayItems,
  latestItems,
  previousLiveItems = [],
  widthBudgets,
  measureText,
}: {
  displayItems: IFooterTickerItemData[];
  latestItems: IFooterTickerItemData[];
  previousLiveItems?: IFooterTickerItemData[];
  widthBudgets: IFooterTickerTextWidthBudgetMap;
  measureText: IFooterTickerTextMeasure;
}) {
  const latestByKey = new Map(
    latestItems.map((item) => [getFooterTickerItemKey(item), item]),
  );
  const previousByKey = new Map(
    previousLiveItems.map((item) => [getFooterTickerItemKey(item), item]),
  );

  return displayItems.map((displayItem) => {
    const itemKey = getFooterTickerItemKey(displayItem);
    const latestItem = latestByKey.get(itemKey);
    const widthBudget = widthBudgets[itemKey];
    if (
      latestItem &&
      widthBudget &&
      isSameFooterTickerStructure(displayItem, latestItem) &&
      isFooterTickerValueWidthSafe({
        item: latestItem,
        widthBudget,
        measureText,
      })
    ) {
      return {
        ...displayItem,
        change24hPercent: latestItem.change24hPercent,
        markPrice: latestItem.markPrice,
      };
    }

    const previousItem = previousByKey.get(itemKey);
    return previousItem &&
      isSameFooterTickerStructure(displayItem, previousItem)
      ? previousItem
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
