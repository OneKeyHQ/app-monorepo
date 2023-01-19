import { useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Center,
  Icon,
  Image,
  Pressable,
  Spinner,
  Text,
  useTheme,
  useThemeValue,
} from '@onekeyhq/components';
import type { IconProps } from '@onekeyhq/components/src/Icon';
import KeyTagPNG from '@onekeyhq/kit/assets/onboarding/import_with_keytag.png';
import OneKeyLitePNG from '@onekeyhq/kit/assets/onboarding/import_with_lite.png';
import supportedNFC from '@onekeyhq/shared/src/detector/nfc';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../routes/routesEnum';
import Layout from '../../Layout';
import { useOnboardingContext } from '../../OnboardingContext';
import { EOnboardingRoutes } from '../../routes/enums';

import type { IOnboardingRoutesParams } from '../../routes/types';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.ImportWallet
>;

type NavigationProps = StackNavigationProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.ImportWallet
>;

const ImportItem = ({
  icon,
  title,
  children,
  isDisabled,
  isLoading,
  onPress,
}: {
  icon: IconProps['name'];
  title: string;
  children: React.ReactNode;
  isDisabled?: boolean;
  isLoading?: boolean;
  onPress: () => void;
}) => {
  const { themeVariant } = useTheme();

  return (
    <Box p="8px" w={{ base: '100%', sm: '1/3' }}>
      <Pressable
        flex={1} // Implement equal height on the same row
        onPress={onPress}
        p="16px"
        pb="80px"
        bg="action-secondary-default"
        _hover={{ bgColor: 'action-secondary-hovered' }}
        _pressed={{ bgColor: 'action-secondary-pressed' }}
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="border-default"
        borderRadius="12px"
        overflow="hidden"
        disabled={isDisabled}
      >
        <Box
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Icon
            name={icon}
            color={
              isDisabled || isLoading ? 'icon-disabled' : 'interactive-default'
            }
          />
          {isLoading && <Spinner />}
        </Box>
        <Text
          mt={4}
          typography={{ sm: 'Heading', md: 'Heading' }}
          flex={1}
          color={isDisabled || isLoading ? 'text-disabled' : 'text-default'}
        >
          {title}
        </Text>
        <Box
          position="absolute"
          bottom="-64px"
          left="16px"
          right="16px"
          h="128px"
          borderRadius="12px"
          bg="surface-default"
          overflow="hidden"
        >
          <LinearGradient
            colors={['rgb(255, 255, 255)', 'rgba(255, 255, 255, 0)']}
            style={{
              position: 'absolute',
              height: 64,
              width: '100%',
              opacity: 0.1,
              zIndex: -1,
            }}
          />
          {children}
          <LinearGradient
            colors={[
              themeVariant === 'light'
                ? 'rgba(255, 255, 255, 0)'
                : 'rgba(30, 30, 42, 0)',
              useThemeValue('surface-default'),
            ]}
            style={{
              position: 'absolute',
              height: '100%',
              width: '100%',
              bottom: 64,
            }}
          />
        </Box>
      </Pressable>
    </Box>
  );
};

