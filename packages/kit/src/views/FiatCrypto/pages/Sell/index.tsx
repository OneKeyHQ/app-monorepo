import { useRoute } from '@react-navigation/core';

import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes';

import SellOrBuy from '../../components/SellOrBuy';

import type { RouteProp } from '@react-navigation/core';

const SellPage = () => {
  const route =
    useRoute<
      RouteProp<IModalFiatCryptoParamList, EModalFiatCryptoRoutes.BuyModal>
    >();
  const { networkId, accountId } = route.params;
  return (
    <SellOrBuy
      title="Sell"
      type="sell"
      networkId={networkId}
      accountId={accountId}
    />
  );
};

export default SellPage;
