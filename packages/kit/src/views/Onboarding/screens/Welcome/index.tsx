import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Hidden,
  Icon,
  Image,
  Text,
  useUserDevice,
} from '@onekeyhq/components';
import ContentHardwareImage from '@onekeyhq/kit/assets/onboarding/welcome_hardware.png';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../../../hooks';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../routes/routesEnum';
import { setOnBoardingLoadingBehindModal } from '../../../../store/reducers/runtime';
import Layout from '../../Layout';
import { useOnboardingContext } from '../../OnboardingContext';
import { EOnboardingRoutes } from '../../routes/enums';

import { ConnectThirdPartyWallet } from './ConnectThirdPartyWallet';
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
  const [disableAnimation, setDisableAnimation] = useState(
    !!route?.params?.disableAnimation,
  );
  const resetLayoutAnimation = useCallback(
    () => setDisableAnimation(!!route?.params?.disableAnimation),
    [route],
  );

  const context = useOnboardingContext();
  const forceVisibleUnfocused = context?.forceVisibleUnfocused;

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

  const onPressCreateWallet = useCallback(() => {
    resetLayoutAnimation();
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    navigation.navigate(EOnboardingRoutes.SetPassword);
  }, [navigation, resetLayoutAnimation]);
  const onPressImportWallet = useCallback(() => {
    resetLayoutAnimation();
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    navigation.navigate(EOnboardingRoutes.ImportWallet);
  }, [navigation, resetLayoutAnimation]);

  const onPressHardwareWallet = useCallback(() => {
    setDisableAnimation(true);
    forceVisibleUnfocused?.();
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    if (disableAnimation) {
      navigation.navigate(
        RootRoutes.Modal as any,
        {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.ConnectHardwareModal,
          },
        } as any,
      );
    } else {
      setTimeout(() => {
        navigation.navigate(
          RootRoutes.Modal as any,
          {
            screen: ModalRoutes.CreateWallet,
            params: {
              screen: CreateWalletModalRoutes.ConnectHardwareModal,
            },
          } as any,
        );
      }, 100);
    }
  }, [forceVisibleUnfocused, navigation, disableAnimation]);

  const onPressThirdPartyWallet = useCallback(() => {
    resetLayoutAnimation();
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    setTimeout(() => navigation.navigate(EOnboardingRoutes.BTCExternalWallet));
  }, [navigation, resetLayoutAnimation]);

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
        <Text
          typography={{ sm: 'DisplayXLarge', md: 'Display2XLarge' }}
          mt={6}
          flexGrow={1}
        >
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
          <Box flexDirection={{ sm: 'row' }} w={{ sm: '100%' }}>
            <PressableListItem
              icon="PlusCircleOutline"
              label="Connect Wallet"
              description=""
              roundedBottom={{ base: 0, sm: 'xl' }}
              onPress={onPressThirdPartyWallet}
            />
            {/* <PressableListItem
              icon="ArrowDownCircleOutline"
              label={intl.formatMessage({
                id: 'action__import_wallet',
              })}
              description={intl.formatMessage({
                id: 'content__onboarding_import_wallet_desc',
              })}
              mt="-1px"
              mb={{ base: 6, sm: 0 }}
              roundedTop={{ base: 0, sm: 'xl' }}
              onPress={onPressImportWallet}
            />
            <PressableListItem
              icon="UsbCableOutline"
              label={intl.formatMessage({
                id: 'action__connect_hardware_wallet',
              })}
              description={intl.formatMessage({
                id: 'content__conenct_hardware_wallet_desc',
              })}
              onPress={onPressHardwareWallet}
              overflow="hidden"
            >
              <Hidden till="sm">
                <Box position="absolute" zIndex={-1} right="0" top="0">
                  <Image
                    source={ContentHardwareImage}
                    w="256px"
                    h="207px"
                    opacity={0.75}
                  />
                </Box>
              </Hidden>
            </PressableListItem> */}
          </Box>
        </Box>
        {/* <Hidden till="sm">
          <Box flexDirection="row" alignItems="center" mt="24px" mb="-12px">
            <Divider flex={1} />
            <Text mx="14px" typography="Subheading" color="text-disabled">
              {intl.formatMessage({ id: 'content__or_lowercase' })}
            </Text>
            <Divider flex={1} />
          </Box>
        </Hidden>
        <ConnectThirdPartyWallet onPress={onPressThirdPartyWallet} /> */}
      </Layout>
      <TermsOfService />
    </>
  );
};

export default Welcome;
