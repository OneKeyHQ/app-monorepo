import { useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Center, Hidden, Text, ToastManager } from '@onekeyhq/components';
import LogoOneKey from '@onekeyhq/kit/assets/logo_black.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  ConnectWalletListItem,
  ConnectWalletListView,
} from '../../../../components/WalletConnect/WalletConnectQrcodeModal';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { useOnboardingDone } from '../../../../hooks/useOnboardingRequired';
import { wait } from '../../../../utils/helper';
import { useAddExternalAccount } from '../../../ExternalAccount/useAddExternalAccount';
import Layout from '../../Layout';

import type { EOnboardingRoutes } from '../../routes/enums';
import type { IOnboardingRoutesParams } from '../../routes/types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.BTCExternalWallet
>;

const BTCExternalWallet = () => {
  const intl = useIntl();

  const { addExternalAccount } = useAddExternalAccount();
  const onboardingDone = useOnboardingDone();

  const route = useRoute<RouteProps>();
  const disableOnboardingDone = route.params?.disableOnboardingDone;
  const onSuccess = route.params?.onSuccess;

  const navigation = useAppNavigation();

  return (
    <Layout title={intl.formatMessage({ id: 'title__connect_with' })}>
      <Box flexDir="row" flexWrap="wrap" m="-4px" minH="10px">
        {/* BTC External Account */}
        <ConnectWalletListItem
          available
          label="OneKey Injected"
          logoSource={LogoOneKey}
          isLoading={false}
          onPress={() => console.log('OneKey')}
        />
      </Box>
    </Layout>
  );
};

BTCExternalWallet.displayName = 'BTCExternalWallet';

export default BTCExternalWallet;
