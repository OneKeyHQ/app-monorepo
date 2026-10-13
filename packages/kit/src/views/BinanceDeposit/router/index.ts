import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import type { IModalBinanceDepositParamList } from '@onekeyhq/shared/src/routes/binanceDeposit';
import { EModalBinanceDepositRoutes } from '@onekeyhq/shared/src/routes/binanceDeposit';

const BinanceDepositHome = LazyLoad(
  () =>
    import('@onekeyhq/kit/src/views/BinanceDeposit/pages/BinanceDepositHome'),
);

export const BinanceDepositModalRouter: IModalFlowNavigatorConfig<
  EModalBinanceDepositRoutes,
  IModalBinanceDepositParamList
>[] = [
  {
    name: EModalBinanceDepositRoutes.BinanceDepositHome,
    component: BinanceDepositHome,
  },
];
