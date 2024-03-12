import { Empty } from '@onekeyhq/components';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../hooks/useAppNavigation';

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
