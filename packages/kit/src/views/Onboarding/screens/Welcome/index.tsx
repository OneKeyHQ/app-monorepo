import { useCallback, useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Hidden,
  Icon,
  Image,
  PresenceTransition,
  Text,
  useUserDevice,
} from '@onekeyhq/components';
import LogoLedger from '@onekeyhq/kit/assets/onboarding/logo_ledger.png';
import LogoMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';
import LogoOneKey from '@onekeyhq/kit/assets/onboarding/logo_onekey.png';
import LogoTokenPocket from '@onekeyhq/kit/assets/onboarding/logo_tokenpocket.png';
import LogoTrezor from '@onekeyhq/kit/assets/onboarding/logo_trezor.png';
import ContentHardwareImage from '@onekeyhq/kit/assets/onboarding/welcome_hardware.png';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../../../hooks';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { RootRoutes } from '../../../../routes/routesEnum';
import { setOnBoardingLoadingBehindModal } from '../../../../store/reducers/runtime';
import Layout from '../../Layout';
import { EOnboardingRoutes } from '../../routes/enums';

import PressableListItem from './PressableListItem';
import TermsOfService from './TermsOfService';

import type { IOnboardingRoutesParams } from '../../routes/types';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type NavigationProps = StackNavigationProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.Welcome
>;

type RouteProps = RouteProp<IOnboardingRoutesParams, EOnboardingRoutes.Welcome>;

const Welcome = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // const navigation = useAppNavigation();
  const navigation = useNavigation<NavigationProps>();
  const navigationActions = useNavigationActions();
  if (process.env.NODE_ENV !== 'production') {
    global.$$navigationActions = navigationActions;
  }

  const route = useRoute<RouteProps>();
  const disableAnimation = !!route?.params?.disableAnimation;

  useEffect(() => {
    (async function () {
      if (
        platformEnv.isExtensionUiPopup ||
        platformEnv.isExtensionUiStandaloneWindow
      ) {
        if (await backgroundApiProxy.serviceApp.isResettingApp()) {
          return;
        }
        // open onBoarding by browser tab
        backgroundApiProxy.serviceApp.openExtensionExpandTab({
          routes: [RootRoutes.Onboarding, EOnboardingRoutes.Welcome],
          params: {},
        });
        setTimeout(() => {
          window.close();
        }, 200);
      }
    })();
  }, []);

  useEffect(() => {
    // Fix cardano webembed crash when onboarding page is closed on Android platform.
    if (platformEnv.isNative) {
      appUIEventBus.emit(AppUIEventBusNames.ChainWebEmbedDisabled);
    }
  }, []);

  const intl = useIntl();
  const isSmallHeight = useUserDevice().screenHeight <= 667;
  // const goBack = useNavigationBack();
  // const insets = useSafeAreaInsets();
  const { result: hasPreviousBackups } = usePromiseResult<boolean>(async () => {
    const status =
      await backgroundApiProxy.serviceCloudBackup.getBackupStatus();
    return status.hasPreviousBackups;
  });

  const onPressCreateWallet = useCallback(() => {
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    navigation.navigate(EOnboardingRoutes.SetPassword);
  }, [navigation]);
  const onPressImportWallet = useCallback(() => {
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    navigation.navigate(EOnboardingRoutes.ImportWallet);
  }, [navigation]);
  const onPressConnectWallet = useCallback(() => {
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    navigation.navigate(EOnboardingRoutes.ConnectWallet);
  }, [navigation]);
  const onPressRestoreFromCloud = useCallback(() => {
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    navigation.navigate(EOnboardingRoutes.RestoreFromCloud);
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
        pt={{ base: isSmallHeight ? 8 : 20, sm: 0 }}
        scaleFade
        disableAnimation={disableAnimation}
      >
        <Icon name="BrandLogoIllus" size={48} />
        <Text typography={{ sm: 'DisplayXLarge', md: 'Display2XLarge' }} mt={6}>
          {intl.formatMessage({ id: 'onboarding__landing_welcome_title' })}
          {'\n'}
          <Text color="text-subdued">
            {intl.formatMessage({ id: 'onboarding__landing_welcome_desc' })}
          </Text>
        </Text>
        <Box
          flexDir={{ sm: 'row' }}
          flexWrap={{ sm: 'wrap' }}
          mt={{ base: isSmallHeight ? 8 : 16, sm: 20 }}
          mx={-2}
        >
          <Box
            flexDirection={{ sm: 'row' }}
            w={{ sm: hasPreviousBackups ? '100%' : '2/3' }}
          >
            <PressableListItem
              icon="PlusCircleOutline"
              label={intl.formatMessage({
                id: 'action__create_wallet',
              })}
              description="by generating a new recovery phrase on app"
              roundedBottom={{ base: 0, sm: 'xl' }}
              onPress={onPressCreateWallet}
            />
            <PressableListItem
              icon="ArrowDownCircleOutline"
              label={intl.formatMessage({
                id: 'action__import_wallet',
              })}
              description="with recovery phrase, private key, address, OneKey Lite, KeyTag and more..."
              mt="-1px"
              mb={{ base: 6, sm: 0 }}
              roundedTop={{ base: 0, sm: 'xl' }}
              onPress={onPressImportWallet}
            />
          </Box>
          <Box
            flexDirection={{ sm: 'row' }}
            w={{ sm: hasPreviousBackups ? '100%' : '1/3' }}
            mt={{ sm: hasPreviousBackups ? 4 : undefined }}
          >
            <Box flex={1}>
              <PressableListItem
                // TODO: replace usb icon
                icon="LinkOutline"
                label={intl.formatMessage({
                  id: 'action__connect_hardware_wallet',
                })}
                description="Support OneKey hardware wallet"
                onPress={onPressConnectWallet}
                overflow="hidden"
              >
                <Hidden till="sm">
                  <Box
                    position={{ sm: 'absolute' }}
                    right={{ sm: 0 }}
                    bottom={{ sm: '-40px' }}
                  >
                    <Image
                      source={ContentHardwareImage}
                      size={247}
                      rounded="sm"
                    />
                  </Box>
                </Hidden>
              </PressableListItem>
            </Box>
            {hasPreviousBackups ? (
              <PresenceTransition
                as={Box}
                visible={hasPreviousBackups}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  transition: { duration: 150 },
                }}
                // @ts-expect-error
                mt={{ base: '24px', sm: '0' }}
                flex={1}
              >
                <PressableListItem
                  icon="CloudOutline"
                  label={intl.formatMessage({
                    id: 'action__restore_from_icloud',
                  })}
                  description=""
                  onPress={onPressRestoreFromCloud}
                />
              </PresenceTransition>
            ) : undefined}
          </Box>
        </Box>
        <Hidden till="sm">
          <Box
            flexDirection={{ sm: 'row' }}
            alignItems="center"
            justifyContent="center"
            my={{ sm: 6 }}
          >
            <Divider flex={1} />
            <Text mx={{ sm: 4 }} typography="Subheading" color="text-disabled">
              OR
            </Text>
            <Divider flex={1} />
          </Box>
        </Hidden>
      </Layout>
      <TermsOfService />
    </>
  );
};

export default Welcome;
