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

const SellPage = () => {
  const route =
    useRoute<
      RouteProp<IModalFiatCryptoParamList, EModalFiatCryptoRoutes.BuyModal>
    >();
  const { networkId, accountId, tokens = [], map = {} } = route.params;
  const intl = useIntl();
  return (
    <TokenDataContainer
      initialMap={map}
      initialTokens={tokens}
      networkId={networkId}
      accountId={accountId}
    >
      <SellOrBuy
        title={intl.formatMessage({ id: ETranslations.global_sell })}
        type="sell"
        networkId={networkId}
        accountId={accountId}
      />
    </TokenDataContainer>
  );
};

export default SellPage;
