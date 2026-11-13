import type {
  ILiquidityFilter,
  IMarketFilterBarProps,
  IMarketHomeTabChangeHandler,
} from '../types';

export interface IDesktopLayoutProps {
  isLayoutActive: boolean;
  filterBarProps: IMarketFilterBarProps;
  selectedNetworkId: string;
  liquidityFilter?: ILiquidityFilter;
  onTabChange: IMarketHomeTabChangeHandler;
}
