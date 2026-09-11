import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { shouldRedirectOnboardingToTravelMode } from '@onekeyhq/kit/src/utils/onboardingEntryGate';
import { useToOnBoardingPage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function EmptyWallet() {
  const intl = useIntl();
  const toOnBoardingPage = useToOnBoardingPage();
  return (
    <Empty
      testID="Wallet-No-Wallet-Empty"
      illustration="WalletAdd"
      title={intl.formatMessage({ id: ETranslations.global_no_wallet })}
      description={intl.formatMessage({
        id: ETranslations.global_no_wallet_desc,
      })}
      buttonProps={{
        disabled: shouldRedirectOnboardingToTravelMode(),
        testID: 'empty-wallet-create-button',
        children: intl.formatMessage({
          id: ETranslations.global_create_wallet,
        }),
        onPress: () => {
          void toOnBoardingPage();
        },
      }}
    />
  );
}

export { EmptyWallet };
