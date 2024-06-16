import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../hooks/useAppNavigation';

function EmptyWallet() {
  const intl = useIntl();
  const navigation = useAppNavigation();

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
        onPress: () =>
          navigation.pushFullModal(EModalRoutes.OnboardingModal, {
            screen: EOnboardingPages.GetStarted,
          }),
      }}
    />
  );
}

export { EmptyWallet };
