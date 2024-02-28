import { Empty } from '@onekeyhq/components';

import useAppNavigation from '../../hooks/useAppNavigation';
import { EModalRoutes } from '../../routes/Modal/type';
import { EOnboardingPages } from '../../views/Onboarding/router/type';

function EmptyWallet() {
  const navigation = useAppNavigation();

  return (
    <Empty
      testID="Wallet-No-Wallet-Empty"
      icon="WalletCryptoOutline"
      title="No Wallet"
      description="Create one to start managing your cryptocurrency safely and efficiently"
      buttonProps={{
        children: 'Create Wallet',
        onPress: () =>
          navigation.pushFullModal(EModalRoutes.OnboardingModal, {
            screen: EOnboardingPages.GetStarted,
          }),
      }}
    />
  );
}

export { EmptyWallet };
