import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes/fiatCrypto';
import type { IModalFiatCryptoParamList } from '@onekeyhq/shared/src/routes/fiatCrypto';

const FiatCryptoBuyModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/FiatCrypto/pages/Buy'),
);

const FiatCryptoSellModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/FiatCrypto/pages/Sell'),
);

export const ModalFiatCryptoRouter: IModalFlowNavigatorConfig<
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList
>[] = [
  {
    name: EModalFiatCryptoRoutes.BuyModal,
    component: FiatCryptoBuyModal,
  },
  {
    name: EModalFiatCryptoRoutes.SellModal,
    component: FiatCryptoSellModal,
  },
];
