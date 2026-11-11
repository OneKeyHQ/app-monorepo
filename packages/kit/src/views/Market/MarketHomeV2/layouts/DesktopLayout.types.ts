import type {
  ILiquidityFilter,
  IMarketFilterBarProps,
  IMarketHomeTabChangeHandler,
} from '../types';

export interface IDesktopLayoutProps {
  filterBarProps: IMarketFilterBarProps;
  selectedNetworkId: string;
  liquidityFilter?: ILiquidityFilter;
  onTabChange: IMarketHomeTabChangeHandler;
}
