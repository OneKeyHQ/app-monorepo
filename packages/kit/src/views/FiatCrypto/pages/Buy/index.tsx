import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes';

import SellOrBuy from '../../components/SellOrBuy';
import { TokenDataContainer } from '../../components/TokenDataContainer';

import type { RouteProp } from '@react-navigation/core';

const BuyPage = () => {
  const route =
    useRoute<
      RouteProp<IModalFiatCryptoParamList, EModalFiatCryptoRoutes.BuyModal>
    >();
  const { networkId, accountId } = route.params;
  const intl = useIntl();
  return (
    <TokenDataContainer initialMap={{}} initialTokens={[]}>
      <SellOrBuy
        title={intl.formatMessage({ id: ETranslations.global_buy })}
        type="buy"
        networkId={networkId}
        accountId={accountId}
      />
    </TokenDataContainer>
  );
};

export default BuyPage;
