import { useCallback } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Button } from '@onekeyhq/components';

import { useActiveWalletAccount, useNavigation } from '../../../../hooks';
import { RootRoutes } from '../../../../routes/routesEnum';

export const WalletACLButton: FC = ({ children }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { walletId } = useActiveWalletAccount();

  const onCreateWallet = useCallback(() => {
    navigation.navigate(RootRoutes.Onboarding);
  }, [navigation]);

  if (!walletId) {
    return (
      <Button size="xl" type="primary" onPress={onCreateWallet} key="addWallet">
        {intl.formatMessage({ id: 'action__create_wallet' })}
      </Button>
    );
  }
  return <Box>{children}</Box>;
};
