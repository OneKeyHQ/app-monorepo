import type { IModalFlowNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes/fiatCrypto';
import type { IModalFiatCryptoParamList } from '@onekeyhq/shared/src/routes/fiatCrypto';

const FiatCryptoBuyModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/FiatCrypto/pages/Buy'),
);

const DeriveTypesAddress = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/WalletAddress/pages/DeriveTypesAddress'),
);

const FiatCryptoHeadlessBuyModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/FiatCrypto/pages/HeadlessBuy'),
);

const FiatCryptoHeadlessBuyTokenSelectorModal = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/FiatCrypto/pages/HeadlessBuy/TokenSelector'),
);

const FiatCryptoHeadlessBuySuccessModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/FiatCrypto/pages/HeadlessBuy/Success'),
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
    name: EModalFiatCryptoRoutes.DeriveTypesAddress,
    component: DeriveTypesAddress,
  },
  {
    name: EModalFiatCryptoRoutes.HeadlessBuy,
    component: FiatCryptoHeadlessBuyModal,
  },
  {
    name: EModalFiatCryptoRoutes.HeadlessBuyTokenSelector,
    component: FiatCryptoHeadlessBuyTokenSelectorModal,
  },
  {
    name: EModalFiatCryptoRoutes.HeadlessBuySuccess,
    component: FiatCryptoHeadlessBuySuccessModal,
  },
];
