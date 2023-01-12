import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, Icon, Text } from '@onekeyhq/components';
import type { IconProps } from '@onekeyhq/components/src/Icon';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import {
  CreateWalletModalRoutes,
  HomeRoutes,
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
  onPress,
}: {
  icon: IconProps['name'];
  title: string;
  children: React.ReactNode;
  onPress: () => void;
}) => (
  <PressableItem
    onPress={onPress}
    my={2}
    mx={2}
    px={{ base: 4 }}
    pt={{ base: 4 }}
    width={{ base: 'auto', sm: 64 }}
    minHeight={{ base: '192px' }}
    pb={0}
    bg={{ base: 'action-secondary-default' }}
    borderWidth={StyleSheet.hairlineWidth}
    borderColor={{ base: 'border-default' }}
    flexDirection="column"
    rounded={{ base: 'xl' }}
  >
    <Icon size={24} name={icon} color="interactive-default" />
    <Text
      my={{ base: 4 }}
      typography={{ sm: 'Heading', md: 'Heading' }}
      flex={1}
    >
      {title}
    </Text>
    <Box
      position="absolute"
      bottom={0}
      left="16px"
      right="16px"
      h="64px"
      bg="surface-default"
      borderTopLeftRadius={3}
      borderTopRightRadius={3}
      style={{
        shadowColor: '#000',
        shadowOffset: {
          width: 2,
          height: 2,
        },
        shadowOpacity: 0.5,
        shadowRadius: 12,
      }}
    >
      {children}
    </Box>
    <Box h="64px" />
  </PressableItem>
);
const defaultProps = {} as const;

const ImportWallet = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const appNavigation = useAppNavigation();
  const route = useRoute<RouteProps>();

  const context = useOnboardingContext();
  const forceVisibleUnfocused = context?.forceVisibleUnfocused;

  const disableAnimation = route?.params?.disableAnimation;

  const { result: hasPreviousBackups } = usePromiseResult<boolean>(async () => {
    const status =
      await backgroundApiProxy.serviceCloudBackup.getBackupStatus();
    return status.hasPreviousBackups;
  });

  const onPressRecoveryWallet = useCallback(() => {
    navigation.navigate(EOnboardingRoutes.RecoveryWallet);
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
    appNavigation.navigate(RootRoutes.Root, {
      screen: HomeRoutes.KeyTag,
    });
  }, [appNavigation]);

  const onPressRestoreFromCloud = useCallback(() => {
    navigation.navigate(EOnboardingRoutes.RestoreFromCloud);
  }, [navigation]);

  return (
    <Layout
      disableAnimation={disableAnimation}
      title={intl.formatMessage({ id: 'action__import_wallet' })}
    >
      <Text
        typography={{ sm: 'DisplayLarge', md: 'DisplayXLarge' }}
        color={{ base: 'text-subdued' }}
      >
        Choose how you would like to import your wallet.
      </Text>
      <Box
        mt={{ base: 6, sm: 12 }}
        mx={-2}
        flexDirection={{ base: 'column', sm: 'row' }}
        flexWrap="wrap"
      >
        <ImportItem
          title="With Recovery Phrase, Private Key or Address"
          icon="CloudOutline"
          onPress={onPressRecoveryWallet}
        >
          <Box />
        </ImportItem>
        <ImportItem
          title="With OneKey Lite"
          icon="CloudOutline"
          onPress={onPressOneKeyLite}
        >
          <Box />
        </ImportItem>
        <ImportItem
          title="With KeyTag"
          icon="CloudOutline"
          onPress={onPressKeyTag}
        >
          <Box />
        </ImportItem>
      </Box>
      <Box
        mx={-2}
        flexDirection={{ base: 'column', sm: 'row' }}
        flexWrap="wrap"
      >
        <ImportItem
          title="From another Device"
          icon="CloudOutline"
          onPress={() => {}}
        >
          <Box />
        </ImportItem>
        {hasPreviousBackups && (
          <ImportItem
            title="Restore From iCloud"
            icon="CloudOutline"
            onPress={onPressRestoreFromCloud}
          >
            <Box />
          </ImportItem>
        )}
      </Box>
    </Layout>
  );
};

ImportWallet.defaultProps = defaultProps;

export default ImportWallet;
