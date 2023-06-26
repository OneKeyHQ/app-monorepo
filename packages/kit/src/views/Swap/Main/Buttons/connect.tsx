import { useCallback } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';

import { useNavigation } from '../../../../hooks';
import { RootRoutes } from '../../../../routes/routesEnum';
import { EOnboardingRoutes } from '../../../Onboarding/routes/enums';

export const ConnectWalletButton: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  const onConnectWallet = useCallback(() => {
    navigation.navigate(RootRoutes.Onboarding, {
      screen: EOnboardingRoutes.ThirdPartyWallet,
    });
  }, [navigation]);

  return (
    <Button
      size="xl"
      type="primary"
      onPress={onConnectWallet}
      key="connectWallet"
    >
      {intl.formatMessage({ id: 'action__connect_wallet' })}
    </Button>
  );
};
