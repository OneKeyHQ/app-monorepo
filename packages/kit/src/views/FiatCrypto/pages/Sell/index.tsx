import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
  return (
    <SellOrBuy
      title={intl.formatMessage({ id: ETranslations.global_sell })}
      type="sell"
      networkId={networkId}
      accountId={accountId}
    />
  );
};

export default SellPage;
