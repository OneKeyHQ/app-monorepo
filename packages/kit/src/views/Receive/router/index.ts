import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import type { IModalReceiveParamList } from '@onekeyhq/shared/src/routes';
import { EModalReceiveRoutes } from '@onekeyhq/shared/src/routes';

import { LazyLoadPage } from '../../../components/LazyLoadPage';

const ReceiveToken = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Receive/pages/ReceiveToken'),
);
const CreateInvoice = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Receive/pages/CreateInvoice'),
);
const ReceiveInvoice = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Receive/pages/ReceiveInvoice'),
);

const TokenSelector = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/AssetSelector/pages/TokenSelector'),
);

const AggregateTokenSelector = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/AssetSelector/pages/AggregateTokenSelector'
    ),
);

const DeriveTypesAddress = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/WalletAddress/pages/DeriveTypesAddress'),
);

const BtcAddresses = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Receive/pages/BtcAddresses'),
);

const ReceiveSelector = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/Receive/pages/ReceiveSelector'),
);

const FiatCryptoBuyModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/FiatCrypto/pages/Buy'),
);

const FiatCryptoSellModal = LazyLoadPage(
  () => import('@onekeyhq/kit/src/views/FiatCrypto/pages/Sell'),
);

export const ModalReceiveStack: IModalFlowNavigatorConfig<
  EModalReceiveRoutes,
  IModalReceiveParamList
>[] = [
  {
    name: EModalReceiveRoutes.ReceiveToken,
    component: ReceiveToken,
  },
  {
    name: EModalReceiveRoutes.CreateInvoice,
    component: CreateInvoice,
  },
  {
    name: EModalReceiveRoutes.ReceiveInvoice,
    component: ReceiveInvoice,
  },
  {
    name: EModalReceiveRoutes.ReceiveSelectToken,
    component: TokenSelector,
  },
  {
    name: EModalReceiveRoutes.ReceiveSelectAggregateToken,
    component: AggregateTokenSelector,
  },
  {
    name: EModalReceiveRoutes.ReceiveSelectDeriveAddress,
    component: DeriveTypesAddress,
  },
  {
    name: EModalReceiveRoutes.BtcAddresses,
    component: BtcAddresses,
  },
  {
    name: EModalReceiveRoutes.ReceiveSelector,
    component: ReceiveSelector,
  },
  {
    name: EModalReceiveRoutes.BuyModal,
    component: FiatCryptoBuyModal,
  },
  {
    name: EModalReceiveRoutes.SellModal,
    component: FiatCryptoSellModal,
  },
  {
    name: EModalReceiveRoutes.DeriveTypesAddress,
    component: DeriveTypesAddress,
  },
];
