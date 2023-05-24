import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import semver from 'semver';

import {
  Box,
  Button,
  Center,
  Icon,
  ScrollView,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { RestoreResult } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.enums';
import type {
  ISimpleDBBackUp,
  PublicBackupData,
} from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { useAppSelector, useData } from '../../../../../hooks/redux';
import useImportBackupPasswordModal from '../../../../../hooks/useImportBackupPasswordModal';
import useLocalAuthenticationModal from '../../../../../hooks/useLocalAuthenticationModal';
import { useOnboardingDone } from '../../../../../hooks/useOnboardingRequired';
import {
  GroupedBackupDetails,
  checkHasRemoteData,
} from '../../../../Me/SecuritySection/CloudBackup/BackupDetails';
import { showUpgrateDialog } from '../../../../Me/SecuritySection/CloudBackup/UpgrateDialog';
import { useOnboardingClose } from '../../../hooks';
import Layout from '../../../Layout';

import type { EOnboardingRoutes } from '../../../routes/enums';
import type { IOnboardingRoutesParams } from '../../../routes/types';
import type { RouteProp } from '@react-navigation/core';

const defaultProps = {} as const;

type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.MigrationPreview
>;

const PreviewImportData = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { data } = route.params;
  const navigation = useNavigation();
  const { serviceCloudBackup } = backgroundApiProxy;
  const version = useAppSelector((s) => s.settings.version);
  const isVerticalLayout = useIsVerticalLayout();
  const { isPasswordSet } = useData();
  const { showVerify } = useLocalAuthenticationModal();
  const onboardingDone = useOnboardingDone();
  const { onboardingGoBack } = useOnboardingClose();

  const { requestBackupPassword } = useImportBackupPasswordModal();

  const [hasRemoteData, setHasRemoteData] = useState(false);
  const [backupData, setBackupData] = useState<{
    alreadyOnDevice: PublicBackupData;
    notOnDevice: PublicBackupData;
  }>({
    alreadyOnDevice: {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      simpleDb: {} as ISimpleDBBackUp,
    },
    notOnDevice: {
      contacts: {},
      importedAccounts: {},
      watchingAccounts: {},
      HDWallets: {},
      simpleDb: {} as ISimpleDBBackUp,
    },
  });

  const onImportDone = useCallback(async () => {
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__backup_imported' }),
    });
    await onboardingDone({ delay: 200 });
  }, [intl, onboardingDone]);

  const onImportError = useCallback(() => {
    ToastManager.show(
      {
        title: intl.formatMessage({
          id: 'msg__import_icloud_backup_failed_version',
        }),
      },
      { type: 'error' },
    );
    navigation.goBack();
  }, [intl, navigation]);

  const checkVersion = useCallback(() => {
    // old version
    if (data.appVersion === undefined) {
      return true;
    }
    // data version >= local version
    if (data.appVersion && semver.gt(data.appVersion, version)) {
      return false;
    }
    return true;
  }, [data.appVersion, version]);

  const importAction = useCallback(
    async () =>
      new Promise<boolean>((resolve) => {
        if (checkVersion() === false) {
          showUpgrateDialog();
          resolve(false);
          return;
        }
        if (isPasswordSet) {
          showVerify(
            (localPassword) => {
              serviceCloudBackup
                .restoreFromPrivateBackup({
                  privateBackupData: data.private,
                  notOnDevice: backupData.notOnDevice,
                  localPassword,
                })
                .then((r) => {
                  if (r === RestoreResult.SUCCESS) {
                    onImportDone().then(() => {
                      resolve(true);
                    });
                  } else if (r === RestoreResult.WRONG_PASSWORD) {
                    requestBackupPassword(
                      (remotePassword) =>
                        serviceCloudBackup.restoreFromPrivateBackup({
                          privateBackupData: data.private,
                          notOnDevice: backupData.notOnDevice,
                          localPassword,
                          remotePassword,
                        }),
                      async () => {
                        await onImportDone();
                        resolve(true);
                      },
                      () => {
                        onImportError();
                        resolve(false);
                      },
                      () => {
                        resolve(false);
                      },
                    );
                  } else {
                    onImportError();
                    resolve(false);
                  }
                });
            },
            () => {
              resolve(false);
            },
          );
        } else {
          requestBackupPassword(
            (remotePassword) =>
              serviceCloudBackup.restoreFromPrivateBackup({
                privateBackupData: data.private,
                notOnDevice: backupData.notOnDevice,
                localPassword: remotePassword,
                remotePassword,
              }),
            async () => {
              await onImportDone();
              resolve(true);
            },
            () => {
              onImportError();
              resolve(false);
            },
            () => {
              resolve(false);
            },
          );
        }
      }),
    [
      backupData.notOnDevice,
      checkVersion,
      data.private,
      isPasswordSet,
      onImportDone,
      onImportError,
      requestBackupPassword,
      serviceCloudBackup,
      showVerify,
    ],
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    serviceCloudBackup
      .getBackupDetailsWithRemoteData(JSON.parse(data.public))
      .then((backupDetails) => {
        setBackupData(backupDetails);
        setHasRemoteData(checkHasRemoteData(backupDetails.notOnDevice));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceCloudBackup]);

  const children = useMemo(
    () => (
      <>
        <Box flex={1} flexDirection="column">
          <ScrollView
            flex={1}
            mb="24px"
            minHeight="160px"
            maxHeight={{ base: undefined, sm: '320px' }}
            showsVerticalScrollIndicator
          >
            {hasRemoteData ? (
              <Box mx="-48px" my="-16px">
                <GroupedBackupDetails
                  onDevice={false}
                  publicBackupData={backupData.notOnDevice}
                  showTitle={false}
                />
              </Box>
            ) : (
              <Text typography="Body1">
                {intl.formatMessage({
                  id: 'empty__migrated_data_already_exists',
                })}
              </Text>
            )}
          </ScrollView>
        </Box>
        {hasRemoteData ? (
          <Button
            type="primary"
            size={isVerticalLayout ? 'xl' : 'lg'}
            onPress={isVerticalLayout ? importAction : undefined}
            onPromise={isVerticalLayout ? undefined : importAction} // crash on android when use onPromise
          >
            {intl.formatMessage({ id: 'action__import' })}
          </Button>
        ) : (
          <Button
            size={isVerticalLayout ? 'xl' : 'lg'}
            onPress={() => {
              onboardingGoBack();
            }}
          >
            {intl.formatMessage({ id: 'action__close' })}
          </Button>
        )}
      </>
    ),
    [
      onboardingGoBack,
      backupData.notOnDevice,
      hasRemoteData,
      importAction,
      intl,
      isVerticalLayout,
    ],
  );

  const secondaryContent = useMemo(() => {
    if (isVerticalLayout) {
      return null;
    }
    return (
      <Box>
        <Center
          size="48px"
          bgColor="decorative-surface-two"
          borderRadius="9999"
        >
          <Icon
            name="EllipsisHorizontalCircleOutline"
            size={24}
            color="decorative-icon-two"
          />
        </Center>
        <Text typography="Body2" mt="26px">
          {intl.formatMessage({
            id: 'content__migration_note_hardware_wallet',
          })}
        </Text>
      </Box>
    );
  }, [intl, isVerticalLayout]);

  return (
    <Layout
      disableAnimation
      title={intl.formatMessage({ id: 'action__preview' })}
      fullHeight
      secondaryContent={secondaryContent}
    >
      {children}
    </Layout>
  );
};

PreviewImportData.defaultProps = defaultProps;

export default PreviewImportData;
