import React, { useCallback, useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, Hidden, Icon, Image, Text } from '@onekeyhq/components';
import LogoLedger from '@onekeyhq/kit/assets/onboarding/logo_ledger.png';
import LogoMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';
import LogoOneKey from '@onekeyhq/kit/assets/onboarding/logo_onekey.png';
import LogoTokenPocket from '@onekeyhq/kit/assets/onboarding/logo_tokenpocket.png';
import LogoTrezor from '@onekeyhq/kit/assets/onboarding/logo_trezor.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { RootRoutes } from '../../../../routes/routesEnum';
import Layout from '../../Layout';
import { EOnboardingRoutes } from '../../routes/enums';
import { IOnboardingRoutesParams } from '../../routes/types';

import PressableListItem from './PressableListItem';
import TermsOfService from './TermsOfService';

type NavigationProps = StackNavigationProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.Welcome
>;

const Welcome = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const navigation = useAppNavigation();
  const navigation = useNavigation<NavigationProps>();

  useEffect(() => {
    if (platformEnv.isExtensionUiPopup) {
      backgroundApiProxy.serviceApp.openExtensionExpandTab({
        routes: [RootRoutes.Onboarding, EOnboardingRoutes.Welcome],
        params: {},
      });
      window.close();
    }
  }, []);

  const intl = useIntl();
  // const goBack = useNavigationBack();
  // const insets = useSafeAreaInsets();

  const onPressCreateWallet = useCallback(() => {
    navigation.navigate(EOnboardingRoutes.SetPassword);
  }, [navigation]);
  const onPressImportWallet = useCallback(() => {
    navigation.navigate(EOnboardingRoutes.ImportWallet);
  }, [navigation]);
  const onPressConnectWallet = useCallback(() => {
    navigation.navigate(EOnboardingRoutes.ConnectWallet);
  }, [navigation]);

  const logos = [
    LogoOneKey,
    LogoTrezor,
    LogoLedger,
    LogoMetaMask,
    LogoTokenPocket,
  ];

  return (
    <>
      <Layout
        showCloseButton
        backButton={false}
        pt={{ base: 20, sm: 0 }}
        scaleFade
      >
        <Icon name="BrandLogoIllus" size={48} />
        <Text typography={{ sm: 'DisplayXLarge', md: 'Display2XLarge' }} mt={6}>
          {intl.formatMessage({ id: 'onboarding__landing_welcome_title' })}
          {'\n'}
          <Text color="text-subdued">
            {intl.formatMessage({ id: 'onboarding__landing_welcome_desc' })}
          </Text>
        </Text>
        <Box flexDir={{ sm: 'row' }} mt={{ base: 16, sm: 20 }} mx={-2}>
          <PressableListItem
            icon="PlusCircleOutline"
            label={intl.formatMessage({
              id: 'action__create_wallet',
            })}
            roundedBottom={{ base: 0, sm: 'xl' }}
            onPress={onPressCreateWallet}
          />
          <PressableListItem
            icon="SaveOutline"
            label={intl.formatMessage({
              id: 'action__import_wallet',
            })}
            mt="-1px"
            mb={{ base: 8, sm: 0 }}
            roundedTop={{ base: 0, sm: 'xl' }}
            onPress={onPressImportWallet}
          />
          <PressableListItem
            icon="ConnectOutline"
            label={intl.formatMessage({
              id: 'action__connect_wallet',
            })}
            onPress={onPressConnectWallet}
          >
            <Box
              flexDir="row"
              position={{ sm: 'absolute' }}
              top={{ base: 1, sm: 33 }}
              right={{ sm: 25 }}
              ml={2}
            >
              {logos.map((logo, index) => (
                <Image
                  key={index}
                  source={logo}
                  size={4}
                  mx={0.5}
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor="border-subdued"
                  rounded="sm"
                />
              ))}
            </Box>
          </PressableListItem>
          <Hidden from="sm">
            <Text mt={3} mx={2} color="text-subdued" typography="Body2">
              {intl.formatMessage({ id: 'content__supported_wallets' })}
            </Text>
          </Hidden>
        </Box>
      </Layout>
      <TermsOfService />
    </>
  );
};

export default Welcome;
