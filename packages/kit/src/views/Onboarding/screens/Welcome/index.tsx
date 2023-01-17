import { useCallback, useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Divider,
  Hidden,
  Icon,
  Image,
  Pressable,
  Text,
  useUserDevice,
} from '@onekeyhq/components';
import LogoMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';
import LogoRainbow from '@onekeyhq/kit/assets/onboarding/logo_rainbow.png';
import LogoTrustWallet from '@onekeyhq/kit/assets/onboarding/logo_trustwallet.png';
import LogoWalletconnect from '@onekeyhq/kit/assets/onboarding/logo_walletconnect.png';
import ContentHardwareImage from '@onekeyhq/kit/assets/onboarding/welcome_hardware.png';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useNavigationActions,
} from '../../../../hooks';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../routes/routesEnum';
import { setOnBoardingLoadingBehindModal } from '../../../../store/reducers/runtime';
import Layout from '../../Layout';
import { useOnboardingContext } from '../../OnboardingContext';
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

  const { network: activeNetwork } = useActiveWalletAccount();
  const hardwareDisabled = !activeNetwork?.settings?.hardwareAccountEnabled;

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
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    navigation.navigate(EOnboardingRoutes.SetPassword);
  }, [navigation]);
  const onPressImportWallet = useCallback(() => {
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    navigation.navigate(EOnboardingRoutes.ImportWallet);
  }, [navigation]);

  const onPressHardwareWallet = useCallback(() => {
    if (hardwareDisabled) return;
    forceVisibleUnfocused?.();
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    navigation.navigate(
      RootRoutes.Modal as any,
      {
        screen: ModalRoutes.CreateWallet,
        params: {
          screen: CreateWalletModalRoutes.ConnectHardwareModal,
        },
      } as any,
    );
  }, [hardwareDisabled, forceVisibleUnfocused, navigation]);

  const onPressThirdPartyWallet = useCallback(() => {
    backgroundApiProxy.dispatch(setOnBoardingLoadingBehindModal(false));
    navigation.navigate(EOnboardingRoutes.ThirdPartyWallet);
    // navigation.navigate(EOnboardingRoutes.ConnectWallet);
  }, [navigation]);

  const logos = [LogoMetaMask, LogoTrustWallet, LogoRainbow, LogoWalletconnect];

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
          <Box flexDirection={{ sm: 'row' }} w={{ sm: '100%' }}>
            <PressableListItem
              icon="PlusCircleOutline"
              label={intl.formatMessage({
                id: 'action__create_wallet',
              })}
              description={intl.formatMessage({
                id: 'content__create_wallet_desc',
              })}
              roundedBottom={{ base: 0, sm: 'xl' }}
              onPress={onPressCreateWallet}
            />
            <PressableListItem
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
              // TODO: replace usb icon
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
            </PressableListItem>
          </Box>
        </Box>
        <Hidden till="sm">
          <Box flexDirection="row" alignItems="center" mt="24px">
            <Divider flex={1} />
            <Text mx="14px" typography="Subheading" color="text-disabled">
              {intl.formatMessage({ id: 'content__or_lowercase' })}
            </Text>
            <Divider flex={1} />
          </Box>
        </Hidden>
        <Pressable
          flexDirection="row"
          alignSelf="center"
          alignItems="center"
          p="8px"
          mt={{ base: '24px', md: '12px' }}
          borderRadius="12px"
          _hover={{ bgColor: 'surface-hovered' }}
          _pressed={{ bgColor: 'surface-pressed' }}
          onPress={onPressThirdPartyWallet}
        >
          <Text
            typography={{ sm: 'Body2Strong', md: 'DisplaySmall' }}
            color="text-default"
          >
            {intl.formatMessage({ id: 'action__connect_3rd_party_wallet' })}
          </Text>
          <Box flexDirection="row" alignItems="center" mx={1.5}>
            {logos.map((logo, index) => (
              <Image
                key={index}
                source={logo}
                size={4}
                mx={0.5}
                rounded="sm"
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="border-subdued"
              />
            ))}
            {!platformEnv.isExtension && (
              <Box bg="surface-neutral-default" borderRadius="6px" mx={0.5}>
                <Icon
                  name="EllipsisHorizontalMini"
                  size={16}
                  color="icon-default"
                />
              </Box>
            )}
          </Box>
          <Icon name="ChevronRightMini" size={20} color="icon-subdued" />
        </Pressable>
      </Layout>
      <TermsOfService />
    </>
  );
};

export default Welcome;
