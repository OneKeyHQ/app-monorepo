import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

import { Box } from '@onekeyhq/components';
import supportedNFC from '@onekeyhq/shared/src/detector/nfc';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../routes/routesEnum';
import { KeyTagRoutes } from '../../../KeyTag/Routes/enums';
import Layout from '../../Layout';
import { useOnboardingContext } from '../../OnboardingContext';
import { EOnboardingRoutes } from '../../routes/enums';
import { MigrationEnable } from '../Migration/util';

import {
  OptionAdress,
  OptionGoogleDrive,
  OptionKeyTag,
  OptionMigration,
  OptionOneKeyLite,
  OptionPrivateKey,
  OptionRecoveryPhrase,
  OptioniCloud,
} from './ImportWalletOptions';

import type { IAddExistingWalletMode } from '../../../../routes';
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

  const [isLogin, setIsLogin] = useState(false);
  const { serviceCloudBackup } = backgroundApiProxy;

  const disableAnimation = route?.params?.disableAnimation;

  const [hasPreviousBackups, updateHasPreviousBackups] = useState(false);
  const getBackupStatus = async () => {
    console.log('getBackupStatus = ');

    const status = await serviceCloudBackup.getBackupStatus();
    return status.hasPreviousBackups;
  };

  const swrKey = 'getBackupStatus';
  const { mutate, isValidating: iCloudLoading } = useSWR(
    swrKey,
    getBackupStatus,
    {
      refreshInterval: 30 * 1000,
      revalidateOnMount: false,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      isPaused() {
        return !isLogin;
      },
      onSuccess(data) {
        updateHasPreviousBackups(data);
      },
    },
  );

  console.log('hasPreviousBackups = ', hasPreviousBackups);

  useEffect(() => {
    if (!isLogin) {
      serviceCloudBackup.loginIfNeeded(false).then((result) => {
        setIsLogin(result);
        if (result) {
          mutate();
        }
      });
    }
  }, [isLogin, mutate, serviceCloudBackup]);

  const onPressRecoveryWallet = useCallback(
    (mode: IAddExistingWalletMode) => {
      navigation.navigate(EOnboardingRoutes.RecoveryWallet, {
        mode,
        disableAnimation,
      });
    },
    [disableAnimation, navigation],
  );

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
    navigation.navigate(EOnboardingRoutes.KeyTag, {
      screen: KeyTagRoutes.ImportKeytag,
    });
  }, [navigation]);

  const onPressRestoreFromCloud = useCallback(() => {
    navigation.navigate(EOnboardingRoutes.RestoreFromCloud);
  }, [navigation]);

  const onPressRestoreFromDrive = useCallback(() => {
    if (hasPreviousBackups) {
      navigation.navigate(EOnboardingRoutes.RestoreFromCloud);
    } else {
      // TODO:Drive
      // No backup data
    }
  }, [hasPreviousBackups, navigation]);

  return (
    <Layout
      disableAnimation={disableAnimation}
      title={intl.formatMessage({ id: 'action__import_wallet' })}
      description={intl.formatMessage({ id: 'onboarding__import_wallet_desc' })}
    >
      <Box m={-2} flexDirection={{ base: 'column', sm: 'row' }} flexWrap="wrap">
        <ItemWrapper>
          <OptionRecoveryPhrase
            title={intl.formatMessage({ id: 'title__recovery_phrase' })}
            onPress={() => {
              onPressRecoveryWallet('mnemonic');
            }}
          />
        </ItemWrapper>
        <ItemWrapper>
          <OptionPrivateKey
            icon="KeyOutline"
            title={intl.formatMessage({ id: 'form__private_key' })}
            onPress={() => {
              onPressRecoveryWallet('imported');
            }}
          />
        </ItemWrapper>
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
        {MigrationEnable && (
          <ItemWrapper>
            <OptionMigration
              title={intl.formatMessage({
                id: 'title__migration',
              })}
              onPress={onPressMigration}
            />
          </ItemWrapper>
        )}
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
          <OptionKeyTag title="KeyTag" onPress={onPressKeyTag} />
        </ItemWrapper>
        <ItemWrapper>
          <OptionAdress
            icon="EyeOutline"
            title={intl.formatMessage({ id: 'wallet__watched_accounts' })}
            onPress={() => {
              onPressRecoveryWallet('watching');
            }}
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
        {platformEnv.isNativeAndroid && (
          <ItemWrapper>
            <OptionGoogleDrive
              title={intl.formatMessage({ id: 'action__restore_from_icloud' })}
              onPress={() => {
                if (!isLogin) {
                  serviceCloudBackup.loginIfNeeded(true).then((result) => {
                    setIsLogin(result);
                    if (result) {
                      mutate();
                      onPressRestoreFromDrive();
                    } else {
                      // TODO:Drive
                      // Login fail
                    }
                  });
                } else {
                  onPressRestoreFromDrive();
                }
              }}
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
