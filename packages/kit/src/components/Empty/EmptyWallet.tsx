import useAppNavigation from '../../hooks/useAppNavigation';
import { EModalRoutes } from '../../routes/Modal/type';
import { EOnboardingPages } from '../../views/Onboarding/router/type';

import { EmptyBase } from './EmptyBase';

function EmptyWallet() {
  const navigation = useAppNavigation();

  return (
    <EmptyBase
      icon="WalletCryptoOutline"
      title="No Wallet"
      description="Create one to start managing your cryptocurrency safely and efficiently"
      actions={[
        {
          text: 'Create Wallet',
          OnPress: () =>
            navigation.pushFullModal(EModalRoutes.OnboardingModal, {
              screen: EOnboardingPages.GetStarted,
            }),
        },
      ]}
    />
  );
}

export { EmptyWallet };
