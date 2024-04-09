import { useRoute } from '@react-navigation/core';

import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes';

import SellOrBuy from '../../components/SellOrBuy';

import type { RouteProp } from '@react-navigation/core';

const BuyPage = () => {
  const route =
    useRoute<
      RouteProp<IModalFiatCryptoParamList, EModalFiatCryptoRoutes.BuyModal>
    >();
  const { networkId, accountId } = route.params;
  return (
    <SellOrBuy
      title="Buy"
      type="buy"
      networkId={networkId}
      accountId={accountId}
    />
  );
};

export default BuyPage;
