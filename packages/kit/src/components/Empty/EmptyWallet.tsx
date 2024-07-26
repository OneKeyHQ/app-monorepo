import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useToOnBoardingPage } from '../../views/Onboarding/pages';

function EmptyWallet() {
  const intl = useIntl();
  const toOnBoardingPage = useToOnBoardingPage();
  return (
    <Empty
      testID="Wallet-No-Wallet-Empty"
      icon="WalletCryptoOutline"
      title={intl.formatMessage({ id: ETranslations.global_no_wallet })}
      description={intl.formatMessage({
        id: ETranslations.global_no_wallet_desc,
      })}
      buttonProps={{
        children: intl.formatMessage({
          id: ETranslations.global_create_wallet,
        }),
        onPress: toOnBoardingPage,
      }}
    />
  );
}

export { EmptyWallet };
