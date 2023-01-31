import { useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Center, Hidden, Text, ToastManager } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ConnectWalletListView } from '../../../../components/WalletConnect/WalletConnectQrcodeModal';
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
  EOnboardingRoutes.ThirdPartyWallet
>;

const ThirdPartyWallet = () => {
  const intl = useIntl();

  const { addExternalAccount } = useAddExternalAccount();
  const onboardingDone = useOnboardingDone();

  const route = useRoute<RouteProps>();
  const disableOnboardingDone = route.params?.disableOnboardingDone;
  const onSuccess = route.params?.onSuccess;

  const navigation = useAppNavigation();

  const [showPlaceholder, setShowPlaceholder] = useState(false);

  return (
    <Layout title={intl.formatMessage({ id: 'title__connect_with' })}>
      {showPlaceholder && (
        <Center>
          <Text typography={{ sm: 'Body1', md: 'Body1' }}>
            {intl.formatMessage({ id: 'content__no_other_wallets_installed' })}
          </Text>
        </Center>
      )}

      <Box flexDir="row" flexWrap="wrap" m="-4px" minH="10px">
        <ConnectWalletListView
          onConnectResult={async (result) => {
            await addExternalAccount(result);
            if (!disableOnboardingDone) {
              await onboardingDone();
              await wait(600);
              ToastManager.show({
                title: intl.formatMessage({ id: 'msg__account_imported' }),
              });
            } else {
              navigation?.goBack?.();
            }
            if (onSuccess) {
              onSuccess();
            }
          }}
          walletListsCallback={(dataSource) => {
            setShowPlaceholder(
              !!platformEnv.isNativeIOS && dataSource.length === 0,
            );
          }}
        />
      </Box>
      <Hidden till="sm">
        <>
          <Text mt={8} mb={3} typography="Subheading" color="text-subdued">
            {intl.formatMessage({ id: 'content__institutional_wallets' })}
          </Text>
          <Box flexDir="row" flexWrap="wrap" m="-4px">
            <ConnectWalletListView
              onConnectResult={async (result) => {
                await addExternalAccount(result);
                navigation?.goBack?.();
              }}
              isInstitutionWallet
            />
          </Box>
        </>
      </Hidden>
    </Layout>
  );
};

ThirdPartyWallet.displayName = 'ThirdPartyWallet';

export default ThirdPartyWallet;