const IconToIconIllus = ({
  leftIcon,
  rightIcon,
}: {
  leftIcon: IconProps['name'];
  rightIcon: IconProps['name'];
}) => (
  <Center h="64px" flexDirection="row" px="24px">
    <Icon name={leftIcon} size={32} color="icon-default" />
    <LinearGradient
      colors={['transparent', useThemeValue('icon-subdued'), 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{
        flex: 1,
        height: 2,
        marginHorizontal: 8,
      }}
    />
    <Icon name={rightIcon} size={32} color="icon-default" />
  </Center>
);

const defaultProps = {} as const;

const ImportWallet = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const appNavigation = useAppNavigation();
  const route = useRoute<RouteProps>();

  const context = useOnboardingContext();
  const forceVisibleUnfocused = context?.forceVisibleUnfocused;

  const [iCloudLoading, setICloudLoading] = useState(false);

  const disableAnimation = route?.params?.disableAnimation;

  const { result: hasPreviousBackups } = usePromiseResult<boolean>(async () => {
    setICloudLoading(true);
    const status =
      await backgroundApiProxy.serviceCloudBackup.getBackupStatus();
    setICloudLoading(false);
    return status.hasPreviousBackups;
  });

  const onPressRecoveryWallet = useCallback(() => {
    navigation.navigate(EOnboardingRoutes.RecoveryWallet);
  }, [navigation]);

  const onPressMigration = useCallback(() => {
    navigation.navigate(EOnboardingRoutes.Migration, {});
  }, [navigation]);

  const onPressOneKeyLite = useCallback(() => {
    forceVisibleUnfocused?.();
    appNavigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateWallet,
      params: {
        screen: CreateWalletModalRoutes.OnekeyLiteRestorePinCodeVerifyModal,
      },
    });
  }, [appNavigation, forceVisibleUnfocused]);

  const onPressKeyTag = useCallback(() => {
    navigation.navigate(EOnboardingRoutes.KeyTag);
  }, [navigation]);

  const onPressRestoreFromCloud = useCallback(() => {
    navigation.navigate(EOnboardingRoutes.RestoreFromCloud);
  }, [navigation]);

  const FAKEPHRASE = ['shy', 'owner', 'almost', 'explain', 'movie', 'subway'];

  return (
    <Layout
      disableAnimation={disableAnimation}
      title={intl.formatMessage({ id: 'action__import_wallet' })}
      description={intl.formatMessage({ id: 'onboarding__import_wallet_desc' })}
    >
      <Box m={-2} flexDirection={{ base: 'column', sm: 'row' }} flexWrap="wrap">
        <ImportItem
          title={intl.formatMessage({
            id: 'onboarding__import_wallet_with_recovery_phrase',
          })}
          icon="ClipboardDocumentListOutline"
          onPress={onPressRecoveryWallet}
        >
          <Box flexDirection="row" px="16px" h="64px" flexWrap="wrap" py="8px">
            {FAKEPHRASE.map((phrase, index) => (
              <Box flexDirection="row" w="1/3" py="4px" key={index}>
                <Text typography="Caption" w="12px" color="text-subdued">
                  {index + 1}
                </Text>
                <Text typography="Caption">{phrase}</Text>
              </Box>
            ))}
          </Box>
        </ImportItem>
        {supportedNFC && (
          <ImportItem
            title={intl.formatMessage({
              id: 'onboarding__import_wallet_with_lite',
            })}
            icon="OnekeyLiteOutline"
            onPress={onPressOneKeyLite}
          >
            <Center>
              <Image source={OneKeyLitePNG} w="224px" h="64px" />
            </Center>
          </ImportItem>
        )}
        <ImportItem
          title={intl.formatMessage({
            id: 'onboarding__import_wallet_with_keytag',
          })}
          icon="KeytagOutline"
          onPress={onPressKeyTag}
        >
          <Center>
            <Image source={KeyTagPNG} w="224px" h="64px" />
          </Center>
        </ImportItem>
        <ImportItem
          title={intl.formatMessage({
            id: 'onboarding__import_wallet_with_migrate',
          })}
          icon="ArrowPathRoundedSquareOutline"
          onPress={onPressMigration}
        >
          <IconToIconIllus
            leftIcon="ComputerDesktopSolid"
            rightIcon="DevicePhoneMobileSolid"
          />
        </ImportItem>
        {(platformEnv.isNativeIOS || platformEnv.isNativeIOSPad) && (
          <ImportItem
            title={intl.formatMessage({ id: 'action__restore_from_icloud' })}
            icon="CloudOutline"
            onPress={onPressRestoreFromCloud}
            isDisabled={!hasPreviousBackups}
            isLoading={iCloudLoading}
          >
            <IconToIconIllus
              leftIcon="CloudSolid"
              rightIcon="OnekeyLogoSolid"
            />
          </ImportItem>
        )}
      </Box>
    </Layout>
  );
};

ImportWallet.defaultProps = defaultProps;

export default ImportWallet;
