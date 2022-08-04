import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Box, Icon, Image, Pressable, Text } from '@onekeyhq/components';
import DeviceMobile from '@onekeyhq/kit/assets/onboarding/device_classic_touch.png';
import DeviceAll from '@onekeyhq/kit/assets/onboarding/device_mini_classic_touch.png';
import OneKeyLite from '@onekeyhq/kit/assets/onekey-lite.png';
import supportedNFC from '@onekeyhq/shared/src/detector/nfc';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveWalletAccount } from '../../../../hooks';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../routes/routesEnum';
import Layout from '../../Layout';
import { useOnboardingContext } from '../../OnboardingContext';

import SecondaryContent from './SecondaryContent';

function ConnectHardwareButton() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const context = useOnboardingContext();
  const forceVisibleUnfocused = context?.forceVisibleUnfocused;

  const showConnectHardwareModal = useCallback(() => {
    // ** open same stack view
    // navigation.navigate(EOnboardingRoutes.ConnectHardwareModal as any);

    // ** open new stack modal
    forceVisibleUnfocused?.();
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateWallet,
      params: {
        screen: CreateWalletModalRoutes.ConnectHardwareModal,
      },
    });
  }, [forceVisibleUnfocused, navigation]);

  const { network: activeNetwork } = useActiveWalletAccount();

  // TODO should check activeNetwork hardwareDisabled ??
  const hardwareDisabled = !activeNetwork?.settings?.hardwareAccountEnabled;

  return (
    <Pressable
      h={{ base: 200, sm: 240 }}
      pt={4}
      pb={5}
      px={5}
      rounded="xl"
      bgColor="surface-default"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
      borderWidth={1}
      borderColor="border-subdued"
      onPress={() => {
        if (hardwareDisabled) return;
        showConnectHardwareModal();
      }}
    >
      <Text typography="Heading">
        OneKey{'\n'}
        {intl.formatMessage({ id: 'wallet__hardware_wallet' })}
      </Text>
      <Box flex={1} />
      <Box alignSelf="flex-start">
        {hardwareDisabled ? (
          <Badge
            title={intl.formatMessage({ id: 'badge__coming_soon' })}
            size="sm"
            type="default"
          />
        ) : (
          <Icon name="ArrowRightOutline" />
          // <Badge
          //   title={intl.formatMessage({ id: 'badge__coming_soon' })}
          //   size="sm"
          //   type="default"
          // />
        )}
      </Box>
      <Image
        position="absolute"
        bottom={0}
        right={{ base: -16, sm: -24 }}
        source={platformEnv.isNative ? DeviceMobile : DeviceAll}
        height={{ base: 200, sm: 235 }}
        width={{ base: 243, sm: 285 }}
      />
    </Pressable>
  );
}

function ConnectOneKeyLiteButton() {
  const navigation = useAppNavigation();

  const context = useOnboardingContext();
  const forceVisibleUnfocused = context?.forceVisibleUnfocused;

  const showOneKeyLiteModal = useCallback(() => {
    forceVisibleUnfocused?.();
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateWallet,
      params: {
        screen: CreateWalletModalRoutes.OnekeyLiteRestorePinCodeVerifyModal,
      },
    });
  }, [navigation, forceVisibleUnfocused]);

  return (
    <Box mt={{ base: 6, sm: 4 }} mx={{ base: -2, sm: 0 }}>
      <Pressable
        flexDir="row"
        alignItems="center"
        px={{ base: 2, sm: 4 }}
        py={3}
        rounded="xl"
        borderWidth={{ sm: 1 }}
        borderColor="border-subdued"
        bgColor={{ sm: 'surface-default' }}
        _hover={{ bgColor: 'surface-hovered' }}
        _pressed={{ bgColor: 'surface-pressed' }}
        onPress={() => showOneKeyLiteModal()}
      >
        <Image source={OneKeyLite} size={8} />
        <Text
          flex={1}
          mx={3}
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
        >
          OneKey Lite
        </Text>
        <Icon name="ChevronRightSolid" size={20} />
      </Pressable>
    </Box>
  );
}

const ConnectWallet = () => {
  const intl = useIntl();

  return (
    <>
      <Layout
        title={intl.formatMessage({ id: 'title__connect_with' })}
        secondaryContent={<SecondaryContent />}
      >
        <ConnectHardwareButton />
        {supportedNFC || platformEnv.isDev ? <ConnectOneKeyLiteButton /> : null}
      </Layout>
    </>
  );
};

export default React.memo(ConnectWallet);
