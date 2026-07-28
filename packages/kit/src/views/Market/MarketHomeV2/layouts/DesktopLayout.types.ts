import type {
  ILiquidityFilter,
  IMarketFilterBarProps,
  IMarketHomeTabValue,
} from '../types';

export interface IDesktopLayoutProps {
  filterBarProps: IMarketFilterBarProps;
  selectedNetworkId: string;
  liquidityFilter?: ILiquidityFilter;
  onTabChange: (tabId: IMarketHomeTabValue) => void;
}
