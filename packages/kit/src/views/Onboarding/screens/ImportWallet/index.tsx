import { useCallback, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box } from '@onekeyhq/components';
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
import { MigrationEnable } from '../Migration/util';

import {
  OptionKeyTag,
  OptionMigration,
  OptionOneKeyLite,
  OptionRecoveryPhrase,
  OptioniCloud,
} from './ImportWalletOptions';

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

const defaultProps = {} as const;

const ItemWrapper = ({ children }: { children: any }) => (
  <Box p="8px" w={{ base: '100%', sm: '1/3' }}>
    {children}
  </Box>
);

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
    navigation.navigate(EOnboardingRoutes.Migration, {
      disableAnimation: false,
    });
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

  return (
    <Layout
      disableAnimation={disableAnimation}
      title={intl.formatMessage({ id: 'action__import_wallet' })}
      description={intl.formatMessage({ id: 'onboarding__import_wallet_desc' })}
    >
      <Box m={-2} flexDirection={{ base: 'column', sm: 'row' }} flexWrap="wrap">
        <ItemWrapper>
          <OptionRecoveryPhrase
            title={intl.formatMessage({
              id: 'onboarding__import_wallet_with_recovery_phrase',
            })}
            onPress={onPressRecoveryWallet}
          />
        </ItemWrapper>
        {supportedNFC && (
          <ItemWrapper>
            <OptionOneKeyLite
              title={intl.formatMessage({
                id: 'onboarding__import_wallet_with_lite',
              })}
              onPress={onPressOneKeyLite}
            />
          </ItemWrapper>
        )}
        <ItemWrapper>
          <OptionKeyTag
            title={intl.formatMessage({
              id: 'onboarding__import_wallet_with_keytag',
            })}
            onPress={onPressKeyTag}
          />
        </ItemWrapper>
        {MigrationEnable && (
          <ItemWrapper>
            <OptionMigration
              title={intl.formatMessage({
                id: 'onboarding__import_wallet_with_migrate',
              })}
              onPress={onPressMigration}
            />
          </ItemWrapper>
        )}
        {(platformEnv.isNativeIOS || platformEnv.isNativeIOSPad) && (
          <ItemWrapper>
            <OptioniCloud
              title={intl.formatMessage({ id: 'action__restore_from_icloud' })}
              onPress={onPressRestoreFromCloud}
              isDisabled={!hasPreviousBackups}
              isLoading={iCloudLoading}
            />
          </ItemWrapper>
        )}
      </Box>
    </Layout>
  );
};

ImportWallet.defaultProps = defaultProps;

export default ImportWallet;
