import { ESwapStockTradeSide } from '../../hooks/swapStockChannelUtils';

export type IStockChartRange = '1D' | '1W' | '1M' | '1Y';

export const STOCK_CHART_DEFAULT_RANGE: IStockChartRange = '1W';

export const STOCK_DESKTOP_HEADER_SLOT_PROPS = {
  width: '100%',
  alignItems: 'center',
  pt: '$8',
  pb: '$4',
} as const;

export const STOCK_CHART_RANGE_ITEMS: {
  label: IStockChartRange;
  interval: string;
  seconds: number;
}[] = [
  { label: '1D', interval: '1m', seconds: 24 * 60 * 60 },
  { label: '1W', interval: '1H', seconds: 7 * 24 * 60 * 60 },
  { label: '1M', interval: '4H', seconds: 30 * 24 * 60 * 60 },
  { label: '1Y', interval: '1D', seconds: 365 * 24 * 60 * 60 },
];

export function getStockDisabledActionButtonProps(
  tradeSide: ESwapStockTradeSide,
) {
  return {
    bg:
      tradeSide === ESwapStockTradeSide.Sell
        ? '$bgCriticalStrong'
        : '$bgSuccessStrong',
    color: '$textOnColor',
    disabledStyle: {
      opacity: 0.6,
    },
  } as const;
}
